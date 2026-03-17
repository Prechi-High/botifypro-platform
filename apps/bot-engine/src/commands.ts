import axios from 'axios'
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
    console.error('Telegram sendMessage error:', err)
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
  const text =
    settings.welcomeMessage +
    '\n\n💰 Your balance: ' +
    botUser.balance +
    ' ' +
    settings.currencySymbol
  await sendMessage(bot.botToken, chatId, text, getMainMenuKeyboard())
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
  const text =
    'ℹ️ <b>Commands</b>\n\n' +
    '/start — Main menu\n' +
    '/balance — Your balance\n' +
    '/deposit — Add funds\n' +
    '/withdraw — Cash out\n' +
    '/help — This message'
  await sendMessage(bot.botToken, chatId, text)
}

export async function handleDeposit(bot: any, botUser: any, chatId: number) {
  if (!bot.settings.oxapayMerchantKey) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits not configured yet. Contact bot owner.')
    return
  }
  await createOxapayInvoice(bot, botUser, chatId)
}

export async function handleWithdraw(bot: any, botUser: any, chatId: number) {
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

import axios from 'axios'
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
    console.error('Telegram sendMessage error:', err)
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
  const text =
    settings.welcomeMessage +
    '\n\n💰 Your balance: ' +
    botUser.balance +
    ' ' +
    settings.currencySymbol
  await sendMessage(bot.botToken, chatId, text, getMainMenuKeyboard())
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
  const text =
    'ℹ️ <b>Commands</b>\n\n' +
    '/start — Main menu\n' +
    '/balance — Your balance\n' +
    '/deposit — Add funds\n' +
    '/withdraw — Cash out\n' +
    '/help — This message'
  await sendMessage(bot.botToken, chatId, text)
}

export async function handleDeposit(bot: any, botUser: any, chatId: number) {
  if (!bot.settings.oxapayMerchantKey) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits not configured yet. Contact bot owner.')
    return
  }
  await createOxapayInvoice(bot, botUser, chatId)
}

export async function handleWithdraw(bot: any, botUser: any, chatId: number) {
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

