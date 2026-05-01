import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisTtl, redisDel } from './redis'
import { getWithdrawalDestinationHint, getWithdrawProvider, hasAutomaticPayoutKey } from './payments/payouts'

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object
) {
  try {
    const payload: any = { chat_id: chatId, text, parse_mode: 'HTML' }
    if (replyMarkup) payload.reply_markup = JSON.stringify(replyMarkup)
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      payload
    )
    if (!response.data?.ok) {
      logger.error('Telegram sendMessage failed', {
        error: response.data, chatId, textPreview: text.substring(0, 100)
      })
    }
  } catch (err: any) {
    logger.error('Telegram sendMessage error', {
      message: err?.message, response: err?.response?.data,
      chatId, textPreview: text?.substring(0, 100)
    })
  }
}

export async function handleStart(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!settings) {
    await sendMessage(bot.botToken, chatId, '👋 Welcome!')
    return
  }

  // Cancel any in-progress withdrawal when user goes back to start
  await redisDel('withdraw_state:' + botUser.id)
  await redisDel('withdraw_amount:' + botUser.id)

  const allButtons: any[] = []
  allButtons.push({ text: '💰 Balance' })
  allButtons.push({ text: '🔗 Referral' })
  if (settings.withdrawEnabled) allButtons.push({ text: '📤 Withdraw' })
  if (settings.dailyBonusEnabled || settings.bonusEnabled) allButtons.push({ text: '🎁 Daily Bonus' })
  if (settings.leaderboardEnabled) allButtons.push({ text: '🏆 Leaderboard' })
  if (settings.depositEnabled) allButtons.push({ text: '📥 Deposit' })

  const keyboard: any[][] = []
  for (let i = 0; i < allButtons.length; i += 2) {
    keyboard.push(allButtons.slice(i, i + 2))
  }

  const replyMarkup = { keyboard, resize_keyboard: true, persistent: true, one_time_keyboard: false }

  if (settings.welcomeMessageEnabled !== false && settings.welcomeMessage) {
    await sendMessage(bot.botToken, chatId, settings.welcomeMessage, replyMarkup)
  } else {
    await sendMessage(bot.botToken, chatId, '👋 Welcome back!', replyMarkup)
  }
}

export async function handleBalance(bot: any, botUser: any, chatId: number) {
  const sym = bot.settings?.currencySymbol || '🪙'
  const currencyName = bot.settings?.currencyName || 'coins'

  await sendMessage(
    bot.botToken, chatId,
    `🏦 <b>Account Balance Overview</b>\n\n` +
    `• User ID: ${botUser.telegramUserId}\n` +
    `• Balance: ${botUser.balance} ${sym} ${currencyName}\n\n` +
    `✅ Keep growing. Withdraw anytime!`,
    {
      inline_keyboard: [[
        { text: '📢 Advertise with AdsGalaxy', url: 'https://t.me/Ads_Galaxy_bot' }
      ]]
    }
  )
}

export async function handleHelp(bot: any, chatId: number) {
  const settings = bot.settings
  const buttons: any[] = []

  buttons.push({ text: '💰 Balance', callback_data: 'cmd_balance' })
  buttons.push({ text: '🔗 Referral', callback_data: 'cmd_referral' })
  if (settings?.withdrawEnabled) buttons.push({ text: '📤 Withdraw', callback_data: 'cmd_withdraw' })
  if (settings?.dailyBonusEnabled || settings?.bonusEnabled) buttons.push({ text: '🎁 Daily Bonus', callback_data: 'cmd_bonus' })
  if (settings?.leaderboardEnabled) buttons.push({ text: '🏆 Leaderboard', callback_data: 'cmd_leaderboard' })
  if (settings?.depositEnabled) buttons.push({ text: '📥 Deposit', callback_data: 'cmd_deposit' })

  const inline_keyboard: any[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    inline_keyboard.push(buttons.slice(i, i + 2))
  }

  await sendMessage(
    bot.botToken, chatId,
    '📋 <b>Menu</b>\n\nChoose an option below:',
    { inline_keyboard }
  )
}

