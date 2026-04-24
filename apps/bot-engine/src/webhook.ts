import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisDel } from './redis'
import { sendMessage, handleStart, handleBalance, handleDeposit, handleWithdraw, handleHelp } from './commands'
import { maybeServeAd } from './ads'

async function handleCustomCommand(bot: any, botUser: any, chatId: number, commandText: string): Promise<boolean> {
  try {
    const command = commandText.split(' ')[0].toLowerCase()

    const customCommand = await prisma.botCommand.findFirst({
      where: {
        botId: bot.id,
        command,
        isActive: true
      }
    })

    if (!customCommand) return false

    // Replace dynamic placeholders
    let response = customCommand.responseText

    // Replace currency placeholders
    if (bot.settings) {
      const rate = Number(bot.settings.usdToCurrencyRate) || 1000
      response = response.replace(/\[CURRENCY_RATE\]/g, rate.toString())
      response = response.replace(/\[CURRENCY_SYMBOL\]/g, bot.settings.currencySymbol || '🪙')
      response = response.replace(/\[USD_RATE\]/g, (1/rate).toFixed(6))
    }

    // Replace referral link placeholder
    if (response.includes('[REFERRAL_LINK]')) {
      const botUsername = bot.botUsername || 'yourbot'
      const referralLink = `https://t.me/${botUsername}?start=ref_${botUser.id}` 
      response = response.replace(/\[REFERRAL_LINK\]/g, referralLink)
    }

    // Replace referral count placeholder
    if (response.includes('[REFERRAL_COUNT]')) {
      try {
        // Will be implemented in referral system — for now show 0
        response = response.replace(/\[REFERRAL_COUNT\]/g, '0')
      } catch {}
    }

    await sendMessage(bot.botToken, chatId, response)
    logger.info('Command handled', { command, botId: bot.id, isPrebuilt: customCommand.isPrebuilt })
    return true
  } catch (error: any) {
    logger.error('handleCustomCommand error', { error: error.message })
    return false
  }
}

