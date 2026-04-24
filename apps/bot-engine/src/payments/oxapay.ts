import axios from 'axios'
import crypto from 'crypto'
import { prisma } from '@botifypro/database'
import { logger } from '../logger'
import { redisSet, redisGet, redisDel } from '../redis'

export async function createOxapayDeposit(
  bot: any,
  botUser: any,
  chatId: number
) {
  try {
    const merchantKey = bot.settings?.oxapayMerchantKey
    if (!merchantKey) {
      const { sendMessage } = await import('../commands')
      await sendMessage(
        bot.botToken,
        chatId,
        '💳 <b>Deposits not configured</b>\n\nThe bot owner has not set up payments yet.'
      )
      return
    }

    if (!bot.settings?.depositEnabled) {
      const { sendMessage } = await import('../commands')
      await sendMessage(
        bot.botToken,
        chatId,
        '💳 Deposits are currently disabled.'
      )
      return
    }

    const minAmount = Number(bot.settings?.minDepositUsd) || 1

    const response = await axios.post(
      'https://api.oxapay.com/v1/payment/white-label',
      {
        amount: minAmount,
        currency: 'USD',
        pay_currency: 'USDT',
        network: 'TRC20',
        lifetime: 30,
        fee_paid_by_payer: 0,
        under_paid_coverage: 2,
        callback_url: process.env.WEBHOOK_BASE_URL + '/webhooks/oxapay',
        description: `botId:${bot.id} userId:${botUser.id} chatId:${chatId}`
      },
      {
        headers: {
          'merchant_api_key': merchantKey,
          'Content-Type': 'application/json'
        }
      }
    )

    if (response.data?.status !== 200) {
      logger.error('OxaPay invoice creation failed', {
        status: response.data?.status,
        message: response.data?.message
      })
      const { sendMessage } = await import('../commands')
      await sendMessage(
        bot.botToken,
        chatId,
        '❌ Could not generate deposit address. Please try again later.'
      )
      return
    }

    const invoice = response.data.data
    const trackId = invoice.track_id
    const address = invoice.address
    const network = invoice.network
    const payAmount = invoice.pay_amount
    const payCurrency = invoice.pay_currency?.toUpperCase()

    // Store forward lookup: trackId → bot/user/chat
    await redisSet(
      `oxapay_track:${trackId}`,
      JSON.stringify({
        botId: bot.id,
        botUserId: botUser.id,
        chatId,
        botToken: bot.botToken
      }),
      1800
    )

    // Store reverse lookup
    await redisSet(
      `oxapay_invoice:${bot.id}:${botUser.id}`,
      trackId,
      1800
    )

    const { sendMessage } = await import('../commands')
    await sendMessage(
      bot.botToken,
      chatId,
      `📥 <b>Deposit ${payCurrency}</b>\n\nSend exactly <b>${payAmount} ${payCurrency}</b> to:\n<code>${address}</code>\n\n🌐 Network: <b>${network}</b>\n⏱ Expires in: <b>30 minutes</b>\n\n⚠️ Send ONLY ${payCurrency} to this address.\nOther coins will NOT be credited.\n\n✅ Your balance updates automatically once confirmed.`,
      {
        inline_keyboard: [[
          { text: '❌ Cancel Deposit', callback_data: 'cmd_cancel_deposit' }
        ]]
      }
    )

    logger.info('OxaPay deposit invoice created', {
      botId: bot.id,
      botUserId: botUser.id,
      trackId
    })

  } catch (error: any) {
    logger.error('createOxapayDeposit error', {
      error: error.message,
      response: error.response?.data
    })
    const { sendMessage } = await import('../commands')
    await sendMessage(
      bot.botToken,
      chatId,
      '❌ Deposit failed. Please try again later.'
    )
  }
}

export async function handleOxapayWebhook(req: any, res: any) {
  res.status(200).json({ ok: true })

  try {
    const body = req.body
    const trackId = body?.data?.track_id || body?.track_id
    const status = body?.data?.status || body?.status
    const amount = body?.data?.amount || body?.amount
    const currency = body?.data?.currency || body?.currency

    logger.info('OxaPay webhook received', { trackId, status, amount })

    if (status !== 'Paid' && status !== 'paid') {
      logger.info('OxaPay webhook ignored - not paid', { status, trackId })
      return
    }

    const stored = await redisGet(`oxapay_track:${trackId}`)
    if (!stored) {
      logger.warn('OxaPay webhook - unknown trackId', { trackId })
      return
    }

    const { botId, botUserId, chatId, botToken } = JSON.parse(stored)

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { settings: true }
    })

    if (!bot) {
      logger.warn('OxaPay webhook - bot not found', { botId })
      return
    }

    if (bot.settings?.oxapaySecretKey) {
      const hmac = crypto
        .createHmac('sha512', bot.settings.oxapaySecretKey)
        .update(JSON.stringify(body))
        .digest('hex')

      if (hmac !== req.headers['hmac']) {
        logger.error('OxaPay webhook HMAC mismatch', { trackId, botId })
        return
      }
    }

    const existing = await prisma.depositTransaction.findUnique({
      where: { txHash: String(trackId) }
    })
    if (existing) {
      logger.warn('OxaPay duplicate webhook ignored', { trackId })
      return
    }

    const usdAmount = Number(amount)
    const currencyAmount = usdAmount * Number(bot.settings?.usdToCurrencyRate || 1000)

    await prisma.$transaction([
      prisma.depositTransaction.create({
        data: {
          txHash: String(trackId),
          botId,
          botUserId,
          amountUsd: usdAmount,
          amountCrypto: usdAmount,
          coin: String(currency || 'USDT'),
          network: 'trc20',
          recipientAddress: '',
          status: 'completed'
        }
      }),
      prisma.botUser.update({
        where: { id: botUserId },
        data: { balance: { increment: currencyAmount } }
      })
    ])

    await redisDel(`oxapay_track:${trackId}`)
    await redisDel(`oxapay_invoice:${botId}:${botUserId}`)

    const updatedUser = await prisma.botUser.findUnique({
      where: { id: botUserId }
    })

    const { sendMessage } = await import('../commands')
    await sendMessage(
      botToken,
      chatId,
      `✅ <b>Deposit Confirmed!</b>\n\n+${currencyAmount} ${bot.settings?.currencySymbol || '🪙'}\n≈ $${usdAmount} USD\n\n💰 New balance: ${updatedUser?.balance} ${bot.settings?.currencySymbol || '🪙'}`
    )

    logger.info('OxaPay deposit credited', {
      botId,
      botUserId,
      usdAmount,
      currencyAmount
    })

  } catch (error: any) {
    logger.error('handleOxapayWebhook error', { error: error.message })
  }
}

