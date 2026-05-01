import { NextResponse } from 'next/server'
import { prisma } from '@botifypro/database'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { writeDebugLog } from '@/lib/debugFile'

type RouteContext = {
  params: { botId: string }
}

function getCookieNames(request: Request) {
  const cookieHeader = request.headers.get('cookie') || ''
  return cookieHeader
    .split(';')
    .map((part) => part.trim().split('=')[0])
    .filter(Boolean)
}

// Extract the JWT from the cookie header directly
function extractJwt(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie') || ''
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=')
      return [k.trim(), v.join('=')]
    })
  )
  // Supabase SSR stores the token in sb-<ref>-auth-token or sb-access-token
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const ref = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] || ''
  const tokenKey = ref ? `sb-${ref}-auth-token` : null

  if (tokenKey && cookies[tokenKey]) {
    try {
      const parsed = JSON.parse(decodeURIComponent(cookies[tokenKey]))
      return parsed?.access_token || null
    } catch {}
  }

  // Fallback: look for any sb-*-auth-token cookie
  for (const [key, value] of Object.entries(cookies)) {
    if (key.includes('-auth-token')) {
      try {
        const parsed = JSON.parse(decodeURIComponent(value))
        if (parsed?.access_token) return parsed.access_token
      } catch {}
    }
  }

  return null
}

async function getWebhookStatus(botId: string, fallback: boolean) {
  const botEngineUrl = process.env.BOT_ENGINE_URL || process.env.NEXT_PUBLIC_BOT_ENGINE_URL || 'https://engine.1-touchbot.com'

  try {
    const response = await fetch(`${botEngineUrl}/api/bots/${botId}/webhook-status`, { cache: 'no-store' })
    const payload = await response.json()
    if (!response.ok) {
      writeDebugLog('web-settings-api', 'Webhook status fetch failed', {
        botId,
        status: response.status,
        fallback,
      })
      return fallback
    }

    return Boolean(payload?.webhookSet)
  } catch (error: any) {
    writeDebugLog('web-settings-api', 'Webhook status fetch threw error', {
      botId,
      fallback,
      error: error?.message || 'Unknown error',
    })
    return fallback
  }
}

async function getOwnedBot(request: Request, botId: string) {
  let userId: string | null = null

  // Primary: use the SSR client (works when cookies are fresh)
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) userId = user.id
  } catch {}

  // Fallback: decode JWT directly from cookie using service role client
  if (!userId) {
    const jwt = extractJwt(request)
    if (jwt) {
      try {
        const serviceClient = createServiceClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        )
        const { data: { user } } = await serviceClient.auth.getUser(jwt)
        if (user) userId = user.id
      } catch {}
    }
  }

  if (!userId) {
    writeDebugLog('web-settings-api', 'Unauthorized bot settings access', {
      botId,
      cookieNames: getCookieNames(request),
    })
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const bot = await prisma.bot.findFirst({
    where: { id: botId, creatorId: userId },
    include: { settings: true, creator: { select: { plan: true } } },
  })

  if (!bot?.settings) {
    writeDebugLog('web-settings-api', 'Bot settings not found', {
      botId,
      userId,
    })
    return { error: NextResponse.json({ error: 'Bot not found' }, { status: 404 }) }
  }

  return { bot, user: { id: userId } }
}

