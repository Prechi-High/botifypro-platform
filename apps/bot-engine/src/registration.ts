import axios from 'axios'
import { prisma } from '@botifypro/database'

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
  welcomeMessage: string
  currencyName: string
  currencySymbol: string
  usdRate: number
  category: string
}) {
  const validation = await validateBotToken(body.token)
  if (!validation.valid) throw new Error('Invalid bot token')

  const existing = await prisma.bot.findUnique({ where: { botToken: body.token } })
  if (existing) throw new Error('Bot already registered')

  const createdBot = await prisma.bot.create({
    data: {
      creatorId: body.creatorId,
      botToken: body.token,
      botUsername: validation.username || null,
      botName: validation.firstName || null,
      category: body.category || 'general',
      settings: {
        create: {
          welcomeMessage: body.welcomeMessage,
          currencyName: body.currencyName,
          currencySymbol: body.currencySymbol,
          usdToCurrencyRate: body.usdRate
        }
      }
    },
    include: { settings: true }
  })

  await registerWebhook(createdBot.id, body.token)
  return createdBot
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
    const bot = await registerBot(req.body)
    res.json(bot)
  } catch (err: any) {
    res.status(500).json({ message: err?.message || 'Server error' })
  }
}