export async function getOrCreateBotUser(botId: string, telegramUser: any) {
  try {
    const telegramUserId = BigInt(telegramUser.id)
    
    const existing = await prisma.botUser.findUnique({
      where: {
        botId_telegramUserId: {
          botId,
          telegramUserId
        }
      }
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

    logger.info('New bot user created', { 
      botId, 
      telegramUserId: telegramUser.id,
      firstName: telegramUser.first_name 
    })

    return newUser

  } catch (error: any) {
    logger.error('getOrCreateBotUser failed', { 
      error: error.message, 
      botId, 
      telegramUserId: telegramUser?.id 
    })
    throw error
  }
}

export async function checkChannelMembership(channelId: string, telegramUserId: number): Promise<boolean> {
  try {
    const platformBotToken = process.env.PLATFORM_BOT_TOKEN
    if (!platformBotToken) {
      logger.error('PLATFORM_BOT_TOKEN not set in environment')
      return true // fail open — dont block users if env var missing
    }

    const url = `https://api.telegram.org/bot${platformBotToken}/getChatMember` 
    const response = await axios.get(url, {
      params: {
        chat_id: channelId,
        user_id: telegramUserId
      }
    })

    const status = response.data?.result?.status
    logger.info('Channel membership status', { status, userId: telegramUserId, channelId })

    return ['member', 'administrator', 'creator', 'restricted'].includes(status)
  } catch (error: any) {
    logger.error('checkChannelMembership failed', { 
      error: error.message, 
      channelId, 
      userId: telegramUserId,
      response: error.response?.data 
    })
    return true // fail open on error — dont block users
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
  // Import the actual withdrawal processing function
  const { processOxapayWithdrawal } = await import('./payments/oxapay')
  await processOxapayWithdrawal(bot, botUser, address, chatId)
}

export async function handleWebhook(req: any, res: any, botToken: string, update: any) {
  try {
    logger.info('Processing update', { updateId: update?.update_id })

    if (!botToken || !update) {
      logger.warn('Missing botToken or update')
      return
    }

    const bot = await prisma.bot.findUnique({
      where: { botToken },
      include: { settings: true }
    })

    if (!bot) {
      logger.warn('Bot not found for token', { tokenPreview: botToken.substring(0, 8) + '****' })
      return
    }

    if (!bot.isActive) {
      logger.warn('Bot is inactive', { botId: bot.id })
      return
    }

    let telegramUser: any = null
    let chatId: number = 0

    if (update.message) {
      telegramUser = update.message.from
      chatId = update.message.chat.id
    } else if (update.callback_query) {
      telegramUser = update.callback_query.from
      chatId = update.callback_query.message?.chat?.id
    }

    if (!telegramUser || !chatId) {
      logger.warn('Could not extract user or chatId from update', { update: JSON.stringify(update).substring(0, 200) })
      return
    }

    logger.info('User identified', { telegramUserId: telegramUser.id, chatId })

    const botUser = await getOrCreateBotUser(bot.id, telegramUser)

    if (botUser.isBanned) {
      logger.info('Banned user ignored', { telegramUserId: telegramUser.id })
      return
    }

    // Channel membership check
    if (bot.settings?.requireChannelJoin && bot.settings?.requiredChannelId) {
      if (!botUser.channelVerified) {
        logger.info('Checking channel membership', { 
          userId: telegramUser.id, 
          channelId: bot.settings.requiredChannelId 
        })
        
        const isMember = await checkChannelMembership(
          bot.settings.requiredChannelId, 
          telegramUser.id
        )
        
        if (isMember) {
          await prisma.botUser.update({
            where: { id: botUser.id },
            data: { channelVerified: true }
          })
          logger.info('Channel membership verified', { userId: telegramUser.id })
        } else {
          const channelLink = bot.settings.requiredChannelUsername
            ? `https://t.me/${bot.settings.requiredChannelUsername.replace('@', '')}` 
            : `https://t.me/${bot.settings.requiredChannelId.replace('-100', '')}` 

          await sendMessage(
            bot.botToken,
            chatId,
            `⚠️ <b>Channel Membership Required</b>\n\nTo use this bot, you must join our channel first.\n\nClick the button below to join, then send /start again.`,
            {
              inline_keyboard: [[
                { text: '📢 Join Channel', url: channelLink }
              ]]
            }
          )
          logger.info('Channel join message sent', { userId: telegramUser.id })
          return
        }
      }
    }

    // Check for pending withdrawal state
    if (update.message?.text && !update.message.text.startsWith('/')) {
      const withdrawState = await redisGet('withdraw_state:' + botUser.id)
      if (withdrawState === 'awaiting_address') {
        await redisDel('withdraw_state:' + botUser.id)
        await processWithdrawal(bot, botUser, update.message.text.trim(), chatId)
        return
      }

      const depositState = await redisGet('deposit_state:' + botUser.id)
      if (depositState === 'awaiting_txhash') {
        await redisDel('deposit_state:' + botUser.id)
        const { verifyAndCreditDeposit } = await import('./payments/trongrid')
        await verifyAndCreditDeposit(bot, botUser, update.message.text.trim(), chatId)
        return
      }
    }

    // Route commands
    if (update.message?.text) {
      const text = update.message.text.trim()
      logger.info('Routing command', { command: text.split(' ')[0], botId: bot.id })

      // Reply keyboard button routing
      if (text === '💰 Balance') {
        if (bot.settings?.balanceEnabled) {
          await handleBalance(bot, botUser, chatId)
        }
        return
      }
      if (text === '📥 Deposit') {
        if (bot.settings?.depositEnabled) {
          await handleDeposit(bot, botUser, chatId)
        }
        return
      }
      if (text === '📤 Withdraw') {
        if (bot.settings?.withdrawEnabled) {
          await handleWithdraw(bot, botUser, chatId)
        }
        return
      }
      if (text === '❓ Help') {
        await handleHelp(bot, chatId)
        return
      }
      if (text === '📋 Menu') {
        await handleHelp(bot, chatId)
        return
      }

      if (text.startsWith('/start')) {
        await handleStart(bot, botUser, chatId)
      } else if (text.startsWith('/balance')) {
        if (bot.settings?.balanceEnabled) {
          await handleBalance(bot, botUser, chatId)
        }
      } else if (text.startsWith('/deposit')) {
        if (bot.settings?.depositEnabled && (bot.settings?.oxapayMerchantKey || bot.settings?.faucetpayApiKey)) {
          await handleDeposit(bot, botUser, chatId)
        }
      } else if (text.startsWith('/withdraw')) {
        if (bot.settings?.withdrawEnabled && (bot.settings?.oxapayMerchantKey || bot.settings?.faucetpayApiKey)) {
          await handleWithdraw(bot, botUser, chatId)
        }
      } else if (text.startsWith('/help')) {
        await handleHelp(bot, chatId)
      } else if (text === '💰 Balance') {
        if (bot.settings?.balanceEnabled) {
          await handleBalance(bot, botUser, chatId)
        }
      } else if (text === '📥 Deposit') {
        if (bot.settings?.depositEnabled) {
          await handleDeposit(bot, botUser, chatId)
        }
      } else if (text === '📤 Withdraw') {
        if (bot.settings?.withdrawEnabled) {
          await handleWithdraw(bot, botUser, chatId)
        }
      } else if (text === '❓ Help') {
        await handleHelp(bot, chatId)
      } else if (text.startsWith('/')) {
        const handled = await handleCustomCommand(bot, botUser, chatId, text)
        if (!handled) {
          logger.debug('Unrecognised command', { text: text.split(' ')[0] })
        }
      }
    }

    // Handle callback queries (button clicks)
    if (update.callback_query) {
      const data = update.callback_query.data
      const callbackChatId = update.callback_query.message?.chat?.id

      // Answer callback to remove loading spinner
      try {
        await axios.post(
          `https://api.telegram.org/bot${bot.botToken}/answerCallbackQuery`,
          { callback_query_id: update.callback_query.id }
        )
      } catch {}

      if (data === 'cmd_balance') {
        if (bot.settings?.balanceEnabled) {
          await handleBalance(bot, botUser, callbackChatId)
        }
      } else if (data === 'cmd_start') {
        await handleStart(bot, botUser, callbackChatId)
      } else if (data === 'cmd_deposit') {
        if (bot.settings?.depositEnabled && (bot.settings?.oxapayMerchantKey || bot.settings?.faucetpayApiKey)) {
          await handleDeposit(bot, botUser, callbackChatId)
        }
      } else if (data === 'cmd_withdraw') {
        if (bot.settings?.withdrawEnabled && (bot.settings?.oxapayMerchantKey || bot.settings?.faucetpayApiKey)) {
          await handleWithdraw(bot, botUser, callbackChatId)
        }
      } else if (data === 'cmd_help') {
        await handleHelp(bot, callbackChatId)
      } else if (data === 'cmd_consent_agree') {
        await prisma.botUser.update({
          where: { id: botUser.id },
          data: { adConsent: true }
        })
        const updatedBotUser = await prisma.botUser.findUnique({
          where: { id: botUser.id }
        })
        await handleStart(bot, updatedBotUser, callbackChatId)
      } else if (data === 'cmd_menu') {
        await handleHelp(bot, callbackChatId)
      } else if (data?.startsWith('custom_')) {
        const customCmd = data.replace('custom_', '')
        await handleCustomCommand(bot, botUser, callbackChatId, customCmd)
      } else if (data === 'cmd_cancel_deposit') {
        await redisDel('oxapay_invoice:' + bot.id + ':' + botUser.id)
        await sendMessage(
          bot.botToken,
          callbackChatId,
          '✅ Deposit cancelled.',
          {
            keyboard: [
              [{ text: '💰 Balance' }, { text: '📥 Deposit' }],
              [{ text: '📤 Withdraw' }, { text: '❓ Help' }]
            ],
            resize_keyboard: true,
            persistent: true,
            one_time_keyboard: false
          }
        )
      } else if (data === 'cmd_check_deposit') {
        await sendMessage(
          bot.botToken,
          callbackChatId,
          '⏳ Your deposit is being monitored automatically.\n\nYou will receive a notification as soon as it is confirmed.\n\nThis usually takes 1-3 minutes after sending.'
        )
      }
    }

    // After handling — maybe show an ad
    await maybeServeAd(bot, botUser, chatId)

  } catch (error: any) {
    logger.error('handleWebhook error', { error: error.message, stack: error.stack })
  }
}

