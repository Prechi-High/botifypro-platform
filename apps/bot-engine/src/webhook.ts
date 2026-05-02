import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisDel } from './redis'
import {
  sendMessage, handleStart, handleBalance, handleDeposit,
  handleWithdraw, handleWithdrawAmountSelected, handleHelp, handleBonus, handleReferralInfo, handleLeaderboard,
  handleProPlan, handleProBonus
} from './commands'
import { maybeServeAd } from './ads'
import { handleReferral } from './referral'
import {
  executeFaucetPayPayout,
  executeOxapayPayout,
  getWithdrawProvider,
  validateWithdrawalDestination,
} from './payments/payouts'

export async function getOrCreateBotUser(botId: string, telegramUser: any) {
  try {
    const telegramUserId = BigInt(telegramUser.id)
    const existing = await prisma.botUser.findUnique({
      where: { botId_telegramUserId: { botId, telegramUserId } }
    })
    if (existing) {
      await prisma.botUser.update({
        where: { id: existing.id },
        data: { lastActive: new Date(), telegramUsername: telegramUser.username || existing.telegramUsername }
      })
      return existing
    }
    const newUser = await prisma.botUser.create({
      data: {
        botId, telegramUserId,
        telegramUsername: telegramUser.username || null,
        firstName: telegramUser.first_name || 'User',
        balance: 0, channelVerified: false, isBanned: false
      }
    })
    logger.info('New bot user created', { botId, telegramUserId: telegramUser.id, firstName: telegramUser.first_name })
    return newUser
  } catch (error: any) {
    logger.error('getOrCreateBotUser failed', { error: error.message })
    throw error
  }
}

export async function checkChannelMembership(
  channelId: string,
  telegramUserId: number,
  botToken: string
): Promise<boolean> {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      { params: { chat_id: channelId, user_id: telegramUserId } }
    )
    const status = response.data?.result?.status
    logger.info('Channel membership check', { channelId, telegramUserId, status })
    return ['member', 'administrator', 'creator', 'restricted'].includes(status)
  } catch (error: any) {
    const description = error.response?.data?.description || ''
    logger.error('checkChannelMembership failed', {
      error: description || error.message,
      channelId
    })
    // Return false - if we can't check, assume not member
    // Bot MUST be admin in channel for this to work
    return false
  }
}

