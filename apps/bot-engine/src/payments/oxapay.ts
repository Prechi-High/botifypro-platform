import axios from 'axios'
import { prisma } from '@botifypro/database'
import { redisDel, redisGet, redisSet } from '../redis'
import { sendMessage } from '../commands'

export async function createOxapayInvoice(bot: any, botUser: any, chatId: number) {
  if (!bot.settings) {
    console.error('Bot settings not found for bot:', bot.id)
    return
  }
  const merchantKey = bot.settings.oxapayMerchantKey
  if (!merchantKey) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits not configured yet. Contact bot owner.')
    return
  }

  const orderId = botUser.id + '_' + Date.now()

  const response = await axios.post('https://api.oxapay.com/merchants/request', {
    merchant: merchantKey,
    amount: Number(bot.settings.minDepositUsd),
    currency: 'USDT',
    lifeTime: 30,
    callbackUrl: process.env.WEBHOOK_BASE_URL + '/webhooks/oxapay',
    orderId,
    description: 'Deposit to ' + bot.botName
  })

  const result = response.data
  if (result?.result !== 100) {
    await sendMessage(bot.botToken, chatId, 'Payment system error. Try again.')
    return
  }

  await redisSet(
    'invoice:' + result.trackId,
    JSON.stringify({ botId: bot.id, botUserId: botUser.id, botToken: bot.botToken }),
    2100
  )

  await sendMessage(
    bot.botToken,
    chatId,
    '💳 <b>Deposit</b>\n\nClick below to pay with USDT.\n\nMin amount: $' +
      bot.settings.minDepositUsd +
      '\nAfter payment: ' +
      (Number(bot.settings.minDepositUsd) * Number(bot.settings.usdToCurrencyRate) * 0.98).toFixed(0) +
      ' ' +
      bot.settings.currencySymbol +
      ' credited (2% platform fee)\n\n⏱ Link expires in 30 minutes',
    { inline_keyboard: [[{ text: '💳 Pay Now', url: result.payLink }]] }
  )
}

export async function handleOxapayWebhook(req: any, res: any) {
  res.status(200).json({ ok: true })
  try {
    const { trackId, status, amount } = req.body || {}
    if (status !== 'Paid') return

    const existing = await prisma.transaction.findFirst({ where: { gatewayTxId: trackId } })
    if (existing) return

    const invoice = await redisGet('invoice:' + trackId)
    if (!invoice) return

    const invoiceData = JSON.parse(invoice) as { botId: string; botUserId: string; botToken: string }
    const bot = await prisma.bot.findUnique({
      where: { id: invoiceData.botId },
      include: { settings: true }
    })
    const botUser = await prisma.botUser.findUnique({ where: { id: invoiceData.botUserId } })
    if (!bot || !botUser) return
    if (!bot.settings) {
      console.error('Bot settings not found for bot:', bot.id)
      return
    }

    const amountUsd = parseFloat(amount)
    const platformFee = amountUsd * 0.02
    const netAmountUsd = amountUsd - platformFee
    const currencyAmount = netAmountUsd * Number(bot.settings?.usdToCurrencyRate)

    await prisma.botUser.update({
      where: { id: invoiceData.botUserId },
      data: { balance: { increment: currencyAmount } }
    })

    await prisma.transaction.create({
      data: {
        botId: bot.id,
        botUserId: botUser.id,
        type: 'deposit',
        amountCurrency: currencyAmount,
        amountUsd: amountUsd,
        status: 'paid',
        gateway: 'oxapay',
        gatewayTxId: trackId,
        platformFeeAmount: platformFee
      }
    })

    await redisDel('invoice:' + trackId)

    const updated = await prisma.botUser.findUnique({ where: { id: botUser.id } })
    const newBalance = updated?.balance ?? botUser.balance

    const text =
      '✅ <b>Deposit Confirmed!</b>\n\n+' +
      currencyAmount.toFixed(0) +
      ' ' +
      bot.settings.currencySymbol +
      ' added\nNew balance: ' +
      newBalance +
      ' ' +
      bot.settings.currencySymbol

    await sendMessage(invoiceData.botToken, Number(botUser.telegramUserId), text)
  } catch (err) {
    console.error('OxaPay webhook error:', err)
    return
  }
}

export async function processOxapayWithdrawal(bot: any, botUser: any, address: string, chatId: number) {
  if (!bot.settings) {
    console.error('Bot settings not found for bot:', bot.id)
    return
  }
  const merchantKey = bot.settings.oxapayMerchantKey
  const usdAmount = Number(botUser.balance) / Number(bot.settings.usdToCurrencyRate)
  const feePercent = Number(bot.settings.withdrawFeePercent) || 0
  const netUsd = usdAmount * (1 - feePercent / 100)

  try {
    await axios.post('https://api.oxapay.com/merchants/send-money', {
      merchant: merchantKey,
      amount: netUsd,
      currency: 'USDT',
      address,
      callbackUrl: process.env.WEBHOOK_BASE_URL + '/webhooks/oxapay-payout'
    })
  } catch {
    await sendMessage(bot.botToken, chatId, 'Withdrawal failed. Try again later.')
    return
  }

  await prisma.botUser.update({
    where: { id: botUser.id },
    data: { balance: 0 }
  })

  await prisma.transaction.create({
    data: {
      botId: bot.id,
      botUserId: botUser.id,
      type: 'withdrawal',
      amountCurrency: botUser.balance,
      amountUsd: usdAmount,
      status: 'pending',
      gateway: 'oxapay',
      withdrawAddress: address
    }
  })

  await sendMessage(
    bot.botToken,
    chatId,
    '📤 <b>Withdrawal Submitted</b>\n\nAmount: ' +
      netUsd.toFixed(4) +
      ' USDT\nAddress: ' +
      address +
      '\n\nProcessing time: 1-24 hours'
  )
}