export async function handleBonus(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!settings?.dailyBonusEnabled && !settings?.bonusEnabled) {
    await sendMessage(bot.botToken, chatId, '🎁 Daily bonus is not enabled on this bot.')
    return
  }

  const sym = settings?.currencySymbol || '🪙'
  const currencyName = settings?.currencyName || 'coins'
  const rate = Math.max(1, Number(settings?.usdToCurrencyRate || 1000))
  const bonusAmount = settings?.dailyBonusAmount
    ? Number(settings.dailyBonusAmount)
    : settings?.bonusAmount
      ? Number(settings.bonusAmount)
      : Math.max(1, Math.floor(rate * 0.01))

  const bonusKey = `daily_bonus:${bot.id}:${botUser.id}`
  const claimed = await redisGet(bonusKey)

  if (claimed) {
    const ttl = await redisTtl(bonusKey)
    const hours = Math.floor(Math.max(0, ttl) / 3600)
    const minutes = Math.floor((Math.max(0, ttl) % 3600) / 60)
    const secs = Math.max(0, ttl) % 60
    await sendMessage(
      bot.botToken, chatId,
      `⏳ You can claim your bonus again in ${hours}h ${minutes}m ${secs}s`
    )
    return
  }

  await prisma.botUser.update({
    where: { id: botUser.id },
    data: { balance: { increment: bonusAmount } }
  })
  await redisSet(bonusKey, '1', 86400)

  const updatedUser = await prisma.botUser.findUnique({
    where: { id: botUser.id }, select: { balance: true }
  })

  await sendMessage(
    bot.botToken, chatId,
    `🎁 <b>Daily Bonus Claimed!</b>\n\n` +
    `+${bonusAmount} ${sym} ${currencyName} added to your balance!\n\n` +
    `💰 New balance: <b>${updatedUser?.balance} ${sym}</b>`
  )
}

export async function handleReferralInfo(bot: any, botUser: any, chatId: number) {
  const { getReferralStats } = await import('./referral')
  const stats = await getReferralStats(bot.id, botUser.id)
  const botUsername = bot.botUsername || 'yourbot'
  const referralLink = `https://t.me/${botUsername}?start=ref_${botUser.id}`
  const sym = bot.settings?.currencySymbol || '🪙'
  const currencyName = bot.settings?.currencyName || 'coins'
  const rewardAmount = bot.settings?.referralRewardAmount || 100
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join and start earning!')}`

  const subButtons: any[] = []
  if (bot.settings?.leaderboardEnabled) {
    subButtons.push([{ text: '🏆 Leaderboard', callback_data: 'cmd_leaderboard' }])
  }
  subButtons.push([{ text: '📤 Share Referral Link', url: shareUrl }])

  await sendMessage(
    bot.botToken, chatId,
    `🏁 <b>Referral Program Overview</b>\n\n` +
    `• Reward per invite: ${rewardAmount} ${sym} ${currencyName}\n` +
    `• Total referrals: ${stats.count}\n` +
    `• Your referral link:\n${referralLink}\n\n` +
    `Total earned: <b>${stats.totalEarned} ${sym} ${currencyName}</b>\n\n` +
    `⚠️ Please avoid fake or self-referrals.\n` +
    `💬 Share your link and earn more daily!`,
    { inline_keyboard: subButtons }
  )
}

export async function handleLeaderboard(bot: any, botUser: any, chatId: number) {
  if (!bot.settings?.leaderboardEnabled) {
    await sendMessage(bot.botToken, chatId, '🏆 Leaderboard is not enabled.')
    return
  }

  const referralCounts = await prisma.referral.groupBy({
    by: ['referrerId'],
    where: { botId: bot.id },
    _count: { referrerId: true },
    orderBy: { _count: { referrerId: 'desc' } },
    take: 10
  })

  if (referralCounts.length === 0) {
    await sendMessage(bot.botToken, chatId, '🏆 <b>Leaderboard</b>\n\nNo referrals yet. Be the first!')
    return
  }

  const userIds = referralCounts.map(r => r.referrerId)
  const users = await prisma.botUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true }
  })

  const medals = ['🥇', '🥈', '🥉']
  let text = `🏆 <b>Leaderboard — Top Referrers</b>\n\n`
  referralCounts.forEach((r, i) => {
    const user = users.find(u => u.id === r.referrerId)
    const medal = medals[i] || `${i + 1}.`
    const isMe = r.referrerId === botUser.id ? ' 👈 You' : ''
    text += `${medal} ${user?.firstName || 'User'} — ${r._count.referrerId} referrals${isMe}\n`
  })

  await sendMessage(bot.botToken, chatId, text, {
    inline_keyboard: [[
      { text: '⬅️ Back to Menu', callback_data: 'cmd_menu' }
    ]]
  })
}

export async function handleDeposit(bot: any, botUser: any, chatId: number) {
  if (!bot?.settings?.depositEnabled) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits are currently disabled.')
    return
  }
  const address = String(bot?.settings?.depositWalletAddress || '').trim()
  if (!address) {
    await sendMessage(bot.botToken, chatId, '💳 Deposit not configured. Contact bot owner.')
    return
  }
  await redisSet(`deposit_state:${botUser.id}`, 'awaiting_txhash', 600)
  await sendMessage(
    bot.botToken, chatId,
    `📥 <b>Deposit USDT (TRC20)</b>\n\nSend USDT to:\n<code>${address}</code>\n\n` +
    `⚠️ TRC20 network only.\n\nAfter sending, reply with your transaction hash.`,
    { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_deposit' }]] }
  )
}

