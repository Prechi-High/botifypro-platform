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
    const merchantKey = process.env.OXAPAY_MERCHANT_KEY
    if (!merchantKey) {
      return res.status(500).json({ error: 'Payment gateway not configured' })
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

app.post('/webhooks/oxapay-ads/:userId', async (req: Request, res: Response) => {
  res.status(200).json({ ok: true })
  try {
    const { userId } = req.params
    const body = req.body
    const secretKey = process.env.OXAPAY_SECRET_KEY
    if (secretKey) {
      const hmac = crypto.createHmac('sha512', secretKey).update(JSON.stringify(body)).digest('hex')
      if (hmac !== req.headers['hmac']) {
        logger.error('OxaPay ads HMAC mismatch', { userId })
        return
      }
    }
    const status = body?.data?.status || body?.status
    const amount = body?.data?.amount || body?.amount
    logger.info('OxaPay ads webhook received', { userId, status, amount })
    if (status !== 'Paid' && status !== 'paid') return
    const paidAmount = Number(amount)
    if (!paidAmount) return
    await prisma.user.update({
      where: { id: userId },
      data: { advertiserBalance: { increment: paidAmount } },
    })
    logger.info('Advertiser balance topped up', { userId, paidAmount })
  } catch (err: any) {
    logger.error('oxapay-ads webhook error', { error: err?.message })
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
      } catch {
        failed++
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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  logger.info('1-TouchBot Bot Engine starting', { port: PORT })
  logger.info(`1-TouchBot Bot Engine running on port ${PORT}`)
})
