import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisDel } from './redis'
import {
  sendMessage, handleStart, handleBalance, handleDeposit,
  handleWithdraw, handleHelp, handleBonus, handleReferralInfo
} from './commands'
import { maybeServeAd } from './ads'
import { handleReferral } from './referral'

// ─── Captcha helpers ───────────────────────────────────────────────────────────

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function makeCaptcha(): { question: string; answer: number } {
  const type = rnd(0, 2)
  if (type === 0) {
    const a = rnd(1, 15), b = rnd(1, 15)
    return { question: `${a} + ${b} = ?`, answer: a + b }
  } else if (type === 1) {
    const a = rnd(5, 20), b = rnd(1, Math.min(a, 10))
    return { question: `${a} - ${b} = ?`, answer: a - b }
  } else {
    const a = rnd(2, 9), b = rnd(2, 9)
    return { question: `${a} × ${b} = ?`, answer: a * b }
  }
}

// ─── Custom command / auto-reply handler ──────────────────────────────────────

async function handleCustomCommand(
  bot: any, botUser: any, chatId: number, commandText: string
): Promise<boolean> {
  try {
    // Slash commands: match first word; plain text: exact match
    const lookup = commandText.startsWith('/')
      ? commandText.split(' ')[0].toLowerCase()
      : commandText.toLowerCase().trim()

    const customCommand = await prisma.botCommand.findFirst({
      where: { botId: bot.id, command: lookup, isActive: true }
    })

    if (!customCommand) return false

    let response = customCommand.responseText

    if (bot.settings) {
      const rate = Number(bot.settings.usdToCurrencyRate) || 1000
      response = response.replace(/\[CURRENCY_RATE\]/g, rate.toString())
      response = response.replace(/\[CURRENCY_SYMBOL\]/g, bot.settings.currencySymbol || '🪙')
      response = response.replace(/\[USD_RATE\]/g, (1 / rate).toFixed(6))
    }

    if (response.includes('[REFERRAL_LINK]')) {
      const botUsername = bot.botUsername || 'yourbot'
      response = response.replace(/\[REFERRAL_LINK\]/g, `https://t.me/${botUsername}?start=ref_${botUser.id}`)
    }

    if (response.includes('[REFERRAL_COUNT]') || response.includes('[REFERRAL_EARNED]')) {
      try {
        const { getReferralStats } = await import('./referral')
        const stats = await getReferralStats(bot.id, botUser.id)
        const sym = bot.settings?.currencySymbol || '🪙'
        response = response.replace(/\[REFERRAL_COUNT\]/g, stats.count.toString())
        response = response.replace(/\[REFERRAL_EARNED\]/g, stats.totalEarned + ' ' + sym)
      } catch {
        response = response.replace(/\[REFERRAL_COUNT\]/g, '0').replace(/\[REFERRAL_EARNED\]/g, '0')
      }
    }

    await sendMessage(bot.botToken, chatId, response)
    logger.info('Auto-reply handled', { command: lookup, botId: bot.id })
    return true
  } catch (error: any) {
    logger.error('handleCustomCommand error', { error: error.message })
    return false
  }
}

// ─── User helpers ─────────────────────────────────────────────────────────────

export async function getOrCreateBotUser(botId: string, telegramUser: any) {
  try {
    const telegramUserId = BigInt(telegramUser.id)

    const existing = await prisma.botUser.findUnique({
      where: { botId_telegramUserId: { botId, telegramUserId } }
    })

    if (existing) {
      await prisma.botUser.update({
        where: { id: existing.id },
        data: {
          lastActive: new Date(),
          telegramUsername: telegramUser.username || existing.telegramUsername
        }
      })
      return existing
    }

    const newUser = await prisma.botUser.create({
      data: {
        botId,
        telegramUserId,
        telegramUsername: telegramUser.username || null,
        firstName: telegramUser.first_name || 'User',
        balance: 0,
        channelVerified: false,
        isBanned: false
      }
    })

    logger.info('New bot user created', { botId, telegramUserId: telegramUser.id })
    return newUser
  } catch (error: any) {
    logger.error('getOrCreateBotUser failed', { error: error.message, botId, telegramUserId: telegramUser?.id })
    throw error
  }
}

