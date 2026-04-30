import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { prisma } from '@botifypro/database'
import { createClient } from '@/lib/supabase/server'
import { encryptSecret, last4Secret, maskSecret } from '@/lib/paymentSecrets'

type RouteContext = {
  params: { botId: string }
}

async function getOwnedBot(botId: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const bot = await prisma.bot.findFirst({
    where: { id: botId, creatorId: user.id },
    include: { settings: true, creator: { select: { plan: true, email: true } } },
  })

  if (!bot?.settings) {
    return { error: NextResponse.json({ error: 'Bot not found' }, { status: 404 }) }
  }

  return { bot, user }
}

async function verifyPassword(email: string, password: string) {
  const supabase = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return !error
}

function normalizeProvider(input: string) {
  return input === 'oxapay' ? 'oxapay' : 'faucetpay'
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { botId } = context.params
    const result = await getOwnedBot(botId)
    if ('error' in result) return result.error

    const { bot } = result
    const body = await request.json()
    const provider = normalizeProvider(String(body.provider || 'faucetpay'))
    const apiKey = String(body.apiKey || '').trim()
    const currentPassword = String(body.currentPassword || '')
    const isReplacing = provider === 'oxapay' ? bot.settings.oxapayPayoutConfigured : bot.settings.faucetpayConfigured

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    if (provider === 'oxapay' && bot.creator.plan !== 'pro') {
      return NextResponse.json({ error: 'OxaPay payout keys are available on Pro only' }, { status: 403 })
    }

    if (isReplacing) {
      if (!currentPassword) {
        return NextResponse.json({ error: 'Password is required to replace an existing key' }, { status: 400 })
      }

      const ok = await verifyPassword(bot.creator.email, currentPassword)
      if (!ok) {
        return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
      }
    }

    const encrypted = encryptSecret(apiKey)
    const last4 = last4Secret(apiKey)

    if (provider === 'oxapay') {
      await prisma.botSettings.update({
        where: { botId },
        data: {
          oxapayPayoutConfigured: true,
          oxapayPayoutApiKeyEncrypted: encrypted,
          oxapayPayoutApiKeyLast4: last4,
          oxapayMerchantKey: null,
          faucetpayWithdrawalKey: null,
        },
      })
    } else {
      await prisma.botSettings.update({
        where: { botId },
        data: {
          faucetpayConfigured: true,
          faucetpayApiKeyEncrypted: encrypted,
          faucetpayApiKeyLast4: last4,
          faucetpayApiKey: null,
        },
      })
    }

    return NextResponse.json({
      success: true,
      provider,
      configured: true,
      maskedKey: maskSecret(apiKey),
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save payment key' }, { status: 500 })
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    const { botId } = context.params
    const result = await getOwnedBot(botId)
    if ('error' in result) return result.error

    const { bot } = result
    const body = await request.json()
    const provider = normalizeProvider(String(body.provider || 'faucetpay'))
    const currentPassword = String(body.currentPassword || '')

    if (!currentPassword) {
      return NextResponse.json({ error: 'Password is required to remove a payment key' }, { status: 400 })
    }

    const ok = await verifyPassword(bot.creator.email, currentPassword)
    if (!ok) {
      return NextResponse.json({ error: 'Incorrect password' }, { status: 401 })
    }

    if (provider === 'oxapay') {
      await prisma.botSettings.update({
        where: { botId },
        data: {
          oxapayPayoutConfigured: false,
          oxapayPayoutApiKeyEncrypted: null,
          oxapayPayoutApiKeyLast4: null,
          withdrawProvider: bot.creator.plan === 'pro' && bot.settings.withdrawProvider === 'oxapay'
            ? 'faucetpay'
            : bot.settings.withdrawProvider,
        },
      })
    } else {
      await prisma.botSettings.update({
        where: { botId },
        data: {
          faucetpayConfigured: false,
          faucetpayApiKeyEncrypted: null,
          faucetpayApiKeyLast4: null,
          withdrawProvider: bot.settings.withdrawProvider === 'faucetpay' ? null : bot.settings.withdrawProvider,
        },
      })
    }

    return NextResponse.json({ success: true, provider, configured: false })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to remove payment key' }, { status: 500 })
  }
}