// ── WITHDRAWAL FLOW ───────────────────────────────────────────────────────────
// Step 1: User taps Withdraw → asked to type an amount
// Step 2: Bot extracts number from free text, validates balance
// Step 3: If saved address exists, ask to reuse or enter new
// Step 4: User provides address → process withdrawal

export async function handleWithdraw(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!hasAutomaticPayoutKey(settings) && !settings?.manualWithdrawal) {
    await sendMessage(bot.botToken, chatId, '💳 Withdrawals not configured. Contact bot owner.')
    return
  }

  const sym = settings?.currencySymbol || '🪙'
  const currencyName = settings?.currencyName || 'coins'
  const rate = Number(settings?.usdToCurrencyRate || 1000)
  const minWithdrawUsd = Number(settings?.minWithdrawUsd || 0.5)
  const minWithdrawCurrency = minWithdrawUsd * rate
  const balance = Number(botUser.balance)

  if (balance < minWithdrawCurrency) {
    await sendMessage(
      bot.botToken, chatId,
      `❌ <b>Insufficient Balance</b>\n\n` +
      `Minimum withdrawal: <b>${minWithdrawCurrency.toFixed(0)} ${sym}</b>\n` +
      `Your balance: <b>${balance.toFixed(0)} ${sym}</b>\n\n` +
      `👥 Share your referral link to earn more!`
    )
    return
  }

  const provider = getWithdrawProvider(settings)
  const providerLabel = provider === 'manual'
    ? 'Manual review'
    : provider === 'oxapay'
      ? 'OxaPay (USDT TRC20)'
      : `FaucetPay (${settings?.faucetpayPayoutCurrency || 'USDT'})`

  // Set state to awaiting_amount
  await redisSet('withdraw_state:' + botUser.id, 'awaiting_amount', 600)

  await sendMessage(
    bot.botToken, chatId,
    `📤 <b>Withdraw</b>\n\n` +
    `Provider: <b>${providerLabel}</b>\n` +
    `Balance: <b>${balance.toFixed(0)} ${sym} ${currencyName}</b>\n` +
    `Minimum: <b>${minWithdrawCurrency.toFixed(0)} ${sym}</b>\n\n` +
    `How much do you want to withdraw?\n` +
    `Just type the amount — e.g. <code>500</code> or <code>50 ${sym}</code>\n\n` +
    `⏱ You have 10 minutes.`,
    { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]] }
  )
}

export async function handleWithdrawAmountSelected(bot: any, botUser: any, chatId: number, amount: number) {
  const settings = bot.settings
  const sym = settings?.currencySymbol || '🪙'
  const rate = Number(settings?.usdToCurrencyRate || 1000)
  const usdEquiv = amount / rate
  const feePercent = Number(settings?.withdrawFeePercent || 0)
  const feeUsd = usdEquiv * (feePercent / 100)
  const netUsd = usdEquiv - feeUsd

  // Save chosen amount to Redis
  await redisSet('withdraw_amount:' + botUser.id, String(amount), 600)
  await redisSet('withdraw_state:' + botUser.id, 'awaiting_address', 600)

  const provider = getWithdrawProvider(settings)

  // Check if user has a saved address (stored in Redis)
  const savedAddress = await redisGet(`withdraw_saved_address:${botUser.id}`) || null

  if (savedAddress) {
    await sendMessage(
      bot.botToken, chatId,
      `📤 <b>Withdrawal: ${amount.toLocaleString()} ${sym}</b>\n` +
      `≈ ${netUsd.toFixed(4)} USD after fees\n\n` +
      `You have a saved address:\n<code>${savedAddress}</code>\n\n` +
      `Use this address or enter a new one?`,
      {
        inline_keyboard: [
          [{ text: '✅ Use Saved Address', callback_data: 'withdraw_use_saved' }],
          [{ text: '✏️ Enter New Address', callback_data: 'withdraw_new_address' }],
          [{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]
        ]
      }
    )
  } else {
    const hint = getWithdrawalDestinationHint(settings)
    const addressLabel = provider === 'faucetpay'
      ? '📧 Enter your <b>FaucetPay email address</b> or FaucetPay-linked wallet:'
      : provider === 'oxapay'
        ? '💳 Enter your <b>USDT TRC20 wallet address</b> (starts with T, 34 chars):'
        : '📝 Enter your payout address or details:'

    await sendMessage(
      bot.botToken, chatId,
      `📤 <b>Withdrawal: ${amount.toLocaleString()} ${sym}</b>\n` +
      `≈ ${netUsd.toFixed(4)} USD after fees\n\n` +
      `${addressLabel}\n\n<i>${hint}</i>\n\n⏱ You have 10 minutes.`,
      { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]] }
    )
  }
}