export async function processWithdrawal(bot: any, botUser: any, address: string, chatId: number, withdrawAmount?: number) {
  const validationError = validateWithdrawalDestination(bot.settings, address)
  if (validationError) {
    await sendMessage(bot.botToken, chatId, validationError)
    return
  }

  // Use the specified amount or fall back to full balance
  const currencyAmount = withdrawAmount !== undefined ? withdrawAmount : Number(botUser.balance)
  const usdAmount = currencyAmount / Number(bot.settings.usdToCurrencyRate)

  if (usdAmount < Number(bot.settings.minWithdrawUsd)) {
    await sendMessage(bot.botToken, chatId, '❌ Insufficient balance for withdrawal.')
    return
  }

  const feePercent = Number(bot.settings.withdrawFeePercent || 0)
  const feeUsd = usdAmount * (feePercent / 100)
  const netUsd = usdAmount - feeUsd
  const sym = bot.settings.currencySymbol || '🪙'
  const currencyName = bot.settings.currencyName || 'coins'
  const gateway = getWithdrawProvider(bot.settings)

  const [tx] = await prisma.$transaction([
    prisma.transaction.create({
      data: {
        botId: bot.id, botUserId: botUser.id, type: 'withdrawal',
        amountCurrency: currencyAmount, amountUsd: usdAmount,
        status: 'pending', gateway, withdrawAddress: address,
        platformFeeAmount: feeUsd
      }
    }),
    prisma.botUser.update({
      where: { id: botUser.id },
      data: { balance: { decrement: currencyAmount } }
    })
  ])

  // Save address for future withdrawals (stored in telegramUsername field is wrong — use a Redis key)
  // We store it in Redis keyed by botUser.id so it persists across sessions
  await import('./redis').then(r => r.redisSet(`withdraw_saved_address:${botUser.id}`, address, 60 * 60 * 24 * 90))

  if (gateway === 'manual') {
    await sendMessage(bot.botToken, chatId,
      `✅ <b>Withdrawal Submitted</b>\n\n` +
      `Amount: ${currencyAmount} ${sym} ${currencyName}\n` +
      `≈ $${netUsd.toFixed(4)} USD\n` +
      `Address: <code>${address}</code>\n\n⏳ Will be processed manually by bot owner within 24-48 hours.`
    )
    return
  }

  try {
    const payout = gateway === 'oxapay'
      ? await executeOxapayPayout(bot.settings, address, netUsd)
      : await executeFaucetPayPayout(bot.settings, address, netUsd)

    await prisma.transaction.update({
      where: { id: tx.id },
      data: {
        gateway: payout.gateway,
        gatewayTxId: payout.gatewayTxId,
        status: payout.status,
      },
    })

    const statusLine = payout.status === 'completed'
      ? '✅ Payout sent successfully.'
      : '⏳ Payout is being processed.'

    await sendMessage(bot.botToken, chatId,
      `✅ <b>Withdrawal Submitted</b>\n\n` +
      `Amount: ${currencyAmount} ${sym} ${currencyName}\n` +
      `≈ $${netUsd.toFixed(4)} USD\n` +
      `Payout: <b>${payout.payoutAmount.toFixed(4)} ${payout.payoutCurrency}</b>\n` +
      `Destination: <code>${address}</code>\n\n${statusLine}`
    )
  } catch (error: any) {
    await prisma.$transaction([
      prisma.transaction.update({
        where: { id: tx.id },
        data: {
          status: 'failed',
          gatewayTxId: `failed:${String(error?.message || 'unknown').slice(0, 120)}`,
        },
      }),
      prisma.botUser.update({
        where: { id: botUser.id },
        data: { balance: { increment: currencyAmount } },
      }),
    ])

    await sendMessage(bot.botToken, chatId,
      `❌ <b>Withdrawal failed</b>\n\n` +
      `We could not send your payout right now, so your ${sym} balance has been restored.\n\n` +
      `Reason: ${error?.message || 'Unknown error'}`
    )
  }
}

async function getChannels(bot: any): Promise<Array<{ id: string; username?: string; title?: string }>> {
  const channels: Array<{ id: string; username?: string; title?: string }> = []
  if (bot.settings?.requiredChannels) {
    try {
      const parsed = typeof bot.settings.requiredChannels === 'string'
        ? JSON.parse(bot.settings.requiredChannels)
        : bot.settings.requiredChannels
      if (Array.isArray(parsed)) channels.push(...parsed)
    } catch {}
  }
  if (channels.length === 0 && bot.settings?.requiredChannelId) {
    channels.push({
      id: bot.settings.requiredChannelId,
      username: bot.settings.requiredChannelUsername || undefined
    })
  }
  return channels
}

