import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisTtl } from './redis'

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object
) {
  try {
    const payload: any = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }
    if (replyMarkup) {
      payload.reply_markup = JSON.stringify(replyMarkup)
    }
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      payload
    )
    if (!response.data?.ok) {
      logger.error('Telegram sendMessage failed', {
        error: response.data,
        chatId,
        textPreview: text.substring(0, 100)
      })
    }
  } catch (err: any) {
    logger.error('Telegram sendMessage error', {
      message: err?.message,
      response: err?.response?.data,
      chatId,
      textPreview: text?.substring(0, 100)
    })
  }
}

export async function handleStart(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!settings) {
    await sendMessage(bot.botToken, chatId, '👋 Welcome!')
    return
  }

  // Build reply keyboard — only show activated commands
  const keyboard: any[][] = []
  const allButtons: any[] = []

  // Fixed first: Balance always first
  allButtons.push({ text: '💰 Balance' })
  // Referral always second
  allButtons.push({ text: '🔗 Referral' })

  // Optional: only if enabled in settings
  if (settings?.withdrawEnabled) allButtons.push({ text: '📤 Withdraw' })
  if (settings?.dailyBonusEnabled || settings?.bonusEnabled) allButtons.push({ text: '🎁 Daily Bonus' })
  if (settings?.leaderboardEnabled) allButtons.push({ text: '🏆 Leaderboard' })
  if (settings?.depositEnabled) allButtons.push({ text: '📥 Deposit' })

  // Stack 2 per row
  for (let i = 0; i < allButtons.length; i += 2) {
    keyboard.push(allButtons.slice(i, i + 2))
  }

  const replyMarkup = {
    keyboard,
    resize_keyboard: true,
    persistent: true,
    one_time_keyboard: false
  }

  const balanceText = `\n\n💰 Your balance: ${botUser.balance} ${settings.currencySymbol || '🪙'}`

  if (settings.welcomeMessageEnabled !== false && settings.welcomeMessage) {
    await sendMessage(
      bot.botToken,
      chatId,
      settings.welcomeMessage + balanceText,
      replyMarkup
    )
  } else {
    await sendMessage(
      bot.botToken,
      chatId,
      '👋 Welcome back!' + balanceText,
      replyMarkup
    )
  }
}

export async function handleBalance(bot: any, botUser: any, chatId: number) {
  const usdValue = (Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)).toFixed(4)
  const text =
    '💰 <b>Your Balance</b>\n\n' +
    botUser.balance + ' ' + bot.settings.currencySymbol +
    '\n≈ $' + usdValue + ' USD'
  const balanceButtons: any[] = []
  if (bot.settings?.depositEnabled) balanceButtons.push({ text: '📥 Deposit', callback_data: 'cmd_deposit' })
  if (bot.settings?.withdrawEnabled) balanceButtons.push({ text: '📤 Withdraw', callback_data: 'cmd_withdraw' })
  await sendMessage(
    bot.botToken, chatId, text,
    balanceButtons.length > 0 ? { inline_keyboard: [balanceButtons] } : undefined
  )
}

export async function handleHelp(bot: any, chatId: number) {
  const settings = bot.settings
  const buttons: any[] = []

  // Balance always first (always active)
  buttons.push({ text: '💰 Balance', callback_data: 'cmd_balance' })
  // Referral always second (always active)
  buttons.push({ text: '🔗 Referral', callback_data: 'cmd_referral' })

  // Only add if enabled
  if (settings?.withdrawEnabled) buttons.push({ text: '📤 Withdraw', callback_data: 'cmd_withdraw' })
  if (settings?.dailyBonusEnabled || settings?.bonusEnabled) buttons.push({ text: '🎁 Daily Bonus', callback_data: 'cmd_bonus' })
  if (settings?.leaderboardEnabled) buttons.push({ text: '🏆 Leaderboard', callback_data: 'cmd_leaderboard' })
  if (settings?.depositEnabled) buttons.push({ text: '📥 Deposit', callback_data: 'cmd_deposit' })

  // Custom commands
  try {
    const customCommands = await prisma.botCommand.findMany({
      where: { botId: bot.id, isActive: true },
      orderBy: { createdAt: 'asc' }
    })
    customCommands.forEach((cmd: any) => {
      buttons.push({ text: cmd.command, callback_data: 'custom_' + cmd.command })
    })
  } catch {}

  // Stack 2 per row
  const inline_keyboard: any[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    inline_keyboard.push(buttons.slice(i, i + 2))
  }

  await sendMessage(
    bot.botToken,
    chatId,
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
    await sendMessage(
      bot.botToken,
      chatId,
      `⏳ <b>Daily Bonus</b>\n\nYou already claimed today's bonus!\n\nNext bonus available in: <b>${hours}h ${minutes}m</b>`
    )
    return
  }

  await prisma.botUser.update({
    where: { id: botUser.id },
    data: { balance: { increment: bonusAmount } }
  })
  await redisSet(bonusKey, '1', 86400)

  const updatedUser = await prisma.botUser.findUnique({
    where: { id: botUser.id },
    select: { balance: true }
  })

  logger.info('Daily bonus claimed', { botId: bot.id, botUserId: botUser.id, bonusAmount })

  await sendMessage(
    bot.botToken,
    chatId,
    `🎁 <b>Daily Bonus Claimed!</b>\n\n` +
    `+${bonusAmount} ${sym} (${currencyName}) added to your balance!\n\n` +
    `💰 New balance: <b>${updatedUser?.balance} ${sym}</b>\n\n` +
    `Come back in 24 hours for your next bonus! 🕐`
  )
}