export async function checkChannelMembership(channelId: string, telegramUserId: number): Promise<boolean> {
  try {
    const platformBotToken = process.env.PLATFORM_BOT_TOKEN
    if (!platformBotToken) return true // fail open

    const url = `https://api.telegram.org/bot${platformBotToken}/getChatMember`
    const response = await axios.get(url, { params: { chat_id: channelId, user_id: telegramUserId } })
    const status = response.data?.result?.status
    return ['member', 'administrator', 'creator', 'restricted'].includes(status)
  } catch (error: any) {
    logger.error('checkChannelMembership failed', { error: error.message, channelId })
    return true // fail open on error
  }
}

// ─── Withdrawal processor ─────────────────────────────────────────────────────

export async function processWithdrawal(bot: any, botUser: any, address: string, chatId: number) {
  if (!address || address.length < 20) {
    await sendMessage(bot.botToken, chatId, '❌ Invalid address. Please try again.')
    return
  }

  const usdAmount = Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)
  if (usdAmount < Number(bot.settings.minWithdrawUsd)) {
    await sendMessage(
      bot.botToken, chatId,
      '❌ Insufficient balance.\n\nMinimum withdrawal: $' + bot.settings.minWithdrawUsd + ' USD'
    )
    return
  }

  // Manual withdrawal mode — create pending transaction, deduct balance
  if (bot.settings.manualWithdrawal) {
    const feePercent = Number(bot.settings.withdrawFeePercent || 0)
    const feeUsd = usdAmount * (feePercent / 100)
    const netUsd = usdAmount - feeUsd
    const currencyAmount = Number(botUser.balance)
    const sym = bot.settings.currencySymbol || '🪙'

    await prisma.$transaction([
      prisma.transaction.create({
        data: {
          botId: bot.id,
          botUserId: botUser.id,
          type: 'withdrawal',
          amountCurrency: currencyAmount,
          amountUsd: usdAmount,
          status: 'pending',
          gateway: 'manual',
          withdrawAddress: address,
          platformFeeAmount: feeUsd
        }
      }),
      prisma.botUser.update({
        where: { id: botUser.id },
        data: { balance: { decrement: currencyAmount } }
      })
    ])

    logger.info('Manual withdrawal submitted', { botId: bot.id, botUserId: botUser.id, usdAmount, address })

    await sendMessage(
      bot.botToken, chatId,
      `✅ <b>Withdrawal Submitted</b>\n\n` +
      `Amount: ${currencyAmount} ${sym} (≈$${netUsd.toFixed(4)} USD)\n` +
      `Address: <code>${address}</code>\n\n` +
      `⏳ Your withdrawal will be processed manually by the bot owner within 24-48 hours.`
    )
    return
  }

  // Automated withdrawal — queue as pending, gateway processes it
  const feePercent = Number(bot.settings.withdrawFeePercent || 0)
  const feeUsd = usdAmount * (feePercent / 100)
  const netUsd = usdAmount - feeUsd
  const currencyAmount = Number(botUser.balance)
  const sym = bot.settings.currencySymbol || '🪙'
  const gateway = bot.settings.faucetpayWithdrawalKey ? 'faucetpay' : 'oxapay'

  await prisma.$transaction([
    prisma.transaction.create({
      data: {
        botId: bot.id,
        botUserId: botUser.id,
        type: 'withdrawal',
        amountCurrency: currencyAmount,
        amountUsd: usdAmount,
        status: 'pending',
        gateway,
        withdrawAddress: address,
        platformFeeAmount: feeUsd
      }
    }),
    prisma.botUser.update({
      where: { id: botUser.id },
      data: { balance: { decrement: currencyAmount } }
    })
  ])

  logger.info('Withdrawal queued', { botId: bot.id, botUserId: botUser.id, usdAmount, gateway, address })

  await sendMessage(
    bot.botToken, chatId,
    `✅ <b>Withdrawal Submitted</b>\n\n` +
    `Amount: ${currencyAmount} ${sym} (≈$${netUsd.toFixed(4)} USD)\n` +
    `Address: <code>${address}</code>\n\n` +
    `⏳ Processing via ${gateway}. You will be notified once complete.`
  )
}