async function showChannelGate(
  bot: any,
  chatId: number,
  unverified: Array<{ id: string; username?: string; title?: string }>
) {
  const channelRows: any[][] = []
  for (let i = 0; i < unverified.length; i += 2) {
    const row: any[] = []
    const ch1 = unverified[i]
    const link1 = ch1.username
      ? `https://t.me/${ch1.username.replace('@', '')}`
      : `https://t.me/${String(ch1.id).replace('-100', '')}`
    row.push({ text: `📢 ${ch1.title || ch1.username || 'Channel'}`, url: link1 })
    if (i + 1 < unverified.length) {
      const ch2 = unverified[i + 1]
      const link2 = ch2.username
        ? `https://t.me/${ch2.username.replace('@', '')}`
        : `https://t.me/${String(ch2.id).replace('-100', '')}`
      row.push({ text: `📢 ${ch2.title || ch2.username || 'Channel'}`, url: link2 })
    }
    channelRows.push(row)
  }
  channelRows.push([{ text: "✅ I've Joined All — Check Now", callback_data: 'cmd_check_channel' }])

  await sendMessage(
    bot.botToken, chatId,
    `📢 <b>Join Required Channels</b>\n\n` +
    `Please join ${unverified.length > 1 ? 'all ' + unverified.length + ' channels' : 'the channel'} below:`,
    { inline_keyboard: channelRows }
  )
}

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

    await getOrCreateBotUser(bot.id, telegramUser)
    const botUser = await prisma.botUser.findUnique({
      where: { botId_telegramUserId: {
        botId: bot.id,
        telegramUserId: BigInt(telegramUser.id)
      }}
    })
    if (!botUser) return
    if (botUser.isBanned) return

    // ── CAPTCHA GATE ──────────────────────────────────────────────────────────
    if (bot.settings?.captchaEnabled) {
      const captchaDoneKey = `captcha_done:${bot.id}:${botUser.id}`
      const captchaDone = await redisGet(captchaDoneKey)

      if (!captchaDone) {
        // Allow callback queries to pass through only if it's
        // a captcha-related callback (none exist, so block all callbacks)
        if (update.callback_query) {
          try {
            await axios.post(
              `https://api.telegram.org/bot${bot.botToken}/answerCallbackQuery`,
              { callback_query_id: update.callback_query.id, text: '🔐 Complete verification first' }
            )
          } catch {}
          return
        }

        const captchaPendingKey = `captcha_pending:${bot.id}:${botUser.id}`
        const captchaRaw = await redisGet(captchaPendingKey)

        if (!captchaRaw) {
          const answer = Math.floor(Math.random() * 90) + 10
          await redisSet(captchaPendingKey, JSON.stringify({ answer, attempts: 0 }), 300)
          await sendMessage(
            bot.botToken, chatId,
            `👋 <b>Quick Verification</b>\n\nType the number shown below to continue:\n\n` +
            `🔢 <b>${answer}</b>\n\n<i>Just type the number exactly as shown.</i>`
          )
          return
        }

        const { answer, attempts } = JSON.parse(captchaRaw)
        const incomingText = update.message?.text?.trim() || ''
        const userAnswer = parseInt(incomingText, 10)

        if (!isNaN(userAnswer) && userAnswer === answer) {
          await redisDel(captchaPendingKey)
          await redisSet(captchaDoneKey, '1', 31536000)
          logger.info('Captcha passed', { botId: bot.id, userId: botUser.id })

          // Check if channels also need to be completed before crediting referral
          const channels = await getChannels(bot)
          const needsChannels = bot.settings?.requireChannelJoin && channels.length > 0 && !botUser.channelVerified

          if (!needsChannels) {
            const pendingRef = await redisGet(`pending_referral:${botUser.id}`)
            if (pendingRef) {
              await redisDel(`pending_referral:${botUser.id}`)
              await handleReferral(bot, botUser, pendingRef, chatId)
            }
          }

          await sendMessage(bot.botToken, chatId, '✅ Verified!')
          const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } })
          await handleStart(bot, freshUser || botUser, chatId)
          return
        } else if (incomingText && !incomingText.startsWith('/')) {
          const newAttempts = attempts + 1
          if (newAttempts >= 3) {
            await redisDel(captchaPendingKey)
            await sendMessage(bot.botToken, chatId, '❌ Too many wrong attempts. Send /start to try again.')
            return
          }
          const newAnswer = Math.floor(Math.random() * 90) + 10
          await redisSet(captchaPendingKey, JSON.stringify({ answer: newAnswer, attempts: newAttempts }), 300)
          await sendMessage(
            bot.botToken, chatId,
            `❌ Wrong answer. ${3 - newAttempts} attempt(s) remaining.\n\n🔢 <b>${newAnswer}</b>`
          )
          return
        } else {
          if (update.message?.text) {
            await sendMessage(bot.botToken, chatId,
              '🔐 Please complete verification first. Type the number shown above.'
            )
          }
          return
        }
      }
    }

    // ── CHANNEL GATE ──────────────────────────────────────────────────────────
    if (bot.settings?.requireChannelJoin && !botUser.channelVerified) {
      const channels = await getChannels(bot)

      if (channels.length > 0) {
        // Allow cmd_check_channel callback through, block everything else
        if (update.callback_query && update.callback_query.data !== 'cmd_check_channel') {
          try {
            await axios.post(
              `https://api.telegram.org/bot${bot.botToken}/answerCallbackQuery`,
              { callback_query_id: update.callback_query.id, text: '📢 Join required channels first' }
            )
          } catch {}
          return
        }

        const unverified: typeof channels = []
        for (const ch of channels) {
          const isMember = await checkChannelMembership(ch.id, Number(telegramUser.id), bot.botToken)
          if (!isMember) unverified.push(ch)
        }

        if (unverified.length === 0) {
          await prisma.botUser.update({ where: { id: botUser.id }, data: { channelVerified: true } })

          const pendingRef = await redisGet(`pending_referral:${botUser.id}`)
          if (pendingRef) {
            await redisDel(`pending_referral:${botUser.id}`)
            const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } })
            await handleReferral(bot, freshUser || botUser, pendingRef, chatId)
          }

          const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } })
          await handleStart(bot, freshUser || botUser, chatId)
          return
        } else {
          await showChannelGate(bot, chatId, unverified)
          return
        }
      }
    }

    // ── MESSAGE HANDLING ──────────────────────────────────────────────────────
    if (update.message?.text) {
      const text = update.message.text.trim()

      if (!text.startsWith('/')) {
        const withdrawState = await redisGet('withdraw_state:' + botUser.id)

        // If user is in withdrawal flow but sends a non-address message that looks like a command button
        // (e.g. taps Balance, Referral etc.) — cancel the withdrawal
        const isMenuButton = ['💰 Balance', '🔗 Referral', '📤 Withdraw', '🎁 Daily Bonus',
          '🏆 Leaderboard', '📥 Deposit', '❓ Help', '📋 Menu'].includes(text)

        if (withdrawState && isMenuButton) {
          await redisDel('withdraw_state:' + botUser.id)
          await redisDel('withdraw_amount:' + botUser.id)
          // Fall through to handle the button normally below
        } else if (withdrawState === 'awaiting_amount') {
          // Extract any number from the user's free text
          const match = text.match(/[\d,]+(\.\d+)?/)
          const parsed = match ? parseFloat(match[0].replace(/,/g, '')) : NaN

          if (isNaN(parsed) || parsed <= 0) {
            await sendMessage(bot.botToken, chatId,
              `❌ Couldn't find a valid number in your message.\n\nPlease type the amount, e.g. <code>500</code> or <code>50 coins</code>.`
            )
            return
          }

          const balance = Number(botUser.balance)
          const rate = Number(bot.settings?.usdToCurrencyRate || 1000)
          const minWithdrawUsd = Number(bot.settings?.minWithdrawUsd || 0.5)
          const minWithdrawCurrency = minWithdrawUsd * rate
          const sym = bot.settings?.currencySymbol || '🪙'

          if (parsed > balance) {
            await sendMessage(bot.botToken, chatId,
              `❌ Insufficient balance.\n\nYou entered: <b>${parsed.toLocaleString()} ${sym}</b>\nYour balance: <b>${balance.toFixed(0)} ${sym}</b>\n\nPlease enter a smaller amount.`
            )
            return
          }

          if (parsed < minWithdrawCurrency) {
            await sendMessage(bot.botToken, chatId,
              `❌ Amount too low.\n\nMinimum withdrawal: <b>${minWithdrawCurrency.toFixed(0)} ${sym}</b>\nYou entered: <b>${parsed.toLocaleString()} ${sym}</b>`
            )
            return
          }

          await handleWithdrawAmountSelected(bot, botUser, chatId, Math.floor(parsed))
          return
        } else if (withdrawState === 'awaiting_address') {
          await redisDel('withdraw_state:' + botUser.id)
          const savedAmount = await redisGet('withdraw_amount:' + botUser.id)
          await redisDel('withdraw_amount:' + botUser.id)
          const amount = savedAmount ? Number(savedAmount) : Number(botUser.balance)
          await processWithdrawal(bot, botUser, text, chatId, amount)
          return
        }

        const depositState = await redisGet('deposit_state:' + botUser.id)
        if (depositState === 'awaiting_txhash') {
          await redisDel('deposit_state:' + botUser.id)
          const { verifyAndCreditDeposit } = await import('./payments/trongrid')
          await verifyAndCreditDeposit(bot, botUser, text, chatId)
          return
        }
      } else {
        // User sent a slash command while in withdrawal flow — cancel it
        const withdrawState = await redisGet('withdraw_state:' + botUser.id)
        if (withdrawState) {
          await redisDel('withdraw_state:' + botUser.id)
          await redisDel('withdraw_amount:' + botUser.id)
        }
      }

      logger.info('Routing command', { command: text.split(' ')[0], botId: bot.id })

      if (text === '💰 Balance') { await handleBalance(bot, botUser, chatId); return }
      if (text === '🔗 Referral') { await handleReferralInfo(bot, botUser, chatId); return }
      if (text === '📤 Withdraw') { await handleWithdraw(bot, botUser, chatId); return }
      if (text === '🎁 Daily Bonus') { await handleBonus(bot, botUser, chatId); return }
      if (text === '🏆 Leaderboard') { await handleLeaderboard(bot, botUser, chatId); return }
      if (text === '📥 Deposit') { await handleDeposit(bot, botUser, chatId); return }
      if (text === '⭐ VIP Plan') { await handleProPlan(bot, botUser, chatId); return }
      // Handle custom investment button label set by bot creator
      const investLabel = (bot.settings as any)?.proPlanButtonLabel
      if (investLabel && text === investLabel) { await handleProPlan(bot, botUser, chatId); return }
      if (text === '💎 Invest') { await handleProPlan(bot, botUser, chatId); return }
      if (text === '❓ Help' || text === '📋 Menu') { await handleHelp(bot, chatId); return }

      if (text.startsWith('/start')) {
        const startParam = (text.split(' ')[1] || '').trim()
        if (startParam.startsWith('ref_') && !botUser.referredBy) {
          const referrerId = startParam.replace('ref_', '')
          const captchaDoneKey = `captcha_done:${bot.id}:${botUser.id}`
          const captchaDone = await redisGet(captchaDoneKey)
          const needsCaptcha = bot.settings?.captchaEnabled && !captchaDone
          const channels = await getChannels(bot)
          const needsChannels = bot.settings?.requireChannelJoin && channels.length > 0 && !botUser.channelVerified

          if (needsCaptcha || needsChannels) {
            await redisSet(`pending_referral:${botUser.id}`, referrerId, 86400)
          } else {
            await handleReferral(bot, botUser, referrerId, chatId)
          }
        }
        await handleStart(bot, botUser, chatId)
      } else if (text.startsWith('/balance')) {
        await handleBalance(bot, botUser, chatId)
      } else if (text.startsWith('/withdraw')) {
        await handleWithdraw(bot, botUser, chatId)
      } else if (text.startsWith('/deposit')) {
        await handleDeposit(bot, botUser, chatId)
      } else if (text.startsWith('/bonus')) {
        await handleBonus(bot, botUser, chatId)
      } else if (text.startsWith('/referral') || text.startsWith('/ref')) {
        await handleReferralInfo(bot, botUser, chatId)
      } else if (text.startsWith('/leaderboard')) {
        await handleLeaderboard(bot, botUser, chatId)
      } else if (text.startsWith('/help')) {
        await handleHelp(bot, chatId)
      } else if (text.startsWith('/')) {
        try {
          const lookup = text.split(' ')[0].toLowerCase()
          const customCommand = await prisma.botCommand.findFirst({
            where: { botId: bot.id, command: lookup, isActive: true }
          })
          if (customCommand) {
            await sendMessage(bot.botToken, chatId, customCommand.responseText)
          }
        } catch {}
      } else {
        try {
          const customCommand = await prisma.botCommand.findFirst({
            where: { botId: bot.id, command: text.toLowerCase().trim(), isActive: true }
          })
          if (customCommand) {
            await sendMessage(bot.botToken, chatId, customCommand.responseText)
          }
        } catch {}
      }
    }

    // ── CALLBACK QUERIES ──────────────────────────────────────────────────────
    if (update.callback_query) {
      const data = update.callback_query.data
      const cbChatId = update.callback_query.message?.chat?.id

      try {
        await axios.post(
          `https://api.telegram.org/bot${bot.botToken}/answerCallbackQuery`,
          { callback_query_id: update.callback_query.id }
        )
      } catch {}

      if (data === 'cmd_balance') { await handleBalance(bot, botUser, cbChatId) }
      else if (data === 'cmd_referral') { await handleReferralInfo(bot, botUser, cbChatId) }
      else if (data === 'cmd_withdraw') { await handleWithdraw(bot, botUser, cbChatId) }
      else if (data === 'cmd_deposit') { await handleDeposit(bot, botUser, cbChatId) }
      else if (data === 'cmd_bonus') { await handleBonus(bot, botUser, cbChatId) }
      else if (data === 'cmd_leaderboard') { await handleLeaderboard(bot, botUser, cbChatId) }
      else if (data === 'cmd_start') { await handleStart(bot, botUser, cbChatId) }
      else if (data === 'cmd_help' || data === 'cmd_menu') { await handleHelp(bot, cbChatId) }
      else if (data === 'cmd_pro_plan') { await handleProPlan(bot, botUser, cbChatId) }
      else if (data === 'cmd_pro_bonus') { await handleProBonus(bot, botUser, cbChatId) }
      else if (data === 'cmd_pro_deposit') {
        const settings = bot.settings as any
        if (!settings?.proOxapayConfigured || !settings?.proOxapayMerchantKey) {
          await sendMessage(bot.botToken, cbChatId, '❌ VIP deposit not configured. Contact bot owner.')
        } else {
          const minDeposit = Number(settings.proPlanDepositMin || 10)
          try {
            const response = await axios.post(
              'https://api.oxapay.com/v1/payment/white-label',
              {
                amount: minDeposit, currency: 'USD', pay_currency: 'USDT', network: 'TRC20',
                lifetime: 30, fee_paid_by_payer: 0, under_paid_coverage: 2,
                callback_url: `${process.env.WEBHOOK_BASE_URL}/webhooks/oxapay-pro/${bot.id}`,
                description: `VIP botId:${bot.id} userId:${botUser.id}`
              },
              { headers: { 'merchant_api_key': settings.proOxapayMerchantKey, 'Content-Type': 'application/json' } }
            )
            if (response.data?.status === 200) {
              const inv = response.data.data
              await redisSet(`pro_deposit:${bot.id}:${inv.track_id}`, JSON.stringify({ botUserId: botUser.id, chatId: cbChatId, botToken: bot.botToken }), 1800)
              await sendMessage(bot.botToken, cbChatId,
                `💳 <b>VIP Activation Deposit</b>\n\nSend exactly <b>${inv.pay_amount} USDT</b> to:\n<code>${inv.address}</code>\n\n🌐 Network: <b>TRC20</b>\n⏱ Expires in: <b>30 minutes</b>\n\n✅ VIP activates automatically once confirmed.`
              )
            } else {
              await sendMessage(bot.botToken, cbChatId, '❌ Could not generate deposit. Try again later.')
            }
          } catch {
            await sendMessage(bot.botToken, cbChatId, '❌ Deposit failed. Try again later.')
          }
        }
      }
      // Withdrawal amount selection — no longer used (amounts entered as free text)
      // kept for backward compat with any in-flight sessions
      // Use saved address
      else if (data === 'withdraw_use_saved') {
        const savedAddress = await redisGet(`withdraw_saved_address:${botUser.id}`)
        if (savedAddress) {
          const savedAmount = await redisGet('withdraw_amount:' + botUser.id)
          await redisDel('withdraw_state:' + botUser.id)
          await redisDel('withdraw_amount:' + botUser.id)
          const amount = savedAmount ? Number(savedAmount) : Number(botUser.balance)
          await processWithdrawal(bot, botUser, savedAddress, cbChatId, amount)
        } else {
          await sendMessage(bot.botToken, cbChatId, '❌ No saved address found. Please enter your address.')
        }
      }
      // Enter new address
      else if (data === 'withdraw_new_address') {
        const settings = bot.settings
        const provider = getWithdrawProvider(settings)
        const { getWithdrawalDestinationHint } = await import('./payments/payouts')
        const hint = getWithdrawalDestinationHint(settings)
        const addressLabel = provider === 'faucetpay'
          ? `📧 <b>FaucetPay is your payment method.</b>\n\nEnter your <b>FaucetPay email address</b> or a FaucetPay-linked wallet address to receive your payout:`
          : provider === 'oxapay'
            ? `💳 <b>OxaPay payout — USDT on TRC20 (Tron) network.</b>\n\nEnter your <b>USDT TRC20 wallet address</b>\n(starts with <b>T</b>, exactly 34 characters):`
            : `📝 Enter your payout address or account details:`
        await redisSet('withdraw_state:' + botUser.id, 'awaiting_address', 600)
        await sendMessage(bot.botToken, cbChatId,
          `${addressLabel}\n\n<i>${hint}</i>\n\n⏱ You have 10 minutes.`,
          { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]] }
        )
      }
      // Cancel withdrawal
      else if (data === 'cmd_cancel_withdraw') {
        await redisDel('withdraw_state:' + botUser.id)
        await redisDel('withdraw_amount:' + botUser.id)
        await sendMessage(bot.botToken, cbChatId, '✅ Withdrawal cancelled.')
        const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } })
        await handleStart(bot, freshUser || botUser, cbChatId)
      }
      else if (data === 'cmd_check_channel') {
        const channels = await getChannels(bot)
        const stillUnverified: typeof channels = []
        for (const ch of channels) {
          const isMember = await checkChannelMembership(ch.id, Number(telegramUser.id), bot.botToken)
          if (!isMember) stillUnverified.push(ch)
        }

        if (stillUnverified.length === 0) {
          await prisma.botUser.update({ where: { id: botUser.id }, data: { channelVerified: true } })

          const pendingRef = await redisGet(`pending_referral:${botUser.id}`)
          if (pendingRef) {
            await redisDel(`pending_referral:${botUser.id}`)
            const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } })
            await handleReferral(bot, freshUser || botUser, pendingRef, cbChatId)
          }

          const freshUser = await prisma.botUser.findUnique({ where: { id: botUser.id } })
          await handleStart(bot, freshUser || botUser, cbChatId)
        } else {
          await showChannelGate(bot, cbChatId, stillUnverified)
        }
      }
      else if (data === 'cmd_cancel_deposit') {
        await redisDel('deposit_state:' + botUser.id)
        await sendMessage(bot.botToken, cbChatId, '✅ Deposit cancelled.')
        await handleStart(bot, botUser, cbChatId)
      }
      else if (data?.startsWith('custom_')) {
        try {
          const lookup = data.replace('custom_', '')
          const customCommand = await prisma.botCommand.findFirst({
            where: { botId: bot.id, command: lookup, isActive: true }
          })
          if (customCommand) await sendMessage(bot.botToken, cbChatId, customCommand.responseText)
        } catch {}
      }
    }

    await maybeServeAd(bot, botUser, chatId)

  } catch (error: any) {
    logger.error('handleWebhook error', { error: error.message, stack: error.stack })
  }
}
