import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { createOxapayInvoice } from './payments/oxapay'
import { redisSet } from './redis'

export async function sendMessage(botToken: string, chatId: number, text: string, replyMarkup?: object) {
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: replyMarkup
    })
  } catch (err) {
    logger.error('Telegram sendMessage error:', err)
  }
}

export function getMainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '💰 Balance', callback_data: 'cmd_balance' },
        { text: '📥 Deposit', callback_data: 'cmd_deposit' }
      ],
      [
        { text: '📤 Withdraw', callback_data: 'cmd_withdraw' },
        { text: '❓ Help', callback_data: 'cmd_help' }
      ]
    ]
  }
}

export async function handleStart(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!settings) {
    await sendMessage(bot.botToken, chatId, 'Welcome!')
    return
  }

  const keyboard: any[][] = []
  const row1: any[] = []
  const row2: any[] = []

  if (settings.balanceEnabled) {
    row1.push({ text: '💰 Balance', callback_data: 'cmd_balance' })
  }
  if (settings.depositEnabled) {
    row1.push({ text: '📥 Deposit', callback_data: 'cmd_deposit' })
  }
  if (row1.length > 0) keyboard.push(row1)

  if (settings.withdrawEnabled) {
    row2.push({ text: '📤 Withdraw', callback_data: 'cmd_withdraw' })
  }
  row2.push({ text: '❓ Help', callback_data: 'cmd_help' })
  if (row2.length > 0) keyboard.push(row2)

  const balanceText = (settings.balanceEnabled || settings.depositEnabled || settings.withdrawEnabled)
    ? `\n\n💰 Your balance: ${botUser.balance} ${settings.currencySymbol || '🪙'}` 
    : ''

  await sendMessage(
    bot.botToken,
    chatId,
    settings.welcomeMessage + balanceText,
    keyboard.length > 0 ? { inline_keyboard: keyboard } : undefined
  )
}

export async function handleBalance(bot: any, botUser: any, chatId: number) {
  const usdValue = (Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)).toFixed(4)
  const text =
    '💰 <b>Your Balance</b>\n\n' +
    botUser.balance +
    ' ' +
    bot.settings.currencySymbol +
    '\n≈ $' +
    usdValue +
    ' USD'
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
  const hasPayments = !!(settings?.depositEnabled || settings?.withdrawEnabled)

  let helpText = 'ℹ️ <b>Available Commands</b>\n\n'
  helpText += '/start — Main menu\n'
  helpText += '/help — Show this message\n'

  if (settings?.balanceEnabled) {
    helpText += '/balance — Check your balance\n'
  }
  if (settings?.depositEnabled) {
    helpText += '/deposit — Add funds\n'
  }
  if (settings?.withdrawEnabled) {
    helpText += '/withdraw — Cash out your balance\n'
  }

  // Get custom commands for this bot
  try {
    const customCommands = await prisma.botCommand.findMany({
      where: { botId: bot.id, isActive: true },
      orderBy: { createdAt: 'asc' }
    })

    if (customCommands.length > 0) {
      helpText += '\n<b>Other Commands:</b>\n'
      customCommands.forEach((cmd: any) => {
        helpText += `${cmd.command} — ${cmd.responseText.substring(0, 40)}...\n` 
      })
    }
  } catch {}

  await sendMessage(bot.botToken, chatId, helpText)
}

export async function handleDeposit(bot: any, botUser: any, chatId: number) {
  if (!bot.settings.oxapayMerchantKey && !bot.settings.faucetpayApiKey) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits not configured yet. Contact bot owner.')
    return
  }
  await createOxapayInvoice(bot, botUser, chatId)
}

export async function handleWithdraw(bot: any, botUser: any, chatId: number) {
  if (!bot.settings.oxapayMerchantKey && !bot.settings.faucetpayApiKey) {
    await sendMessage(bot.botToken, chatId, '💳 Withdrawals not configured yet. Contact bot owner.')
    return
  }
  
  const usdEquiv = Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)
  const minWithdraw = Number(bot.settings.minWithdrawUsd)
  if (usdEquiv < minWithdraw) {
    await sendMessage(
      bot.botToken,
      chatId,
      '❌ Insufficient balance.\n\nMinimum withdrawal: $' +
        minWithdraw +
        ' USD\nYour balance: ' +
        botUser.balance +
        ' ' +
        bot.settings.currencySymbol +
        ' (≈$' +
        usdEquiv.toFixed(4) +
        ')'
    )
    return
  }
  await redisSet('withdraw_state:' + botUser.id, 'awaiting_address', 600)
  await sendMessage(
    bot.botToken,
    chatId,
    '📤 <b>Withdraw</b>\n\nPlease reply with your USDT (TRC20) wallet address.\n\n⏱ You have 10 minutes to reply.'
  )
}