export async function handleReferralInfo(bot: any, botUser: any, chatId: number) {
  if (!bot.settings?.referralEnabled) {
    await sendMessage(bot.botToken, chatId, '👥 Referral program is not enabled on this bot.')
    return
  }

  const { getReferralStats } = await import('./referral')
  const stats = await getReferralStats(bot.id, botUser.id)
  const botUsername = bot.botUsername || 'yourbot'
  const referralLink = `https://t.me/${botUsername}?start=ref_${botUser.id}`
  const sym = bot.settings?.currencySymbol || '🪙'
  const rewardAmount = bot.settings?.referralRewardAmount || 100
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join and start earning!')}`

  await sendMessage(
    bot.botToken,
    chatId,
    `👥 <b>Referral Program</b>\n\n` +
    `Earn <b>${rewardAmount} ${sym}</b> for every friend you invite!\n\n` +
    `🔗 <b>Your referral link:</b>\n<code>${referralLink}</code>\n\n` +
    `📊 <b>Your Stats</b>\n` +
    `Referrals: <b>${stats.count}</b>\n` +
    `Total earned: <b>${stats.totalEarned} ${sym}</b>`,
    {
      inline_keyboard: [[{ text: '📤 Share Link', url: shareUrl }]]
    }
  )
}

export async function handleLeaderboard(bot: any, botUser: any, chatId: number) {
  if (!bot.settings?.leaderboardEnabled) {
    await sendMessage(bot.botToken, chatId, '🏆 Leaderboard is not enabled on this bot.')
    return
  }

  const sym = bot.settings?.currencySymbol || '🪙'
  const topUsers = await prisma.botUser.findMany({
    where: { botId: bot.id, isBanned: false },
    orderBy: { balance: 'desc' },
    take: 10,
    select: { id: true, firstName: true, balance: true, telegramUserId: true }
  })

  if (topUsers.length === 0) {
    await sendMessage(bot.botToken, chatId, '🏆 <b>Leaderboard</b>\n\nNo users yet.')
    return
  }

  const medals = ['🥇', '🥈', '🥉']
  let text = `🏆 <b>Leaderboard</b>\n\n`
  topUsers.forEach((u, i) => {
    const medal = medals[i] || `${i + 1}.`
    const isMe = u.id === botUser.id ? ' 👈 You' : ''
    text += `${medal} ${u.firstName} — ${u.balance} ${sym}${isMe}\n`
  })

  await sendMessage(bot.botToken, chatId, text)
}

export async function handleDeposit(bot: any, botUser: any, chatId: number) {
  const address = String(bot?.settings?.depositWalletAddress || '').trim()
  if (!address) {
    await sendMessage(bot.botToken, chatId, '💳 Deposit not configured. Contact bot owner.')
    return
  }

  if (!bot?.settings?.depositEnabled) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits are currently disabled.')
    return
  }

  await redisSet(`deposit_state:${botUser.id}`, 'awaiting_txhash', 600)

  await sendMessage(
    bot.botToken,
    chatId,
    `📥 <b>Deposit USDT (TRC20)</b>\n\nSend USDT to this address:\n<code>${bot.settings.depositWalletAddress}</code>\n\n⚠️ Only send USDT on the TRC20 network.\nOther tokens or networks will not be credited.\n\nAfter sending, reply here with your transaction hash.\nYou have 10 minutes.\n\n💡 Get your TX hash from your wallet transaction history.`,
    {
      inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_deposit' }]]
    }
  )
}

export async function handleWithdraw(bot: any, botUser: any, chatId: number) {
  const hasPaymentKey = bot.settings.oxapayMerchantKey || bot.settings.faucetpayApiKey || bot.settings.faucetpayWithdrawalKey
  if (!hasPaymentKey && !bot.settings.manualWithdrawal) {
    await sendMessage(bot.botToken, chatId, '💳 Withdrawals not configured yet. Contact bot owner.')
    return
  }

  const usdEquiv = Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)
  const minWithdraw = Number(bot.settings.minWithdrawUsd)
  if (usdEquiv < minWithdraw) {
    await sendMessage(
      bot.botToken,
      chatId,
      `❌ Insufficient balance.\n\nMinimum withdrawal: $${minWithdraw} USD\nYour balance: ${botUser.balance} ${bot.settings.currencySymbol} (≈$${usdEquiv.toFixed(4)})`
    )
    return
  }

  await redisSet('withdraw_state:' + botUser.id, 'awaiting_address', 600)

  const networkNote = bot.settings.manualWithdrawal
    ? 'Send your wallet address (any network accepted — the bot owner will process manually).'
    : 'Please reply with your USDT (TRC20) wallet address.'

  await sendMessage(
    bot.botToken,
    chatId,
    `📤 <b>Withdraw</b>\n\n${networkNote}\n\n⏱ You have 10 minutes to reply.`
  )
}
