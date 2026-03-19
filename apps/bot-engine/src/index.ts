require('dotenv').config()

import express, { type Request, type Response } from 'express'
import cors from 'cors'
import axios from 'axios'
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
    res.json({ status: 'ok', timestamp: new Date(), service: 'BotifyPro Bot Engine' })
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
    
    const platformBotToken = process.env.PLATFORM_BOT_TOKEN
    if (!platformBotToken) {
      return res.status(500).json({ error: 'Platform bot not configured' })
    }

    // Get platform bot user ID first
    const meResponse = await axios.get(
      `https://api.telegram.org/bot${platformBotToken}/getMe` 
    )
    const platformBotId = meResponse.data.result.id

    // Check if platform bot is admin in channel
    const memberResponse = await axios.get(
      `https://api.telegram.org/bot${platformBotToken}/getChatMember`,
      { params: { chat_id: channelId, user_id: platformBotId } }
    )

    const status = memberResponse.data?.result?.status
    const isAdmin = ['administrator', 'creator'].includes(status)

    logger.info('Channel admin verification', { channelId, status, isAdmin })

    return res.json({
      isAdmin,
      status,
      message: isAdmin
        ? '@twinbot_twinbot is admin in this channel ✓'
        : '@twinbot_twinbot is NOT admin. Please add it as administrator first.'
    })
  } catch (error: any) {
    logger.error('Channel admin verify failed', { error: error.message })
    return res.status(500).json({ 
      error: 'Could not verify. Make sure channel ID is correct and channel is public or bot is already a member.' 
    })
  }
})

app.post('/webhooks/oxapay', async (req: Request, res: Response) => {
  try {
    logger.info('API call', { route: req.path, method: req.method })
    await handleOxapayWebhook(req, res)
  } catch (err: any) {
    logger.error('Server error', { error: err?.message, stack: err?.stack })
    res.status(500).json({ message: err?.message || 'Server error' })
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

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  logger.info('BotifyPro Bot Engine starting', { port: PORT })
  logger.info(`BotifyPro Bot Engine running on port ${PORT}`)
})

