import { prisma } from '@botifypro/database'
import axios from 'axios'
import logger from './logger'

export async function maybeServeAd(bot: any, botUser: any, chatId: number) {
  try {
    if (!bot?.settings) return
    if (bot.settings.isPro) return // pro bot owners don't receive ads

    // Check 24hr rule - no ad to this user in last 24hrs from ANY campaign
    const lastAd = botUser.lastAdReceivedAt
    if (lastAd) {
      const hoursSinceLast = (Date.now() - new Date(lastAd).getTime()) / (1000 * 60 * 60)
      if (hoursSinceLast < 24) return
    }

    // Find eligible campaigns - active, has budget, matches bot category
    const now = new Date()
    const campaigns = await prisma.adCampaign.findMany({
      where: {
        status: 'active',
        budgetUsd: { gt: 0 }
      },
      orderBy: { createdAt: 'asc' }
    })

    if (campaigns.length === 0) return

    // Filter out campaigns already shown to this user
    const shownImpressions = await prisma.adImpression.findMany({
      where: { botUserId: botUser.id },
      select: { campaignId: true }
    })
    const shownCampaignIds = new Set(shownImpressions.map((i: any) => i.campaignId))

    const eligible = campaigns.filter((c: any) => !shownCampaignIds.has(c.id))
    if (eligible.length === 0) return

    // Pick random eligible campaign
    const campaign = eligible[Math.floor(Math.random() * eligible.length)]

    // Build message
    const replyMarkup = campaign.buttonText && campaign.buttonUrl
      ? { inline_keyboard: [[{ text: campaign.buttonText, url: campaign.buttonUrl }]] }
      : undefined

    // Send the ad
    if (campaign.imageUrl) {
      await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/sendPhoto`,
        {
          chat_id: chatId,
          photo: campaign.imageUrl,
          caption: `📢 <b>${campaign.title}</b>\n\n${campaign.message}`,
          parse_mode: 'HTML',
          reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
        }
      )
    } else {
      await axios.post(
        `https://api.telegram.org/bot${bot.botToken}/sendMessage`,
        {
          chat_id: chatId,
          text: `📢 <b>${campaign.title}</b>\n\n${campaign.message}`,
          parse_mode: 'HTML',
          reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
        }
      )
    }

    // Record impression
    await prisma.adImpression.create({
      data: {
        id: require('crypto').randomUUID(),
        campaignId: campaign.id,
        botUserId: botUser.id,
        botId: bot.id,
        servedAt: new Date()
      }
    })

    // Update user lastAdReceivedAt
    await prisma.botUser.update({
      where: { id: botUser.id },
      data: { lastAdReceivedAt: new Date() }
    })

    // Deduct CPM cost from campaign budget
    const cpmRate = 0.001 // $0.001 per impression
    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: {
        budgetUsd: { decrement: cpmRate },
        updatedAt: new Date()
      }
    })

    logger.info('Ad served', { campaignId: campaign.id, botUserId: botUser.id })
  } catch (error: any) {
    logger.error('maybeServeAd error', { error: error.message })
  }
}
