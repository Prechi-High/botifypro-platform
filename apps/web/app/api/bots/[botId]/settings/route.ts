import { NextResponse } from 'next/server'
import { prisma } from '@botifypro/database'
import { createClient } from '@/lib/supabase/server'

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
    include: { settings: true, creator: { select: { plan: true } } },
  })

  if (!bot?.settings) {
    return { error: NextResponse.json({ error: 'Bot not found' }, { status: 404 }) }
  }

  return { bot, user }
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { botId } = context.params
    const result = await getOwnedBot(botId)
    if ('error' in result) return result.error

    const { bot } = result
    const settings = bot.settings

    return NextResponse.json({
      botToken: bot.botToken,
      botUsername: bot.botUsername || 'your bot',
      webhookStatus: bot.webhookSet,
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
    return NextResponse.json({ error: error?.message || 'Failed to load settings' }, { status: 500 })
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { botId } = context.params
    const result = await getOwnedBot(botId)
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
    return NextResponse.json({ error: error?.message || 'Failed to save settings' }, { status: 500 })
  }
}
