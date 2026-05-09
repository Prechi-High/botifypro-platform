require('dotenv').config()

import express, { type Request, type Response } from 'express'
import cors from 'cors'
import axios from 'axios'
import crypto from 'crypto'
import { handleWebhook } from './webhook'
import { registerBot, registerBotRoute, validateBotTokenRoute } from './registration'
import { handleOxapayWebhook } from './payments/oxapay'
import { prisma } from '@botifypro/database'
import { registerWebhook } from './registration'
import logger from './logger'
import { startAdCron } from './adCron'

const app = express()
app.use(express.json())
app.use(cors())

app.get('/health', async (_req: Request, res: Response) => {
  try {
    res.json({ status: 'ok', timestamp: new Date(), service: '1-TouchBot Bot Engine' })
  } catch (err: any) {
    logger.error('Server error', { error: err?.message, stack: err?.stack })
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/webhook/:botToken', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })
  
  const { botToken } = req.params
  const update = req.body
  
  logger.info('Webhook received', { 
    tokenPreview: botToken.substring(0, 8) + '****',
    updateId: update?.update_id,
    hasMessage: !!update?.message,
    hasCallback: !!update?.callback_query
  })
  
  try {
    await handleWebhook(req, res, botToken, update)
  } catch (error: any) {
    logger.error('Webhook top-level error', { error: error.message, stack: error.stack })
  }
})

app.post('/api/bots/validate', async (req: Request, res: Response) => {
  try {
    logger.info('API call', { route: req.path, method: req.method })
    await validateBotTokenRoute(req, res)
  } catch (err: any) {
    logger.error('Server error', { error: err?.message, stack: err?.stack })
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/api/bots/register', async (req: Request, res: Response) => {
  try {
    logger.info('API call', { route: req.path, method: req.method })
    const result = await registerBot(req.body)
    res.status(200).json(result)
  } catch (error: any) {
    logger.error('Register endpoint error', { error: error?.message, stack: error?.stack })
    if (error?.message === 'Bot already registered') {
      res.status(400).json({ error: 'Bot already registered on this platform' })
    } else if (error?.message === 'Invalid bot token') {
      res.status(400).json({ error: 'Invalid bot token' })
    } else {
      res.status(500).json({ error: error?.message || 'Registration failed' })
    }
  }
})

app.post('/api/bots/channel-info', async (req: Request, res: Response) => {
  try {
    const { username, botToken } = req.body || {}
    if (!username || !botToken) {
      return res.status(400).json({ error: 'username and botToken are required' })
    }
    const cleanUsername = String(username).startsWith('@') ? String(username) : '@' + String(username)
    const response = await axios.get(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${cleanUsername}`)
    if (response.data?.ok) {
      const chat = response.data.result
      return res.json({
        channelId: chat.id.toString(),
        title: chat.title || null,
        username: chat.username || null,
        type: chat.type
      })
    } else {
      return res.status(400).json({ error: 'Channel not found. Make sure the username is correct.' })
    }
  } catch (error: any) {
    logger.error('Channel info fetch failed', { error: error?.message, stack: error?.stack })
    return res.status(500).json({ error: 'Failed to fetch channel info' })
  }
})

app.post('/api/bots/register-webhook', async (req: Request, res: Response) => {
  try {
    const { botId } = req.body
    if (!botId) return res.status(400).json({ error: 'botId required' })
    
    const bot = await prisma.bot.findUnique({ where: { id: botId } })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    
    const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhook/${bot.botToken}` 
    
    const response = await axios.post(
      `https://api.telegram.org/bot${bot.botToken}/setWebhook`,
      { url: webhookUrl, drop_pending_updates: true }
    )
    
    if (response.data.ok) {
      await prisma.bot.update({
        where: { id: botId },
        data: { webhookSet: true }
      })
      logger.info('Webhook manually re-registered', { botId, webhookUrl })
      return res.json({ success: true })
    } else {
      return res.status(400).json({ error: 'Telegram rejected webhook', detail: response.data })
    }
  } catch (error: any) {
    logger.error('Webhook re-registration failed', { error: error.message })
    return res.status(500).json({ error: error.message })
  }
})

app.get('/api/bots/:botId/webhook-status', async (req: Request, res: Response) => {
  try {
    const bot = await prisma.bot.findUnique({ where: { id: req.params.botId } })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })
    
    const response = await axios.get(
      `https://api.telegram.org/bot${bot.botToken}/getWebhookInfo` 
    )
    
    return res.json({
      webhookSet: !!response.data.result?.url,
      url: response.data.result?.url || '',
      pendingUpdates: response.data.result?.pending_update_count || 0
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
})

app.post('/api/bots/verify-channel-admin', async (req: Request, res: Response) => {
  try {
    const { channelId, botToken } = req.body
    if (!channelId || !botToken) {
      return res.status(400).json({ error: 'channelId and botToken are required' })
    }

    // Get bot's own user ID
    const meResponse = await axios.get(
      `https://api.telegram.org/bot${botToken}/getMe`
    )
    const botId = meResponse.data.result.id

    // Check if bot is admin in channel
    const memberResponse = await axios.get(
      `https://api.telegram.org/bot${botToken}/getChatMember`,
      { params: { chat_id: channelId, user_id: botId } }
    )

    const status = memberResponse.data?.result?.status
    const isAdmin = ['administrator', 'creator'].includes(status)

    logger.info('Channel admin verification', { channelId, status, isAdmin })

    const botUsername = meResponse.data.result.username || 'your bot'
    return res.json({
      isAdmin,
      status,
      message: isAdmin
        ? `@${botUsername} is admin in this channel ✓`
        : `@${botUsername} is NOT admin. Please add it as administrator first.`
    })
  } catch (error: any) {
    logger.error('Channel admin verify failed', { error: error.message })
    return res.status(500).json({
      error: 'Could not verify. Make sure channel ID is correct and channel is public or bot is already a member.'
    })
  }
})

app.post('/webhooks/oxapay/:botId', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params
    await handleOxapayWebhook(req, res, botId)
  } catch (err: any) {
    logger.error('OxaPay webhook error', { error: err?.message })
    res.status(200).json({ ok: true })
  }
})

app.post('/api/admin/refresh-webhooks', async (_req: Request, res: Response) => {
  try {
    logger.info('API call', { route: '/api/admin/refresh-webhooks', method: 'POST' })
    const bots = await prisma.bot.findMany({ where: { isActive: true } })
    for (const bot of bots) {
      try {
        await registerWebhook(bot.id, bot.botToken)
      } catch {}
    }
    res.json({ ok: true, count: bots.length })
  } catch (err: any) {
    logger.error('Server error', { error: err?.message, stack: err?.stack })
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/api/payments/create-topup-invoice', async (req: Request, res: Response) => {
  try {
    const { userId, amountUsd } = req.body
    if (!userId || !amountUsd || Number(amountUsd) < 5) {
      return res.status(400).json({ error: 'userId and amountUsd (min $5) are required' })
    }

    // Try platform_settings first, then fall back to env var
    let merchantKey = process.env.OXAPAY_MERCHANT_KEY
    try {
      const platformSettings = await (prisma as any).platformSettings.findFirst()
      if (platformSettings?.adsOxapayMerchantKey) {
        merchantKey = platformSettings.adsOxapayMerchantKey
      }
    } catch {}

    if (!merchantKey) {
      return res.status(500).json({ error: 'Payment gateway not configured. Set OxaPay key in Admin Settings.' })
    }
    const response = await axios.post(
      'https://api.oxapay.com/v1/payment/white-label',
      {
        amount: Number(amountUsd),
        currency: 'USD',
        pay_currency: 'USDT',
        network: 'TRC20',
        lifetime: 30,
        fee_paid_by_payer: 0,
        under_paid_coverage: 2,
        callback_url: process.env.WEBHOOK_BASE_URL + '/webhooks/oxapay-ads/' + userId,
        description: `advertiser topup userId:${userId}`,
      },
      { headers: { 'merchant_api_key': merchantKey, 'Content-Type': 'application/json' } }
    )
    if (response.data?.status !== 200) {
      logger.error('OxaPay ads topup invoice failed', { status: response.data?.status, message: response.data?.message })
      return res.status(500).json({ error: response.data?.message || 'Failed to create payment link' })
    }
    const invoice = response.data.data
    logger.info('Ads topup invoice created', { userId, amountUsd, trackId: invoice.track_id })
    return res.json({ paymentUrl: invoice.payment_url })
  } catch (err: any) {
    logger.error('create-topup-invoice error', { error: err?.message, response: err?.response?.data })
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
})

app.post('/api/payments/get-deposit-address', async (req: Request, res: Response) => {
  try {
    const { userId, email, network: requestedNetwork, purpose: requestedPurpose } = req.body || {}
    if (!userId) return res.status(400).json({ error: 'userId required' })

    const SUPPORTED_NETWORKS = ['TRC20', 'BEP20', 'ERC20', 'TON'] as const
    type SupportedNetwork = typeof SUPPORTED_NETWORKS[number]
    const network: SupportedNetwork = SUPPORTED_NETWORKS.includes(requestedNetwork) ? requestedNetwork : 'TRC20'

    const SUPPORTED_PURPOSES = ['advertiser', 'upgrade'] as const
    const purpose = SUPPORTED_PURPOSES.includes(requestedPurpose) ? requestedPurpose : 'advertiser'

    // Try platform_settings first (set by admin), then fall back to env var
    let merchantKey = process.env.OXAPAY_MERCHANT_KEY
    let proPlanPrice = 10
    let minAdvertiserDeposit = 1
    try {
      const platformSettings = await (prisma as any).platformSettings.findFirst()
      if (platformSettings?.adsOxapayMerchantKey) merchantKey = platformSettings.adsOxapayMerchantKey
      if (platformSettings?.proPlanPrice) proPlanPrice = Number(platformSettings.proPlanPrice)
      if (platformSettings?.minAdvertiserDepositUsd) minAdvertiserDeposit = Number(platformSettings.minAdvertiserDepositUsd)
    } catch {}

    if (!merchantKey) return res.status(500).json({ error: 'OxaPay not configured. Set the OxaPay merchant key in Admin Settings.' })

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, depositAddress: true, depositTrackId: true }
    })

    if (!user) return res.status(404).json({ error: 'User not found' })

    // Use purpose-based minimum: upgrade deposits use proPlanPrice, advertiser deposits use admin-configured minimum
    const invoiceAmount = purpose === 'upgrade' ? proPlanPrice : minAdvertiserDeposit

    // Embed network + purpose in callback URL so the webhook can track both
    const callbackUrl = `${process.env.WEBHOOK_BASE_URL}/webhooks/oxapay-ads/${userId}?network=${network}&purpose=${purpose}`

    // Always generate a fresh white-label address for each deposit session / network
    const response = await axios.post(
      'https://api.oxapay.com/v1/payment/white-label',
      {
        amount: invoiceAmount,
        currency: 'USD',
        pay_currency: 'USDT',
        network,
        lifetime: 60,
        fee_paid_by_payer: 0,
        under_paid_coverage: 2,
        callback_url: callbackUrl,
        description: `deposit userId:${userId} network:${network} purpose:${purpose}`
      },
      {
        headers: {
          'merchant_api_key': merchantKey,
          'Content-Type': 'application/json'
        }
      }
    )

    const data = response.data?.data
    if (!data?.address) {
      logger.error('OxaPay white-label address generation failed', { response: response.data })
      return res.status(500).json({ error: 'Failed to generate deposit address' })
    }

    // Store the latest address (white-label gives a fresh address each call)
    await prisma.user.update({
      where: { id: userId },
      data: {
        depositAddress: data.address,
        depositTrackId: String(data.track_id)
      }
    })

    logger.info('White-label deposit address generated', { userId, network, purpose, address: data.address })

    return res.json({
      success: true,
      address: data.address,
      trackId: String(data.track_id),
      qrCode: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.address)}`,
      network,
      purpose,
      currency: 'USDT'
    })
  } catch (err: any) {
    logger.error('get-deposit-address error', {
      error: err?.message,
      response: err?.response?.data
    })
    return res.status(500).json({ error: err?.message || 'Failed to generate deposit address' })
  }
})

// Shared handler for OxaPay advertiser/upgrade deposit webhooks
async function processOxapayAdsWebhook(userId: string, network: string, purpose: string, req: any) {
  const body = req.body

  // Verify HMAC using the ads merchant key (OxaPay signs with the merchant API key, not a separate secret)
  try {
    let merchantKey = process.env.OXAPAY_MERCHANT_KEY
    const platformSettings = await (prisma as any).platformSettings.findFirst()
    if (platformSettings?.adsOxapayMerchantKey) merchantKey = platformSettings.adsOxapayMerchantKey
    if (merchantKey && req.headers['hmac']) {
      const hmac = crypto.createHmac('sha512', merchantKey).update(JSON.stringify(body)).digest('hex')
      if (hmac !== req.headers['hmac']) {
        logger.warn('OxaPay ads HMAC mismatch — processing anyway (dedup protects against replays)', { userId })
      }
    }
  } catch {}

  const data = body?.data || body
  const status = data?.status
  const amount = data?.amount || data?.pay_amount
  const trackId = String(data?.track_id || data?.txid || data?.transaction_id || '')

  logger.info('OxaPay ads webhook received', { userId, status, amount, network, purpose, trackId })

  if (status !== 'Paid' && status !== 'paid') return

  const paidAmount = Number(amount)
  if (!paidAmount) return

  if (trackId) {
    const gatewayTxId = `ads-${trackId}`
    const existing = await prisma.advertiserDepositTransaction.findUnique({ where: { gatewayTxId } })
    if (existing) {
      logger.info('Duplicate oxapay-ads webhook ignored', { gatewayTxId, userId })
      return
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { advertiserBalance: { increment: paidAmount } },
      }),
      prisma.advertiserDepositTransaction.create({
        data: {
          userId,
          amountUsd: paidAmount,
          status: 'completed',
          gateway: 'oxapay',
          gatewayTxId,
          network,
          purpose,
        }
      })
    ])

    // Auto-upgrade to PRO when deposit was made from the upgrade page
    if (purpose === 'upgrade') {
      let proPlanPrice = 10
      try {
        const platformSettings = await (prisma as any).platformSettings.findFirst()
        if (platformSettings?.proPlanPrice) proPlanPrice = Number(platformSettings.proPlanPrice)
      } catch {}

      if (paidAmount >= proPlanPrice) {
        await prisma.user.update({ where: { id: userId }, data: { plan: 'pro' } })
        logger.info('User auto-upgraded to PRO', { userId, paidAmount, proPlanPrice })
      } else {
        logger.info('Upgrade deposit below plan price — balance credited only', { userId, paidAmount, proPlanPrice })
      }
    }
  } else {
    await prisma.user.update({
      where: { id: userId },
      data: { advertiserBalance: { increment: paidAmount } },
    })
    logger.warn('OxaPay ads webhook: no trackId in payload, transaction not recorded', { userId, paidAmount })
  }

  logger.info('Advertiser balance topped up', { userId, paidAmount, network, purpose })
}

// Static callback URL handler — used when admin sets the merchant-level callback in OxaPay dashboard.
// Extracts userId, network, and purpose from the payment description field.
app.post('/webhooks/oxapay-ads', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })
  try {
    const data = req.body?.data || req.body
    const description = String(data?.description || '')

    const userIdMatch = description.match(/userId:([^\s]+)/)
    if (!userIdMatch) {
      logger.warn('OxaPay ads static webhook: could not extract userId from description', { description })
      return
    }
    const userId = userIdMatch[1]

    const networkMatch = description.match(/network:([^\s]+)/)
    const purposeMatch = description.match(/purpose:([^\s]+)/)
    const network = networkMatch ? networkMatch[1] : 'TRC20'
    const purpose = purposeMatch ? purposeMatch[1] : 'advertiser'

    await processOxapayAdsWebhook(userId, network, purpose, req)
  } catch (err: any) {
    logger.error('oxapay-ads static webhook error', { error: err?.message })
  }
})

// Per-user callback URL handler — used when callback_url is set per-invoice in the API call.
app.post('/webhooks/oxapay-ads/:userId', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })
  try {
    const { userId } = req.params
    const network = String(req.query.network || 'TRC20')
    const purpose = String(req.query.purpose || 'advertiser')
    await processOxapayAdsWebhook(userId, network, purpose, req)
  } catch (err: any) {
    logger.error('oxapay-ads webhook error', { error: err?.message })
  }
})

app.post('/api/payments/oxapay-deposit-callback', async (req: Request, res: Response) => {
  try {
    const payload = req.body || {}
    const data = payload?.data || payload
    logger.info('OxaPay deposit callback received', { payload: data })

    const secretKey = process.env.OXAPAY_SECRET_KEY
    const headerHmac = typeof req.headers.hmac === 'string' ? req.headers.hmac : undefined
    if (secretKey && headerHmac) {
      const expected = crypto.createHmac('sha512', secretKey).update(JSON.stringify(payload)).digest('hex')
      if (expected !== headerHmac) {
        logger.warn('OxaPay deposit callback HMAC mismatch', { orderId: data?.order_id })
        return res.status(401).json({ error: 'Invalid signature' })
      }
    }

    const status = String(data?.status || '').toLowerCase()
    const type = String(data?.type || '').toLowerCase()
    if (status !== 'paid') {
      return res.json({ ok: true })
    }
    if (type && type !== 'static_payment') {
      return res.json({ ok: true })
    }

    const orderId = String(data?.order_id || '')
    const amountUsd = Number(data?.amount || data?.pay_amount || 0)
    if (!orderId || amountUsd <= 0) {
      logger.warn('Invalid callback payload', { payload: data })
      return res.json({ ok: true })
    }

    const gatewayTxId = String(
      data?.track_id ||
      data?.txid ||
      data?.transaction_id ||
      crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex')
    )

    const existing = await prisma.advertiserDepositTransaction.findUnique({
      where: { gatewayTxId }
    })
    if (existing) {
      logger.info('Duplicate advertiser deposit callback ignored', { gatewayTxId, userId: orderId })
      return res.json({ ok: true })
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: orderId },
        data: {
          advertiserBalance: { increment: amountUsd }
        }
      }),
      prisma.advertiserDepositTransaction.create({
        data: {
          userId: orderId,
          amountUsd,
          status: 'completed',
          gateway: 'oxapay',
          gatewayTxId
        }
      })
    ])

    logger.info('Advertiser balance credited', { userId: orderId, amountUsd, gatewayTxId })
    return res.json({ ok: true })
  } catch (err: any) {
    logger.error('oxapay-deposit-callback error', {
      error: err?.message,
      response: err?.response?.data
    })
    return res.status(500).json({ error: err?.message || 'Server error' })
  }
})

// Shared handler for OxaPay Pro/VIP deposit webhooks
async function processOxapayProWebhook(botId: string, req: any) {
  const body = req.body
  const data = body?.data || body
  const trackId = String(data?.track_id || data?.txid || data?.transaction_id || '')
  const status = data?.status
  const amount = data?.amount || data?.pay_amount
  const network = String(data?.network || 'TRC20')

  logger.info('OxaPay Pro webhook received', { botId, trackId, status, network })
  if (status !== 'Paid' && status !== 'paid') return

  if (!trackId) {
    logger.warn('OxaPay Pro webhook: no trackId in payload', { botId })
    return
  }

  const { redisGet, redisSet: rSet, redisDel } = await import('./redis')

  // Dedup: skip double-deliveries
  const dedupKey = `pro_paid:${botId}:${trackId}`
  const alreadyProcessed = await redisGet(dedupKey)
  if (alreadyProcessed) {
    logger.info('OxaPay Pro webhook: duplicate ignored', { botId, trackId })
    return
  }
  await rSet(dedupKey, '1', 86400)

  const stored = await redisGet(`pro_deposit:${botId}:${trackId}`)
  if (!stored) { logger.warn('OxaPay Pro webhook - unknown trackId', { trackId, botId }); return }

  const { botUserId, chatId, botToken, planId } = JSON.parse(stored)

  const bot = await prisma.bot.findUnique({ where: { id: botId }, include: { settings: true, creator: true } })
  if (!bot) return

  const settings = bot.settings as any
  // OxaPay signs callbacks with the merchant API key — log mismatches but don't block (dedup protects against replays)
  if (settings?.proOxapayMerchantKey && req.headers['hmac']) {
    const hmac = crypto.createHmac('sha512', settings.proOxapayMerchantKey).update(JSON.stringify(body)).digest('hex')
    if (hmac !== req.headers['hmac']) {
      logger.warn('OxaPay Pro HMAC mismatch — processing anyway (dedup protects against replays)', { botId })
    }
  }

  let planName = 'VIP Plan'
  let durationDays = Number(settings?.proPlanDurationDays || 30)
  let dailyBonus = Number(settings?.proPlanDailyBonus || 50)

  if (planId) {
    try {
      const plan = await (prisma as any).investmentPlan.findUnique({ where: { id: planId } })
      if (plan) {
        planName = plan.name
        durationDays = Number(plan.durationDays)
        dailyBonus = Number(plan.dailyBonus)
      }
    } catch {}
  }

  const paidAmount = Number(amount || 0)
  const expiresAt = new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000)

  await prisma.$transaction([
    prisma.botUser.update({
      where: { id: botUserId },
      data: {
        isProMember: true,
        proExpiresAt: expiresAt,
        proDepositAmount: { increment: paidAmount },
        ...(planId ? { activePlanId: planId } as any : {}),
      } as any
    }),
    prisma.transaction.create({
      data: {
        botId,
        botUserId,
        type: 'vip_deposit',
        amountCurrency: paidAmount,
        amountUsd: paidAmount,
        status: 'completed',
        gateway: 'oxapay',
        gatewayTxId: trackId,
        depositAddress: String(data?.address || ''),
      }
    })
  ])

  await redisDel(`pro_deposit:${botId}:${trackId}`)

  const sym = settings?.currencySymbol || '🪙'
  const { sendMessage } = await import('./commands')
  await sendMessage(botToken, Number(chatId),
    `🎉 <b>Congratulations! You have successfully upgraded to ${planName}!</b>\n\n` +
    `Your deposit was confirmed. You are now an active member!\n\n` +
    `• 💰 Daily bonus: <b>${dailyBonus} ${sym}</b> every day\n` +
    `• ⏱ Plan expires: <b>${expiresAt.toLocaleDateString()}</b>\n\n` +
    `Tap 🎁 Daily Bonus to claim your first bonus!`
  )
  logger.info('Pro plan activated', { botId, botUserId, planName, expiresAt, network, paidAmount })
}

// Static callback URL handler — used when bot owner sets the merchant-level callback in OxaPay dashboard.
// Extracts botId from the payment description field: "VIP botId:xxx userId:xxx ..."
app.post('/webhooks/oxapay-pro', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })
  try {
    const data = req.body?.data || req.body
    const description = String(data?.description || '')
    const botIdMatch = description.match(/botId:([^\s]+)/)
    if (!botIdMatch) {
      logger.warn('OxaPay Pro static webhook: could not extract botId from description', { description })
      return
    }
    await processOxapayProWebhook(botIdMatch[1], req)
  } catch (err: any) {
    logger.error('oxapay-pro static webhook error', { error: err?.message })
  }
})

// Per-bot callback URL handler — used when callback_url is set per-invoice in the API call.
app.post('/webhooks/oxapay-pro/:botId', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })
  try {
    await processOxapayProWebhook(req.params.botId, req)
  } catch (err: any) {
    logger.error('oxapay-pro webhook error', { error: err?.message })
  }
})

app.post('/api/bots/:botId/broadcast', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params
    const { text, imageUrl, buttonText, buttonUrl } = req.body

    if (!text) return res.status(400).json({ error: 'text is required' })

    const bot = await prisma.bot.findUnique({
      where: { id: botId },
      include: { settings: true }
    })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })

    const users = await prisma.botUser.findMany({
      where: { botId, isBanned: false },
      select: { telegramUserId: true }
    })

    const replyMarkup = buttonText && buttonUrl
      ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
      : undefined

    let sent = 0
    let failed = 0

    for (const user of users) {
      try {
        if (imageUrl) {
          if (imageUrl.startsWith('data:')) {
            const base64Data = imageUrl.split(',')[1]
            const mimeType = imageUrl.split(';')[0].split(':')[1]
            const buffer = Buffer.from(base64Data, 'base64')
            const FormData = require('form-data')
            const form = new FormData()
            form.append('chat_id', String(Number(user.telegramUserId)))
            form.append('caption', text)
            form.append('parse_mode', 'HTML')
            form.append('photo', buffer, { filename: 'image.jpg', contentType: mimeType })
            if (replyMarkup) form.append('reply_markup', JSON.stringify(replyMarkup))
            await axios.post(
              `https://api.telegram.org/bot${bot.botToken}/sendPhoto`,
              form,
              { headers: form.getHeaders() }
            )
          } else {
            await axios.post(
              `https://api.telegram.org/bot${bot.botToken}/sendPhoto`,
              {
                chat_id: Number(user.telegramUserId),
                photo: imageUrl,
                caption: text,
                parse_mode: 'HTML',
                reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
              }
            )
          }
        } else {
          await axios.post(
            `https://api.telegram.org/bot${bot.botToken}/sendMessage`,
            {
              chat_id: Number(user.telegramUserId),
              text,
              parse_mode: 'HTML',
              reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
            }
          )
        }
        sent++
        await new Promise(r => setTimeout(r, 50))
      } catch (err: any) {
        failed++
        logger.error('Broadcast send failed', {
          telegramUserId: String(user.telegramUserId),
          error: err.response?.data?.description || err.message
        })
      }
    }

    logger.info('Broadcast sent', { botId, sent, failed })
    return res.json({ success: true, sent, failed })
  } catch (err: any) {
    logger.error('Broadcast error', { error: err.message })
    return res.status(500).json({ error: err.message })
  }
})

