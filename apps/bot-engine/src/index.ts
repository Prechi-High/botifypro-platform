require('dotenv').config()

import express from 'express'
import cors from 'cors'
import { handleWebhook } from './webhook'
import { registerBot, registerBotRoute, validateBotTokenRoute } from './registration'
import { handleOxapayWebhook } from './payments/oxapay'
import { prisma } from '@botifypro/database'
import { registerWebhook } from './registration'

const app = express()
app.use(express.json())
app.use(cors())

app.get('/health', async (_req, res) => {
  try {
    res.json({ status: 'ok', timestamp: new Date(), service: 'BotifyPro Bot Engine' })
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/webhook/:botToken', async (req, res) => {
  try {
    await handleWebhook(req, res)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/api/bots/validate', async (req, res) => {
  try {
    await validateBotTokenRoute(req, res)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/api/bots/register', async (req, res) => {
  try {
    await registerBotRoute(req, res)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/webhooks/oxapay', async (req, res) => {
  try {
    await handleOxapayWebhook(req, res)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

app.post('/api/admin/refresh-webhooks', async (_req, res) => {
  try {
    const bots = await prisma.bot.findMany({ where: { isActive: true } })
    for (const bot of bots) {
      try {
        await registerWebhook(bot.id, bot.botToken)
      } catch {}
    }
    res.json({ ok: true, count: bots.length })
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => {
  console.log(`BotifyPro Bot Engine running on port ${PORT}`)
})

