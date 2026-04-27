import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisDel } from './redis'
import {
  sendMessage, handleStart, handleBalance, handleDeposit,
  handleWithdraw, handleHelp, handleBonus, handleReferralInfo, handleLeaderboard
} from './commands'
import { maybeServeAd } from './ads'
import { handleReferral } from './referral'

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

export async function checkChannelMembership(channelId: string, telegramUserId: number, botToken: string): Promise<boolean> {
  try {
    const response = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      { params: { chat_id: channelId, user_id: telegramUserId } }
    )
    const status = response.data?.result?.status
    return ['member', 'administrator', 'creator', 'restricted'].includes(status)
  } catch (error: any) {
    logger.error('checkChannelMembership failed', { error: error.message, channelId })
    return false
  }
}

export async function processWithdrawal(bot: any, botUser: any, address: string, chatId: number) {
  if (!bot.settings?.manualWithdrawal) {
    if (!address || !address.startsWith('T') || address.length !== 34 || !/^[A-Za-z0-9]{34}$/.test(address)) {
      await sendMessage(bot.botToken, chatId,
        '❌ Invalid TRC20 address.\n\nA valid address starts with T and is exactly 34 characters.\n\nPlease try again with a valid TRX address.'
      )
      return
    }
  } else {
    if (!address || address.length < 10) {
      await sendMessage(bot.botToken, chatId, '❌ Invalid address. Please try again.')
      return
    }
  }

  const usdAmount = Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)
  if (usdAmount < Number(bot.settings.minWithdrawUsd)) {
    await sendMessage(bot.botToken, chatId,
      '❌ Insufficient balance for withdrawal.'
    )
    return
  }

  const feePercent = Number(bot.settings.withdrawFeePercent || 0)
  const feeUsd = usdAmount * (feePercent / 100)
  const netUsd = usdAmount - feeUsd
  const currencyAmount = Number(botUser.balance)
  const sym = bot.settings.currencySymbol || '🪙'
  const currencyName = bot.settings.currencyName || 'coins'
  const gateway = bot.settings.manualWithdrawal ? 'manual' : 'oxapay'

  await prisma.$transaction([
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

  const note = bot.settings.manualWithdrawal
    ? '⏳ Will be processed manually by bot owner within 24-48 hours.'
    : '⏳ Processing automatically. You will be notified when complete.'

  await sendMessage(bot.botToken, chatId,
    `✅ <b>Withdrawal Submitted</b>\n\n` +
    `Amount: ${currencyAmount} ${sym} (${currencyName})\n` +
    `≈ $${netUsd.toFixed(4)} USD\n` +
    `Address: <code>${address}</code>\n\n${note}`
  )
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

async function showChannelGate(bot: any, chatId: number, unverified: Array<{ id: string; username?: string; title?: string }>) {
  const joinButtons: any[] = unverified.map((ch, i) => {
    const link = ch.username
      ? `https://t.me/${ch.username.replace('@', '')}`
      : `https://t.me/${String(ch.id).replace('-100', '')}`
    return [{ text: `📢 Join ${ch.title || ch.username || `Channel ${i + 1}`}`, url: link }]
  })
  joinButtons.push([{ text: "✅ I've Joined All — Check Now", callback_data: 'cmd_check_channel' }])
  await sendMessage(
    bot.botToken, chatId,
    `📢 <b>Join Required Channels</b>\n\n` +
    `Please join ${unverified.length > 1 ? 'all channels' : 'the channel'} below to use this bot:`,
    { inline_keyboard: joinButtons }
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

    const botUser = await getOrCreateBotUser(bot.id, telegramUser)
    if (botUser.isBanned) return

    // ── CAPTCHA GATE ──────────────────────────────────────────────────────────
    if (bot.settings?.captchaEnabled) {
      const captchaDoneKey = `captcha_done:${bot.id}:${botUser.id}`
      const captchaDone = await redisGet(captchaDoneKey)

      if (!captchaDone) {
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

          await sendMessage(bot.botToken, chatId, '✅ Verified! Welcome.')
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
        if (withdrawState === 'awaiting_address') {
          await redisDel('withdraw_state:' + botUser.id)
          await processWithdrawal(bot, botUser, text, chatId)
          return
        }

        const depositState = await redisGet('deposit_state:' + botUser.id)
        if (depositState === 'awaiting_txhash') {
          await redisDel('deposit_state:' + botUser.id)
          const { verifyAndCreditDeposit } = await import('./payments/trongrid')
          await verifyAndCreditDeposit(bot, botUser, text, chatId)
          return
        }
      }

      logger.info('Routing command', { command: text.split(' ')[0], botId: bot.id })

      if (text === '💰 Balance') { await handleBalance(bot, botUser, chatId); return }
      if (text === '🔗 Referral') { await handleReferralInfo(bot, botUser, chatId); return }
      if (text === '📤 Withdraw') { await handleWithdraw(bot, botUser, chatId); return }
      if (text === '🎁 Daily Bonus') { await handleBonus(bot, botUser, chatId); return }
      if (text === '🏆 Leaderboard') { await handleLeaderboard(bot, botUser, chatId); return }
      if (text === '📥 Deposit') { await handleDeposit(bot, botUser, chatId); return }
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
