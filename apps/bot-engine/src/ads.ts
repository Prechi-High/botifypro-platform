import { prisma } from '@botifypro/database'
import { redisIncr, redisSet } from './redis'

export async function maybeServeAd(bot: any, botUser: any, chatId: number) {
  try {
    if (!bot.platformAdminConfirmed) return

    const count = await redisIncr('msg_count:' + botUser.id, 3600)
    if (count < 5) return

    await redisSet('msg_count:' + botUser.id, '0')

    const campaigns = await prisma.adCampaign.findMany({
      where: { isActive: true, isPaid: true },
      take: 20
    })

    const eligible = campaigns
      .filter((c: any) => Number(c.spentUsd) < Number(c.budgetUsd))
      .filter((c: any) => c.targetCategory === 'all' || c.targetCategory === bot.category)

    if (eligible.length === 0) return

    const campaign = eligible[Math.floor(Math.random() * eligible.length)]
    const { sendMessage } = await import('./commands')

    const text = '\n━━━━━━━━━━━━\n📢 <b>Sponsored</b>\n\n' + campaign.messageText
    if (campaign.buttonText && campaign.buttonUrl) {
      await sendMessage(bot.botToken, chatId, text, {
        inline_keyboard: [[{ text: campaign.buttonText, url: campaign.buttonUrl }]]
      })
    } else {
      await sendMessage(bot.botToken, chatId, text)
    }

    await prisma.adImpression.create({
      data: { campaignId: campaign.id, botId: bot.id, botUserId: botUser.id }
    })

    await prisma.adCampaign.update({
      where: { id: campaign.id },
      data: { spentUsd: { increment: campaign.costPerImpressionUsd } }
    })
  } catch {
    return
  }
}