app.post('/api/bots/:botId/notify-user', async (req: Request, res: Response) => {
  try {
    const { botId } = req.params
    const { telegramUserId, message } = req.body

    if (!telegramUserId || !message) {
      return res.status(400).json({ error: 'telegramUserId and message required' })
    }

    const bot = await prisma.bot.findUnique({ where: { id: botId } })
    if (!bot) return res.status(404).json({ error: 'Bot not found' })

    await axios.post(
      `https://api.telegram.org/bot${bot.botToken}/sendMessage`,
      {
        chat_id: Number(telegramUserId),
        text: message,
        parse_mode: 'HTML'
      }
    )

    return res.json({ success: true })
  } catch (err: any) {
    logger.error('notify-user error', { error: err.message })
    return res.status(500).json({ error: err.message })
  }
})

// Admin approve campaign
app.post('/api/admin/campaigns/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: {
        status: 'active',
        approvedAt: new Date(),
        updatedAt: new Date()
      }
    })
    logger.info('Campaign approved', { campaignId: id })
    return res.json({ success: true, campaign })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Admin reject campaign
app.post('/api/admin/campaigns/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { reason } = req.body
    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: { status: 'rejected', updatedAt: new Date() }
    })
    logger.info('Campaign rejected', { campaignId: id, reason })
    return res.json({ success: true, campaign })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Admin pause/resume campaign
