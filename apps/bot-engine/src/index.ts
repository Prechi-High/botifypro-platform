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