// ─── Main webhook handler ─────────────────────────────────────────────────────

export async function handleWebhook(req: any, res: any, botToken: string, update: any) {
  try {
    logger.info('Processing update', { updateId: update?.update_id })

    if (!botToken || !update) return

    const bot = await prisma.bot.findUnique({
      where: { botToken },
      include: { settings: true }
    })

    if (!bot || !bot.isActive) return

    let telegramUser: any = null
    let chatId: number = 0

    if (update.message) {
      telegramUser = update.message.from
      chatId = update.message.chat.id
    } else if (update.callback_query) {
      telegramUser = update.callback_query.from
      chatId = update.callback_query.message?.chat?.id
    }

    if (!telegramUser || !chatId) return

    const botUser = await getOrCreateBotUser(bot.id, telegramUser)

    if (botUser.isBanned) return

    // ── Captcha verification (one-time for each new user) ──────────────────────
    const captchaDoneKey = `captcha_done:${bot.id}:${botUser.id}`
    const captchaDone = await redisGet(captchaDoneKey)

    if (!captchaDone) {
      const captchaPendingKey = `captcha_pending:${botUser.id}`
      const captchaRaw = await redisGet(captchaPendingKey)

      if (!captchaRaw) {
        // First interaction — issue challenge
        const { question, answer } = makeCaptcha()
        await redisSet(captchaPendingKey, JSON.stringify({ answer, attempts: 0 }), 300)
        await sendMessage(
          bot.botToken, chatId,
          `👋 <b>Human Verification</b>\n\nBefore you can use this bot, please solve:\n\n🔐 <b>${question}</b>\n\n<i>Reply with just the number.</i>`
        )
        return
      }

      // Captcha pending — evaluate user's reply
      const { answer, attempts } = JSON.parse(captchaRaw)
      const incomingText = update.message?.text?.trim() || ''
      const userAnswer = parseInt(incomingText, 10)

      if (!isNaN(userAnswer) && userAnswer === answer) {
        // ✅ Passed
        await redisDel(captchaPendingKey)
        await redisSet(captchaDoneKey, '1', 31536000) // remember for 1 year
        await sendMessage(bot.botToken, chatId, '✅ Verified! Welcome.')
        await handleStart(bot, botUser, chatId)
        return
      } else if (incomingText && !incomingText.startsWith('/')) {
        // ❌ Wrong answer
        const newAttempts = attempts + 1
        if (newAttempts >= 3) {
          await redisDel(captchaPendingKey)
          await sendMessage(bot.botToken, chatId, '❌ Verification failed. Send /start to try again.')
          return
        }
        const { question: q2, answer: a2 } = makeCaptcha()
        await redisSet(captchaPendingKey, JSON.stringify({ answer: a2, attempts: newAttempts }), 300)
        await sendMessage(
          bot.botToken, chatId,
          `❌ Incorrect. ${3 - newAttempts} attempt(s) remaining.\n\n🔐 <b>${q2}</b>`
        )
        return
      } else {
        // Command or callback while captcha pending
        await sendMessage(bot.botToken, chatId, '🔐 Please answer the verification question first.')
        return
      }
    }

    // ── Channel membership check (supports single + multi-channel) ─────────────
    if (bot.settings?.requireChannelJoin && !botUser.channelVerified) {
      const channels: Array<{ id: string; username?: string }> = []

      if (bot.settings.requiredChannels) {
        try {
          const parsed = typeof bot.settings.requiredChannels === 'string'
            ? JSON.parse(bot.settings.requiredChannels as string)
            : bot.settings.requiredChannels
          if (Array.isArray(parsed)) channels.push(...parsed)
        } catch {}
      }

      // Fall back to legacy single-channel fields
      if (channels.length === 0 && bot.settings.requiredChannelId) {
        channels.push({
          id: bot.settings.requiredChannelId,
          username: bot.settings.requiredChannelUsername || undefined
        })
      }

      if (channels.length > 0) {
        const unverified: typeof channels = []
        for (const ch of channels) {
          const isMember = await checkChannelMembership(ch.id, telegramUser.id)
          if (!isMember) unverified.push(ch)
        }

        if (unverified.length === 0) {
          await prisma.botUser.update({ where: { id: botUser.id }, data: { channelVerified: true } })
        } else {
          const buttons = unverified.map((ch, i) => {
            const link = ch.username
              ? `https://t.me/${ch.username.replace('@', '')}`
              : `https://t.me/${ch.id.replace('-100', '')}`
            return [{ text: `📢 Join Channel${unverified.length > 1 ? ` ${i + 1}` : ''}`, url: link }]
          })
          await sendMessage(
            bot.botToken, chatId,
            `⚠️ <b>Channel Membership Required</b>\n\nJoin ${unverified.length > 1 ? 'all channels' : 'our channel'} to use this bot, then send /start again.`,
            { inline_keyboard: buttons }
          )
          return
        }
      }
    }

    // ── State machine: awaiting user text input ────────────────────────────────
    if (update.message?.text) {
      const text = update.message.text.trim()

      if (!text.startsWith('/')) {
        // Withdrawal address
        const withdrawState = await redisGet('withdraw_state:' + botUser.id)
        if (withdrawState === 'awaiting_address') {
          await redisDel('withdraw_state:' + botUser.id)
          await processWithdrawal(bot, botUser, text, chatId)
          return
        }

        // Deposit TX hash
        const depositState = await redisGet('deposit_state:' + botUser.id)
        if (depositState === 'awaiting_txhash') {
          await redisDel('deposit_state:' + botUser.id)
          const { verifyAndCreditDeposit } = await import('./payments/trongrid')
          await verifyAndCreditDeposit(bot, botUser, text, chatId)
          return
        }
      }

      // ── Route messages ───────────────────────────────────────────────────────
      logger.info('Routing message', { text: text.split(' ')[0], botId: bot.id })

      // Reply keyboard button presses
      if (text === '💰 Balance') {
        if (bot.settings?.balanceEnabled) await handleBalance(bot, botUser, chatId)
        return
      }
      if (text === '📥 Deposit') {
        if (bot.settings?.depositEnabled) await handleDeposit(bot, botUser, chatId)
        return
      }
      if (text === '📤 Withdraw') {
        if (bot.settings?.withdrawEnabled) await handleWithdraw(bot, botUser, chatId)
        return
      }
      if (text === '🎁 Bonus') {
        await handleBonus(bot, botUser, chatId)
        return
      }
      if (text === '👥 Referral') {
        await handleReferralInfo(bot, botUser, chatId)
        return
      }
      if (text === '❓ Help' || text === '📋 Menu') {
        await handleHelp(bot, chatId)
        return
      }

      // Slash commands
      if (text.startsWith('/start')) {
        const startParam = (text.split(' ')[1] || '').trim()
        if (startParam.startsWith('ref_') && !botUser.referredBy) {
          await handleReferral(bot, botUser, startParam.replace('ref_', ''), chatId)
        }
        await handleStart(bot, botUser, chatId)
      } else if (text.startsWith('/balance')) {
        if (bot.settings?.balanceEnabled) await handleBalance(bot, botUser, chatId)
      } else if (text.startsWith('/deposit')) {
        if (bot.settings?.depositEnabled && (bot.settings?.oxapayMerchantKey || bot.settings?.faucetpayApiKey)) {
          await handleDeposit(bot, botUser, chatId)
        }
      } else if (text.startsWith('/withdraw')) {
        if (bot.settings?.withdrawEnabled) await handleWithdraw(bot, botUser, chatId)
      } else if (text.startsWith('/help')) {
        await handleHelp(bot, chatId)
      } else if (text.startsWith('/bonus')) {
        await handleBonus(bot, botUser, chatId)
      } else if (text.startsWith('/referral')) {
        await handleReferralInfo(bot, botUser, chatId)
      } else if (text.startsWith('/')) {
        const handled = await handleCustomCommand(bot, botUser, chatId, text)
        if (!handled) logger.debug('Unrecognised command', { text: text.split(' ')[0] })
      } else {
        // Plain text — try auto-reply match
        await handleCustomCommand(bot, botUser, chatId, text)
      }
    }

    // ── Callback query (inline button press) ──────────────────────────────────
    if (update.callback_query) {
      const data = update.callback_query.data
      const cbChatId = update.callback_query.message?.chat?.id

      try {
        await axios.post(
          `https://api.telegram.org/bot${bot.botToken}/answerCallbackQuery`,
          { callback_query_id: update.callback_query.id }
        )
      } catch {}

      if (data === 'cmd_balance') {
        if (bot.settings?.balanceEnabled) await handleBalance(bot, botUser, cbChatId)
      } else if (data === 'cmd_start') {
        await handleStart(bot, botUser, cbChatId)
      } else if (data === 'cmd_deposit') {
        if (bot.settings?.depositEnabled && (bot.settings?.oxapayMerchantKey || bot.settings?.faucetpayApiKey)) {
          await handleDeposit(bot, botUser, cbChatId)
        }
      } else if (data === 'cmd_withdraw') {
        if (bot.settings?.withdrawEnabled) await handleWithdraw(bot, botUser, cbChatId)
      } else if (data === 'cmd_help') {
        await handleHelp(bot, cbChatId)
      } else if (data === 'cmd_menu') {
        await handleHelp(bot, cbChatId)
      } else if (data === 'cmd_bonus') {
        await handleBonus(bot, botUser, cbChatId)
      } else if (data === 'cmd_referral') {
        await handleReferralInfo(bot, botUser, cbChatId)
      } else if (data === 'cmd_consent_agree') {
        await prisma.botUser.update({ where: { id: botUser.id }, data: { adConsent: true } })
        await handleStart(bot, { ...botUser, adConsent: true }, cbChatId)
      } else if (data === 'cmd_cancel_deposit') {
        await redisDel('oxapay_invoice:' + bot.id + ':' + botUser.id)
        await sendMessage(
          bot.botToken, cbChatId,
          '✅ Deposit cancelled.',
          {
            keyboard: [
              [{ text: '💰 Balance' }, { text: '📥 Deposit' }],
              [{ text: '📤 Withdraw' }, { text: '🎁 Bonus' }],
              [{ text: '👥 Referral' }, { text: '❓ Help' }]
            ],
            resize_keyboard: true,
            persistent: true,
            one_time_keyboard: false
          }
        )
      } else if (data === 'cmd_check_deposit') {
        await sendMessage(
          bot.botToken, cbChatId,
          '⏳ Your deposit is being monitored automatically.\n\nYou will receive a notification as soon as it is confirmed.\n\nThis usually takes 1-3 minutes after sending.'
        )
      } else if (data?.startsWith('custom_')) {
        await handleCustomCommand(bot, botUser, cbChatId, data.replace('custom_', ''))
      }
    }

    await maybeServeAd(bot, botUser, chatId)

  } catch (error: any) {
    logger.error('handleWebhook error', { error: error.message, stack: error.stack })
  }
}