export async function GET(request: Request, context: RouteContext) {
  try {
    const { botId } = context.params
    const result = await getOwnedBot(request, botId)
    if ('error' in result) return result.error

    const { bot } = result
    const settings = bot.settings
    const webhookStatus = await getWebhookStatus(botId, Boolean(bot.webhookSet))

    writeDebugLog('web-settings-api', 'Loaded bot settings', {
      botId,
      userId: result.user.id,
      dbWebhookSet: Boolean(bot.webhookSet),
      returnedWebhookSet: webhookStatus,
    })

    return NextResponse.json({
      botToken: bot.botToken,
      botUsername: bot.botUsername || 'your bot',
      webhookStatus,
      userPlan: bot.creator.plan === 'pro' ? 'pro' : 'free',
      settings: {
        welcomeMessage: settings.welcomeMessage || '',
        captchaEnabled: settings.captchaEnabled ?? true,
        currencyName: settings.currencyName || 'Coins',
        currencySymbol: settings.currencySymbol || '🪙',
        usdToCurrencyRate: Number(settings.usdToCurrencyRate) || 1000,
        requireChannelJoin: Boolean(settings.requireChannelJoin),
        requiredChannels: Array.isArray(settings.requiredChannels) ? settings.requiredChannels : [],
        minWithdrawUsd: Number(settings.minWithdrawUsd) || 0.5,
        withdrawFeePercent: Number(settings.withdrawFeePercent) || 0,
        manualWithdrawal: Boolean(settings.manualWithdrawal),
        withdrawEnabled: Boolean(settings.withdrawEnabled),
        withdrawProvider: settings.withdrawProvider || 'faucetpay',
        withdrawalPassphrase: settings.withdrawalPassphrase || '',
        faucetpayConfigured: Boolean(settings.faucetpayConfigured),
        faucetpayMaskedKey: settings.faucetpayApiKeyLast4 ? `••••••••${settings.faucetpayApiKeyLast4}` : '',
        faucetpayPayoutCurrency: settings.faucetpayPayoutCurrency || 'USDT',
        oxapayConfigured: Boolean(settings.oxapayPayoutConfigured),
        oxapayMaskedKey: settings.oxapayPayoutApiKeyLast4 ? `••••••••${settings.oxapayPayoutApiKeyLast4}` : '',
      },
    })
  } catch (error: any) {
    writeDebugLog('web-settings-api', 'Failed to load settings', {
      error: error?.message || 'Unknown error',
    })
    return NextResponse.json({ error: error?.message || 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { botId } = context.params
    const result = await getOwnedBot(request, botId)
    if ('error' in result) return result.error

    const { bot } = result
    const body = await request.json()

    const userPlan = bot.creator.plan === 'pro' ? 'pro' : 'free'
    const withdrawMode = body.withdrawMode === 'manual' ? 'manual' : body.withdrawMode === 'automatic' ? 'automatic' : null
    const withdrawProvider = body.withdrawProvider === 'oxapay' ? 'oxapay' : 'faucetpay'

    if (withdrawMode === 'automatic' && userPlan !== 'pro' && withdrawProvider === 'oxapay') {
      return NextResponse.json({ error: 'OxaPay automatic payouts are available on Pro only' }, { status: 403 })
    }

    if (withdrawMode === 'automatic') {
      const providerConfigured = withdrawProvider === 'oxapay'
        ? bot.settings.oxapayPayoutConfigured
        : bot.settings.faucetpayConfigured

      if (!providerConfigured) {
        return NextResponse.json({ error: `${withdrawProvider === 'oxapay' ? 'OxaPay' : 'FaucetPay'} payout key is not configured` }, { status: 400 })
      }
    }

    if (withdrawMode === 'manual' && !String(body.withdrawalPassphrase || '').trim()) {
      return NextResponse.json({ error: 'Withdrawal passphrase is required for manual mode' }, { status: 400 })
    }

    const updated = await prisma.botSettings.update({
      where: { botId },
      data: {
        welcomeMessage: body.welcomeEnabled ? String(body.welcomeMessage || '') : '',
        captchaEnabled: Boolean(body.captchaEnabled),
        currencyName: String(body.currencyName || 'Coins'),
        currencySymbol: String(body.currencySymbol || '🪙'),
        usdToCurrencyRate: Number(body.usdToCurrencyRate || 1000),
        requireChannelJoin: Boolean(body.requireChannelJoin),
        requiredChannels: Array.isArray(body.requiredChannels) ? body.requiredChannels : [],
        minWithdrawUsd: Number(body.minWithdrawUsd || 0.5),
        withdrawFeePercent: Number(body.withdrawFeePercent || 0),
        manualWithdrawal: withdrawMode === 'manual',
        withdrawEnabled: withdrawMode !== null,
        withdrawProvider: withdrawMode === 'automatic' ? withdrawProvider : bot.settings.withdrawProvider || 'faucetpay',
        withdrawalPassphrase: withdrawMode === 'manual' ? String(body.withdrawalPassphrase || '').trim() : null,
      },
    })

    return NextResponse.json({
      success: true,
      withdrawProvider: updated.withdrawProvider || 'faucetpay',
    })
  } catch (error: any) {
    writeDebugLog('web-settings-api', 'Failed to save settings', {
      botId: context.params.botId,
      error: error?.message || 'Unknown error',
    })
    return NextResponse.json({ error: error?.message || 'Failed to save settings' }, { status: 500 })
  }
}
