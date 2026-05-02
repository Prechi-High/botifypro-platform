import { prisma } from '@botifypro/database'
import { logger } from './logger'
import { sendMessage } from './commands'

export async function handleReferral(
  bot: any,
  botUser: any,
  referrerId: string,
  chatId: number
) {
  try {
    // Referral is always enabled — the /referral command is always-on.
    // Only skip if the bot has no settings at all.
    if (!bot.settings) return
    if (botUser.id === referrerId) return

    const referrer = await prisma.botUser.findUnique({
      where: { id: referrerId }
    })
    if (!referrer || referrer.botId !== bot.id) return

    const existing = await prisma.referral.findUnique({
      where: {
        botId_referredId: {
          botId: bot.id,
          referredId: botUser.id
        }
      }
    })
    if (existing) return

    const rewardAmount = Number(
      bot.settings?.referralRewardAmount || 100
    )

    await prisma.$transaction([
      prisma.referral.create({
        data: {
          botId: bot.id,
          referrerId: referrer.id,
          referredId: botUser.id,
          rewardPaid: true,
          rewardAmount
        }
      }),
      prisma.botUser.update({
        where: { id: referrer.id },
        data: {
          balance: { increment: rewardAmount }
        }
      }),
      prisma.botUser.update({
        where: { id: botUser.id },
        data: { referredBy: referrer.id }
      })
    ])

    const sym = bot.settings?.currencySymbol || '🪙'
    const currencyName = bot.settings?.currencyName || 'coins'

    await sendMessage(
      bot.botToken,
      Number(referrer.telegramUserId),
      `🎉 <b>Referral Bonus!</b>\n\n` +
      `Someone just registered using your referral link!\n\n` +
      `+${rewardAmount} ${sym} ${currencyName} has been added to your balance.`
    )

    logger.info('Referral processed', {
      botId: bot.id,
      referrerId: referrer.id,
      referredId: botUser.id,
      rewardAmount
    })

  } catch (error: any) {
    logger.error('handleReferral error', { error: error.message })
  }
}

export async function getReferralStats(
  botId: string,
  botUserId: string
): Promise<{ count: number; totalEarned: number }> {
  try {
    const referrals = await prisma.referral.findMany({
      where: { botId, referrerId: botUserId, rewardPaid: true }
    })
    return {
      count: referrals.length,
      totalEarned: referrals.reduce(
        (sum, r) => sum + Number(r.rewardAmount), 0
      )
    }
  } catch {
    return { count: 0, totalEarned: 0 }
  }
}
