import cron from 'node-cron'
import axios from 'axios'
import { prisma } from '@botifypro/database'
import { logger } from './logger'

// Activity window → time range in hours
function getActivityWindowRange(window: string): { minHours: number; maxHours: number } {
  switch (window) {
    case '24h': return { minHours: 0, maxHours: 24 }
    case '48h': return { minHours: 24, maxHours: 48 }
    case '72h': return { minHours: 48, maxHours: 72 }
    case '7d':  return { minHours: 72, maxHours: 168 }
    default:    return { minHours: 0, maxHours: 24 }
  }
}

export async function runAdDispatch() {
  logger.info('Ad dispatch cron started')

  try {
    // Only process ACTIVE campaigns (not pending_approval, not paused, not completed)
    const campaigns = await prisma.adCampaign.findMany({
      where: { status: 'active' },
      include: { advertiser: true }
    })

    logger.info(`Found ${campaigns.length} active campaigns`)

    for (const campaign of campaigns) {
      try {
        await dispatchCampaign(campaign)
      } catch (err: any) {
        logger.error('Campaign dispatch failed', { campaignId: campaign.id, error: err.message })
      }
    }
  } catch (err: any) {
    logger.error('Ad dispatch cron error', { error: err.message })
  }

  logger.info('Ad dispatch cron finished')
}

async function dispatchCampaign(campaign: any) {
  // Safety check — stop if target reached or budget exhausted
  const remainingAudience = campaign.targetAudienceCount - campaign.impressionsCount
  const remainingBudget = Number(campaign.budgetUsd) - Number(campaign.spentUsd)

  if (remainingAudience <= 0 || remainingBudget <= 0) {
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: 'completed', updatedAt: new Date() }
    })
    logger.info('Campaign completed - target reached', { campaignId: campaign.id })
    return
  }

  const costPerImpression = Number(campaign.budgetUsd) / campaign.targetAudienceCount

  // Calculate activity window time range
  const { minHours, maxHours } = getActivityWindowRange(campaign.activityWindow)
  const now = new Date()
  const minTime = new Date(now.getTime() - maxHours * 60 * 60 * 1000)
  const maxTime = new Date(now.getTime() - minHours * 60 * 60 * 1000)

  // Get all bots
  const bots = await prisma.bot.findMany({
    where: { isActive: true },
    include: { settings: true }
  })

  let totalSentThisRun = 0

  for (const bot of bots) {
    if (remainingAudience - totalSentThisRun <= 0) break

    // Find eligible users for this bot matching the activity window
    const eligibleUsers = await prisma.botUser.findMany({
      where: {
        botId: bot.id,
        isBanned: false,
        lastActive: {
          gte: minTime,
          lte: maxTime
        }
      }
    })

    if (eligibleUsers.length === 0) continue

    // Get users who already received this specific campaign in last 24hrs
    const twentyFourHrsAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
    const alreadyReceivedThisCampaign = await prisma.adImpression.findMany({
      where: {
        campaignId: campaign.id,
        botUserId: { in: eligibleUsers.map(u => u.id) },
        servedAt: { gte: twentyFourHrsAgo }
      },
      select: { botUserId: true }
    })
    const receivedThisCampaignIds = new Set(alreadyReceivedThisCampaign.map(i => i.botUserId))

    // Get users who received ANY ad in last 5hrs (1 ad per 5hr window rule)
    const fiveHrsAgo = new Date(now.getTime() - 5 * 60 * 60 * 1000)
    const receivedAnyAdRecently = await prisma.adImpression.findMany({
      where: {
        botUserId: { in: eligibleUsers.map(u => u.id) },
        servedAt: { gte: fiveHrsAgo }
      },
      select: { botUserId: true }
    })
    const receivedRecentlyIds = new Set(receivedAnyAdRecently.map(i => i.botUserId))

    // Filter eligible users
    const finalEligible = eligibleUsers.filter(u =>
      !receivedThisCampaignIds.has(u.id) &&
      !receivedRecentlyIds.has(u.id)
    )

    if (finalEligible.length === 0) continue

    // HARD CAP: never exceed remaining audience
    const canSendToThisBot = remainingAudience - totalSentThisRun
    const usersToSend = finalEligible.slice(0, canSendToThisBot)

    for (const user of usersToSend) {
      // Double check budget before each send
      const currentCampaign = await prisma.adCampaign.findUnique({
        where: { id: campaign.id },
        select: { impressionsCount: true, spentUsd: true, status: true }
      })

      if (!currentCampaign || currentCampaign.status !== 'active') break
      if (currentCampaign.impressionsCount >= campaign.targetAudienceCount) break
      if (Number(currentCampaign.spentUsd) >= Number(campaign.budgetUsd)) break

      try {
        // Send the ad
        const replyMarkup = campaign.buttonText && campaign.buttonUrl
          ? { inline_keyboard: [[{ text: campaign.buttonText, url: campaign.buttonUrl }]] }
          : undefined

        const caption = `📢 <b>${campaign.title}</b>\n\n${campaign.message}`

        if (campaign.imageUrl) {
          await axios.post(
            `https://api.telegram.org/bot${bot.botToken}/sendPhoto`,
            {
              chat_id: Number(user.telegramUserId),
              photo: campaign.imageUrl,
              caption,
              parse_mode: 'HTML',
              reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
            }
          )
        } else {
          await axios.post(
            `https://api.telegram.org/bot${bot.botToken}/sendMessage`,
            {
              chat_id: Number(user.telegramUserId),
              text: caption,
              parse_mode: 'HTML',
              reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
            }
          )
        }

        // Record impression and update campaign atomically
        await prisma.$transaction([
          prisma.adImpression.create({
            data: {
              id: require('crypto').randomUUID(),
              campaignId: campaign.id,
              botUserId: user.id,
              botId: bot.id,
              servedAt: new Date()
            }
          }),
          prisma.adCampaign.update({
            where: { id: campaign.id },
            data: {
              impressionsCount: { increment: 1 },
              spentUsd: { increment: costPerImpression },
              updatedAt: new Date()
            }
          })
        ])

        totalSentThisRun++

        // Small delay to avoid Telegram rate limiting
        await new Promise(r => setTimeout(r, 50))

      } catch (sendErr: any) {
        logger.error('Ad send failed', {
          campaignId: campaign.id,
          userId: String(user.telegramUserId),
          error: sendErr.response?.data?.description || sendErr.message
        })
      }
    }
  }

  // Final check — mark complete if target reached
  const updatedCampaign = await prisma.adCampaign.findUnique({
    where: { id: campaign.id },
    select: { impressionsCount: true, targetAudienceCount: true }
  })
  if (updatedCampaign && updatedCampaign.impressionsCount >= updatedCampaign.targetAudienceCount) {
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { status: 'completed', updatedAt: new Date() }
    })
    logger.info('Campaign marked complete', { campaignId: campaign.id })
  }

  logger.info('Campaign dispatch done', {
    campaignId: campaign.id,
    sentThisRun: totalSentThisRun
  })
}

export function startAdCron() {
  // Run every 5 hours
  cron.schedule('0 */5 * * *', async () => {
    logger.info('Running scheduled ad dispatch')
    await runAdDispatch()
  })
  logger.info('Ad cron job scheduled - runs every 5 hours')
}