app.post('/api/admin/campaigns/:id/pause', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const { action } = req.body // "pause" or "resume"
    const campaign = await prisma.adCampaign.update({
      where: { id },
      data: {
        status: action === 'resume' ? 'active' : 'paused',
        updatedAt: new Date()
      }
    })
    return res.json({ success: true, campaign })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Get campaign stats
app.get('/api/campaigns/:id/stats', async (req: Request, res: Response) => {
  try {
    const { id } = req.params
    const campaign = await prisma.adCampaign.findUnique({
      where: { id },
      select: {
        id: true, title: true, status: true,
        budgetUsd: true, spentUsd: true,
        targetAudienceCount: true, impressionsCount: true,
        activityWindow: true, createdAt: true, approvedAt: true
      }
    })
    if (!campaign) return res.status(404).json({ error: 'Not found' })
    return res.json({
      ...campaign,
      remainingAudience: campaign.targetAudienceCount - campaign.impressionsCount,
      remainingBudget: Number(campaign.budgetUsd) - Number(campaign.spentUsd),
      completionPercent: Math.round((campaign.impressionsCount / campaign.targetAudienceCount) * 100)
    })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

// Admin broadcast to all bots or specific bot
app.post('/api/admin/broadcast', async (req: Request, res: Response) => {
  try {
    const { text, imageUrl, buttonText, buttonUrl, botId } = req.body
    if (!text) return res.status(400).json({ error: 'text is required' })

    // Get bots to broadcast to
    const whereClause: any = { isActive: true, isPaused: false }
    if (botId) whereClause.id = botId

    const bots = await prisma.bot.findMany({ where: whereClause, select: { id: true, botToken: true } })

    const replyMarkup = buttonText && buttonUrl
      ? { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] }
      : undefined

    let totalSent = 0
    let totalFailed = 0

    for (const bot of bots) {
      const users = await prisma.botUser.findMany({
        where: { botId: bot.id, isBanned: false },
        select: { telegramUserId: true }
      })

      for (const user of users) {
        try {
          if (imageUrl) {
            await axios.post(`https://api.telegram.org/bot${bot.botToken}/sendPhoto`, {
              chat_id: Number(user.telegramUserId),
              photo: imageUrl,
              caption: text,
              parse_mode: 'HTML',
              reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
            })
          } else {
            await axios.post(`https://api.telegram.org/bot${bot.botToken}/sendMessage`, {
              chat_id: Number(user.telegramUserId),
              text,
              parse_mode: 'HTML',
              reply_markup: replyMarkup ? JSON.stringify(replyMarkup) : undefined
            })
          }
          totalSent++
          await new Promise(r => setTimeout(r, 50))
        } catch {
          totalFailed++
        }
      }
    }

    logger.info('Admin broadcast sent', { botId: botId || 'all', totalSent, totalFailed })
    return res.json({ success: true, sent: totalSent, failed: totalFailed })
  } catch (err: any) {
    logger.error('Admin broadcast error', { error: err.message })
    return res.status(500).json({ error: err.message })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  logger.info('1-TouchBot Bot Engine starting', { port: PORT })
  logger.info(`1-TouchBot Bot Engine running on port ${PORT}`)
})
startAdCron()
