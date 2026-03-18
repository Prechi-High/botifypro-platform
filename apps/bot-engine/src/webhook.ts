import axios from 'axios'
import { prisma } from '@botifypro/database'
import { handleBalance, handleDeposit, handleHelp, handleStart, handleWithdraw, sendMessage } from './commands'
import { redisDel, redisGet, redisIncr, redisSet } from './redis'
import { maybeServeAd } from './ads'
import { processOxapayWithdrawal } from './payments/oxapay'
import logger from './logger'

export async function getOrCreateBotUser(botId: string, telegramUser: any) {
  return await prisma.botUser.upsert({
    where: {
      botId_telegramUserId: { botId, telegramUserId: BigInt(telegramUser.id) }
    },
    create: {
      botId,
      telegramUserId: BigInt(telegramUser.id),
      telegramUsername: telegramUser.username || null,
      firstName: telegramUser.first_name || 'User'
    },
    update: {
      lastActive: new Date(),
      telegramUsername: telegramUser.username || null
    }
  })
}

export async function checkChannelMembership(channelId: string, telegramUserId: number) {
  try {
    const resp = await axios.get(
      `https://api.telegram.org/bot${process.env.PLATFORM_BOT_TOKEN}/getChatMember?chat_id=${channelId}&user_id=${telegramUserId}`
    )
    const status = resp.data?.result?.status
    return status === 'member' || status === 'administrator' || status === 'creator'
  } catch {
    return false
  }
}

export async function processWithdrawal(bot: any, botUser: any, address: string, chatId: number) {
  if (!address || address.length < 20) {
    await sendMessage(bot.botToken, chatId, 'Invalid address. Please try again.')
    return
  }
  const usdAmount = Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)
  if (usdAmount < Number(bot.settings.minWithdrawUsd)) {
    await sendMessage(bot.botToken, chatId, '❌ Insufficient balance.\n\nMinimum withdrawal: $' + bot.settings.minWithdrawUsd + ' USD')
    return
  }
  await sendMessage(bot.botToken, chatId, '⏳ Processing withdrawal... Please wait.')
  await processOxapayWithdrawal(bot, botUser, address, chatId)
}

export async function handleWebhook(req: any, res: any) {
  res.status(200).json({ ok: true })
  try {
    const botToken = req.params.botToken
    const update = req.body

    const bot = await prisma.bot.findUnique({
      where: { botToken },
      include: { settings: true }
    })
    if (!bot || !bot.isActive) {
      logger.warn('Bot not found for token', { token: String(botToken).substring(0, 8) + '****' })
      return
    }

    const telegramUser = update?.message?.from || update?.callback_query?.from
    const chatId = update?.message?.chat?.id || update?.callback_query?.message?.chat?.id
    if (!telegramUser || !chatId) return

    const botUser = await getOrCreateBotUser(bot.id, telegramUser)
    if (botUser.isBanned) return

    if (bot.settings?.requireChannelJoin && bot.settings?.requiredChannelId) {
      if (!botUser.channelVerified) {
        const member = await checkChannelMembership(bot.settings.requiredChannelId, telegramUser.id)
        logger.info('Channel check', { botId: bot.id, userId: botUser.id, result: member })
        if (member) {
          await prisma.botUser.update({ where: { id: botUser.id }, data: { channelVerified: true } })
        } else {
          const usernameOrId = bot.settings.requiredChannelUsername || bot.settings.requiredChannelId
          const username = bot.settings.requiredChannelUsername?.replace('@', '')
          await sendMessage(
            bot.botToken,
            chatId,
            '⚠️ Please join our channel first!\n\n' + usernameOrId,
            {
              inline_keyboard: [
                [
                  {
                    text: 'Join Channel',
                    url: 'https://t.me/' + (username || '')
                  }
                ]
              ]
            }
          )
          return
        }
      }
    }

    const withdrawState = await redisGet('withdraw_state:' + botUser.id)
    if (
      withdrawState === 'awaiting_address' &&
      update.message?.text &&
      !update.message.text.startsWith('/')
    ) {
      await redisDel('withdraw_state:' + botUser.id)
      await processWithdrawal(bot, botUser, update.message.text, chatId)
      return
    }

    const text = update.message?.text || ''
    const callback = update.callback_query?.data

    if (update.callback_query) {
      try {
        await axios.post(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
          callback_query_id: update.callback_query.id
        })
      } catch {}
    }

    if (text.startsWith('/start') || callback === 'cmd_start') {
      logger.info('Command handled', { command: 'start', botId: bot.id, userId: botUser.id })
      await handleStart(bot, botUser, chatId)
    }
    if (text.startsWith('/balance') || callback === 'cmd_balance') {
      logger.info('Command handled', { command: 'balance', botId: bot.id, userId: botUser.id })
      await handleBalance(bot, botUser, chatId)
    }
    if (text.startsWith('/deposit') || callback === 'cmd_deposit') {
      logger.info('Command handled', { command: 'deposit', botId: bot.id, userId: botUser.id })
      await handleDeposit(bot, botUser, chatId)
    }
    if (text.startsWith('/withdraw') || callback === 'cmd_withdraw') {
      logger.info('Command handled', { command: 'withdraw', botId: bot.id, userId: botUser.id })
      await handleWithdraw(bot, botUser, chatId)
    }
    if (text.startsWith('/help') || callback === 'cmd_help') {
      logger.info('Command handled', { command: 'help', botId: bot.id, userId: botUser.id })
      await handleHelp(bot, chatId)
    }

    await maybeServeAd(bot, botUser, chatId)
  } catch (err: any) {
    logger.error('Webhook processing error', { error: err?.message })
    return
  }
}

