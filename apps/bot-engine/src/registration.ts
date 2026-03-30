import axios from 'axios'
import { prisma } from '@botifypro/database'
import logger from './logger'

async function ensureUserExists(creatorId: string, email?: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id: creatorId }
  })

  if (!existingUser) {
    await prisma.user.create({
      data: {
        id: creatorId,
        email: email || `user_${creatorId}@botifypro.com`,
        passwordHash: 'supabase_auth',
        fullName: 'Creator',
        role: 'creator',
        plan: 'free'
      }
    })
    logger.info('Auto-created user record', { creatorId })
  }
}

export async function validateBotToken(token: string) {
  try {
    const response = await axios.get(`https://api.telegram.org/bot${token}/getMe`)
    if (response.data?.ok === true) {
      const result = response.data.result
      return { valid: true, id: result.id, username: result.username, firstName: result.first_name }
    }
    return { valid: false, error: 'Invalid token' }
  } catch {
    return { valid: false, error: 'Invalid token' }
  }
}

export async function registerWebhook(botId: string, botToken: string) {
  const webhookUrl = `${process.env.WEBHOOK_BASE_URL}/webhook/${botToken}`
  const result = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    url: webhookUrl,
    drop_pending_updates: true
  })
  await prisma.bot.update({ where: { id: botId }, data: { webhookSet: true } })
  return result.data
}

export async function registerBot(body: {
  token: string
  creatorId: string
  email?: string
  welcomeMessage: string
  currencyName: string
  currencySymbol: string
  usdRate: number
  category: string
}) {
  try {
    const validation = await validateBotToken(body.token)
    if (!validation.valid) throw new Error('Invalid bot token')

    await ensureUserExists(body.creatorId, body.email)

    const existing = await prisma.bot.findUnique({ where: { botToken: body.token } })
    if (existing) throw new Error('Bot already registered')

    const bot = await prisma.bot.create({
      data: {
        creatorId: body.creatorId,
        botToken: body.token,
        botUsername: validation.username || null,
        botName: validation.firstName || null,
        category: body.category || 'general',
        settings: {
          create: {
            welcomeMessage: body.welcomeMessage || 'Welcome! Use the buttons below.',
            currencyName: body.currencyName || 'Coins',
            currencySymbol: body.currencySymbol || '🪙',
            usdToCurrencyRate: Number.parseFloat(String(body.usdRate)) || 1000
          }
        }
      },
      include: { settings: true }
    })

    try {
      await registerWebhook(bot.id, body.token)
    } catch (webhookError: any) {
      logger.warn('Webhook registration failed but bot was created', {
        botId: bot.id,
        error: webhookError?.message || String(webhookError)
      })
    }

    logger.info('Bot registered successfully', { botId: bot.id, username: validation.username })
    return { success: true, bot: { id: bot.id, botUsername: bot.botUsername, botName: bot.botName } }
  } catch (error: any) {
    logger.error('Bot registration error', { error: error?.message || String(error) })
    throw error
  }
}

export async function validateBotTokenRoute(req: any, res: any) {
  try {
    const { token } = req.body || {}
    const result = await validateBotToken(token)
    res.json(result)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
}

export async function registerBotRoute(req: any, res: any) {
  try {
    const result = await registerBot(req.body)
    res.status(200).json(result)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
}

export async function registerWebhook(botId: string, botToken: string) {
  const base = process.env.WEBHOOK_BASE_URL
  if (!base) {
    throw new Error('WEBHOOK_BASE_URL environment variable is not set')
  }
  const webhookUrl = `${base}/webhook/${botToken}`
  const result = await axios.post(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    url: webhookUrl,
    drop_pending_updates: true
  })
  await prisma.bot.update({ where: { id: botId }, data: { webhookSet: true } })
  return result.data
}