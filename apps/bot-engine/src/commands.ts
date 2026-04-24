import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { createOxapayInvoice } from './payments/oxapay'
import { redisSet } from './redis'

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
    await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      payload
    )
  } catch (err: any) {
    logger.error('Telegram sendMessage error', {
      message: err?.message,
      response: err?.response?.data
    })
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

export async function handleStart(
  bot: any, 
  botUser: any, 
  chatId: number
) {
  const settings = bot.settings
  if (!settings) {
    await sendMessage(bot.botToken, chatId, 'Welcome!')
    return
  }

  const keyboard: any[][] = []
  const row1: any[] = []
  const row2: any[] = []

  if (settings.balanceEnabled) {
    row1.push({ text: '💰 Balance' })
  }
  if (settings.depositEnabled) {
    row1.push({ text: '📥 Deposit' })
  }
  if (row1.length > 0) keyboard.push(row1)

  if (settings.withdrawEnabled) {
    row2.push({ text: '📤 Withdraw' })
  }
  row2.push({ text: '❓ Help' })
  keyboard.push(row2)

  const balanceText = settings.balanceEnabled
    ? `\n\n💰 Your balance: ${botUser.balance} ${settings.currencySymbol || '🪙'}`
    : ''

  const replyMarkup = {
    keyboard,
    resize_keyboard: true,
    persistent: true,
    one_time_keyboard: false
  }

  await sendMessage(
    bot.botToken,
    chatId,
    settings.welcomeMessage + balanceText,
    replyMarkup
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

  const depositMessage = `📥 <b>Deposit USDT (TRC20)</b>

Send USDT to this address:
<code>${bot.settings.depositWalletAddress}</code>

⚠️ Only send USDT on the TRC20 network.
Other tokens or networks will not be credited.

After sending, reply here with your transaction hash.
You have 10 minutes.

💡 Get your TX hash from your wallet transaction history.`

  await sendMessage(
    bot.botToken,
    chatId,
    depositMessage,
    {
      inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_deposit' }]]
    }
  )
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
