import { prisma } from '@1-touchbot/database'
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
  if (!botUser.adConsent) {
    await sendMessage(
      bot.botToken,
      chatId,
      `👋 Welcome!\n\nThis bot is powered by <b>1-TouchBot</b>.\n\n📢 Occasionally you may receive sponsored messages from advertisers.\n\nBy tapping <b>✅ I Agree</b> below you consent to receiving occasional sponsored messages and agree to our terms of use.\n\nYou must agree to continue using this bot.`,
      {
        inline_keyboard: [[{ text: '✅ I Agree & Continue', callback_data: 'cmd_consent_agree' }]]
      }
    )
    return
  }

  const settings = bot.settings
  if (!settings) {
    await sendMessage(bot.botToken, chatId, '👋 Welcome!')
    return
  }

  // Build reply keyboard
  const keyboard: any[][] = []

  const row1: any[] = []
  if (settings.balanceEnabled) row1.push({ text: '💰 Balance' })
  if (settings.depositEnabled) row1.push({ text: '📥 Deposit' })
  if (row1.length > 0) keyboard.push(row1)

  const row2: any[] = []
  if (settings.withdrawEnabled) row2.push({ text: '📤 Withdraw' })
  row2.push({ text: '🎁 Bonus' })
  keyboard.push(row2)

  const row3: any[] = []
  if (settings.referralEnabled) row3.push({ text: '👥 Referral' })
  row3.push({ text: '❓ Help' })
  keyboard.push(row3)

  keyboard.push([{ text: '📋 Menu' }])

  const replyMarkup = {
    keyboard,
    resize_keyboard: true,
    persistent: true,
    one_time_keyboard: false
  }

  const balanceText = settings.balanceEnabled
    ? `\n\n💰 Your balance: ${botUser.balance} ${settings.currencySymbol || '🪙'}`
    : ''

  // welcomeMessageEnabled defaults to true — only skip if explicitly false
  if (settings.welcomeMessageEnabled !== false) {
    await sendMessage(
      bot.botToken,
      chatId,
      (settings.welcomeMessage || '👋 Welcome!') + balanceText,
      replyMarkup
    )
  } else {
    await sendMessage(
      bot.botToken,
      chatId,
      balanceText || '👋 Welcome back!',
      replyMarkup
    )
  }

  await handleHelp(bot, chatId)
}

export async function handleBalance(bot: any, botUser: any, chatId: number) {
  const usdValue = (Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)).toFixed(4)
  const text =
    '💰 <b>Your Balance</b>\n\n' +
    botUser.balance + ' ' + bot.settings.currencySymbol +
    '\n≈ $' + usdValue + ' USD'
  await sendMessage(bot.botToken, chatId, text, {
    inline_keyboard: [
      [
        { text: '📥 Deposit', callback_data: 'cmd_deposit' },
        { text: '📤 Withdraw', callback_data: 'cmd_withdraw' }
      ]
    ]
  })
}

export async function handleHelp(bot: any, chatId: number) {
  const settings = bot.settings
  const buttons: Array<{ text: string; callback_data: string }> = []

  buttons.push({ text: '🏠 Start',    callback_data: 'cmd_start' })
  buttons.push({ text: '❓ Help',     callback_data: 'cmd_help' })
  if (settings?.balanceEnabled)  buttons.push({ text: '💰 Balance',  callback_data: 'cmd_balance' })
  if (settings?.depositEnabled)  buttons.push({ text: '📥 Deposit',  callback_data: 'cmd_deposit' })
  if (settings?.withdrawEnabled) buttons.push({ text: '📤 Withdraw', callback_data: 'cmd_withdraw' })
  buttons.push({ text: '🎁 Bonus', callback_data: 'cmd_bonus' })
  if (settings?.referralEnabled) buttons.push({ text: '👥 Referral', callback_data: 'cmd_referral' })

  try {
    const customCommands = await prisma.botCommand.findMany({
      where: { botId: bot.id, isActive: true },
      orderBy: { createdAt: 'asc' }
    })
    customCommands.forEach((cmd: any) => {
      buttons.push({ text: cmd.command, callback_data: 'custom_' + cmd.command })
    })
  } catch {}

  const inline_keyboard: Array<Array<{ text: string; callback_data: string }>> = []
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
  const sym = settings?.currencySymbol || '🪙'
  const rate = Math.max(1, Number(settings?.usdToCurrencyRate || 1000))
  // Daily bonus ≈ $0.01 worth of the bot's currency, minimum 1
  const bonusAmount = Math.max(1, Math.floor(rate * 0.01))

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
    `+${bonusAmount} ${sym} added to your balance!\n\n` +
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
