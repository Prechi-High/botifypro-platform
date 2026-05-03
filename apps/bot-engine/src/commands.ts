import { prisma } from '@botifypro/database'
import axios from 'axios'
import { logger } from './logger'
import { redisGet, redisSet, redisTtl, redisDel } from './redis'
import { getWithdrawalDestinationHint, getWithdrawProvider, hasAutomaticPayoutKey } from './payments/payouts'

export async function sendMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: object
) {
  try {
    const payload: any = { chat_id: chatId, text, parse_mode: 'HTML' }
    if (replyMarkup) payload.reply_markup = JSON.stringify(replyMarkup)
    const response = await axios.post(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      payload
    )
    if (!response.data?.ok) {
      logger.error('Telegram sendMessage failed', {
        error: response.data, chatId, textPreview: text.substring(0, 100)
      })
    }
  } catch (err: any) {
    logger.error('Telegram sendMessage error', {
      message: err?.message, response: err?.response?.data,
      chatId, textPreview: text?.substring(0, 100)
    })
  }
}

export async function handleStart(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!settings) {
    await sendMessage(bot.botToken, chatId, '👋 Welcome!')
    return
  }

  await redisDel('withdraw_state:' + botUser.id)
  await redisDel('withdraw_amount:' + botUser.id)

  const allButtons: any[] = []
  allButtons.push({ text: '💰 Balance' })
  allButtons.push({ text: '🔗 Referral' })
  if (settings.withdrawEnabled) allButtons.push({ text: '📤 Withdraw' })
  if (settings.dailyBonusEnabled || settings.bonusEnabled) allButtons.push({ text: '🎁 Daily Bonus' })
  // Leaderboard is a sub-command of Referral — NOT shown on main keyboard
  if (settings.depositEnabled) allButtons.push({ text: '📥 Deposit' })

  const investSettings = settings as any
  // Check creator plan — bot.creator is included in the webhook query.
  // Fall back to a direct DB lookup if the relation is missing (e.g. called from other contexts).
  let creatorPlan = bot.creator?.plan
  if (!creatorPlan && bot.creatorId) {
    try {
      const creatorRow = await prisma.user.findUnique({ where: { id: bot.creatorId }, select: { plan: true } })
      creatorPlan = creatorRow?.plan
    } catch {}
  }
  const isPro = creatorPlan === 'pro'
  if (isPro && investSettings.proPlanEnabled) {
    const investLabel = investSettings.proPlanButtonLabel || '💎 Invest'
    allButtons.push({ text: investLabel })
  }

  const maxButtons = isPro ? 6 : 4
  const buttonsToShow = allButtons.slice(0, maxButtons)
  const buttonsPerRow = isPro ? 3 : 2
  const keyboard: any[][] = []
  for (let i = 0; i < buttonsToShow.length; i += buttonsPerRow) {
    keyboard.push(buttonsToShow.slice(i, i + buttonsPerRow))
  }

  const replyMarkup = { keyboard, resize_keyboard: true, persistent: true, one_time_keyboard: false }

  if (settings.welcomeMessageEnabled !== false && settings.welcomeMessage) {
    await sendMessage(bot.botToken, chatId, settings.welcomeMessage, replyMarkup)
  } else {
    await sendMessage(bot.botToken, chatId, '👋 Welcome back!', replyMarkup)
  }
}

export async function handleBalance(bot: any, botUser: any, chatId: number) {
  const sym = bot.settings?.currencySymbol || '🪙'
  const currencyName = bot.settings?.currencyName || 'coins'

  // Fetch platform-level balance button config
  let balanceBtnText = '📢 Advertise with AdsGalaxy'
  let balanceBtnUrl = 'https://t.me/Ads_Galaxy_bot'
  try {
    const platformSettings = await (prisma as any).platformSettings.findFirst()
    if (platformSettings?.balanceButtonText) balanceBtnText = platformSettings.balanceButtonText
    if (platformSettings?.balanceButtonUrl) balanceBtnUrl = platformSettings.balanceButtonUrl
  } catch {}

  await sendMessage(
    bot.botToken, chatId,
    `🏦 <b>Account Balance Overview</b>\n\n` +
    `• User ID: ${botUser.telegramUserId}\n` +
    `• Balance: ${botUser.balance} ${sym} ${currencyName}\n\n` +
    `✅ Keep growing. Withdraw anytime!`,
    { inline_keyboard: [[{ text: balanceBtnText, url: balanceBtnUrl }]] }
  )
}

export async function handleHelp(bot: any, chatId: number) {
  const settings = bot.settings
  const buttons: any[] = []
  buttons.push({ text: '💰 Balance', callback_data: 'cmd_balance' })
  buttons.push({ text: '🔗 Referral', callback_data: 'cmd_referral' })
  if (settings?.withdrawEnabled) buttons.push({ text: '📤 Withdraw', callback_data: 'cmd_withdraw' })
  if (settings?.dailyBonusEnabled || settings?.bonusEnabled) buttons.push({ text: '🎁 Daily Bonus', callback_data: 'cmd_bonus' })
  if (settings?.leaderboardEnabled) buttons.push({ text: '🏆 Leaderboard', callback_data: 'cmd_leaderboard' })
  if (settings?.depositEnabled) buttons.push({ text: '📥 Deposit', callback_data: 'cmd_deposit' })
  const inline_keyboard: any[][] = []
  for (let i = 0; i < buttons.length; i += 2) inline_keyboard.push(buttons.slice(i, i + 2))
  await sendMessage(bot.botToken, chatId, '📋 <b>Menu</b>\n\nChoose an option below:', { inline_keyboard })
}

export async function handleBonus(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings as any
  const sym = settings?.currencySymbol || '🪙'
  const currencyName = settings?.currencyName || 'coins'

  // Check if user has an active pro/investment plan
  const isProMember = Boolean(botUser.isProMember)
  const proExpiry = botUser.proExpiresAt ? new Date(botUser.proExpiresAt) : null
  const hasActivePlan = isProMember && proExpiry && proExpiry > new Date()

  if (hasActivePlan && settings?.proPlanEnabled) {
    // Pro user — use their plan's daily bonus amount
    const activePlanId = (botUser as any).activePlanId
    let dailyBonus = Number(settings.proPlanDailyBonus || 50)
    let planTierEnabled = Boolean(settings.proTierReferralEnabled)
    let planTier1 = Number(settings.proTier1Percent || 40)
    let planTier2 = Number(settings.proTier2Percent || 20)
    let planTier3 = Number(settings.proTier3Percent || 5)

    if (activePlanId) {
      try {
        const plan = await (prisma as any).investmentPlan.findUnique({ where: { id: activePlanId } })
        if (plan) {
          dailyBonus = Number(plan.dailyBonus)
          planTierEnabled = Boolean(plan.tierEnabled)
          planTier1 = Number(plan.tier1Percent)
          planTier2 = Number(plan.tier2Percent)
          planTier3 = Number(plan.tier3Percent)
        }
      } catch {}
    }

    const bonusKey = `pro_bonus:${bot.id}:${botUser.id}`
    const claimed = await redisGet(bonusKey)
    if (claimed) {
      const ttl = await redisTtl(bonusKey)
      const hours = Math.floor(Math.max(0, ttl) / 3600)
      const minutes = Math.floor((Math.max(0, ttl) % 3600) / 60)
      await sendMessage(bot.botToken, chatId, `⏳ VIP bonus available again in ${hours}h ${minutes}m`)
      return
    }

    await prisma.botUser.update({ where: { id: botUser.id }, data: { balance: { increment: dailyBonus } } })
    await redisSet(bonusKey, '1', 86400)

    // 3-tier referral commission
    if (planTierEnabled && botUser.referredBy) {
      await payTierCommission(bot, botUser, dailyBonus, {
        ...settings, proTierReferralEnabled: true,
        proTier1Percent: planTier1, proTier2Percent: planTier2, proTier3Percent: planTier3
      }, 1)
    }

    const updatedUser = await prisma.botUser.findUnique({ where: { id: botUser.id }, select: { balance: true } })
    await sendMessage(
      bot.botToken, chatId,
      `⭐ <b>VIP Daily Bonus Claimed!</b>\n\n+${dailyBonus} ${sym} ${currencyName} added!\n💰 New balance: <b>${updatedUser?.balance} ${sym}</b>`
    )
    return
  }

  // Normal user — use standard daily bonus
  if (!settings?.dailyBonusEnabled && !settings?.bonusEnabled) {
    await sendMessage(bot.botToken, chatId, '🎁 Daily bonus is not enabled on this bot.')
    return
  }

  const rate = Math.max(1, Number(settings?.usdToCurrencyRate || 1000))
  const bonusAmount = settings?.dailyBonusAmount
    ? Number(settings.dailyBonusAmount)
    : settings?.bonusAmount
      ? Number(settings.bonusAmount)
      : Math.max(1, Math.floor(rate * 0.01))

  const bonusKey = `daily_bonus:${bot.id}:${botUser.id}`
  const claimed = await redisGet(bonusKey)
  if (claimed) {
    const ttl = await redisTtl(bonusKey)
    const hours = Math.floor(Math.max(0, ttl) / 3600)
    const minutes = Math.floor((Math.max(0, ttl) % 3600) / 60)
    const secs = Math.max(0, ttl) % 60
    await sendMessage(bot.botToken, chatId, `⏳ You can claim your bonus again in ${hours}h ${minutes}m ${secs}s`)
    return
  }

  await prisma.botUser.update({ where: { id: botUser.id }, data: { balance: { increment: bonusAmount } } })
  await redisSet(bonusKey, '1', 86400)
  const updatedUser = await prisma.botUser.findUnique({ where: { id: botUser.id }, select: { balance: true } })
  await sendMessage(
    bot.botToken, chatId,
    `🎁 <b>Daily Bonus Claimed!</b>\n\n+${bonusAmount} ${sym} ${currencyName} added to your balance!\n\n💰 New balance: <b>${updatedUser?.balance} ${sym}</b>`
  )
}

export async function handleReferralInfo(bot: any, botUser: any, chatId: number) {
  const { getReferralStats } = await import('./referral')
  const stats = await getReferralStats(bot.id, botUser.id)
  const botUsername = bot.botUsername || 'yourbot'
  const referralLink = `https://t.me/${botUsername}?start=ref_${botUser.id}`
  const sym = bot.settings?.currencySymbol || '🪙'
  const currencyName = bot.settings?.currencyName || 'coins'
  const rewardAmount = bot.settings?.referralRewardAmount || 100
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent('Join and start earning!')}`
  const subKeyboard: any[][] = []
  if (bot.settings?.leaderboardEnabled) subKeyboard.push([{ text: '🏆 Leaderboard' }])
  subKeyboard.push([{ text: '⬅️ Back' }])
  await sendMessage(
    bot.botToken, chatId,
    `🏁 <b>Referral Program Overview</b>\n\n` +
    `• Reward per invite: ${rewardAmount} ${sym} ${currencyName}\n` +
    `• Total referrals: ${stats.count}\n` +
    `• Your referral link:\n${referralLink}\n\n` +
    `Total earned: <b>${stats.totalEarned} ${sym} ${currencyName}</b>\n\n` +
    `⚠️ Please avoid fake or self-referrals.\n💬 Share your link and earn more daily!\n\n` +
    `📤 <a href="${shareUrl}">Tap to share your referral link</a>`,
    { keyboard: subKeyboard, resize_keyboard: true, persistent: true, one_time_keyboard: false }
  )
}

export async function handleLeaderboard(bot: any, botUser: any, chatId: number) {
  if (!bot.settings?.leaderboardEnabled) {
    await sendMessage(bot.botToken, chatId, '🏆 Leaderboard is not enabled.')
    return
  }
  const referralCounts = await prisma.referral.groupBy({
    by: ['referrerId'],
    where: { botId: bot.id },
    _count: { referrerId: true },
    orderBy: { _count: { referrerId: 'desc' } },
    take: 10
  })
  if (referralCounts.length === 0) {
    await sendMessage(bot.botToken, chatId, '🏆 <b>Leaderboard</b>\n\nNo referrals yet. Be the first!')
    return
  }
  const userIds = referralCounts.map(r => r.referrerId)
  const users = await prisma.botUser.findMany({ where: { id: { in: userIds } }, select: { id: true, firstName: true } })
  const medals = ['🥇', '🥈', '🥉']
  let text = `🏆 <b>Leaderboard — Top Referrers</b>\n\n`
  referralCounts.forEach((r, i) => {
    const user = users.find(u => u.id === r.referrerId)
    const medal = medals[i] || `${i + 1}.`
    const isMe = r.referrerId === botUser.id ? ' 👈 You' : ''
    text += `${medal} ${user?.firstName || 'User'} — ${r._count.referrerId} referrals${isMe}\n`
  })
  await sendMessage(bot.botToken, chatId, text, {
    keyboard: [[{ text: '⬅️ Back' }]],
    resize_keyboard: true, persistent: true, one_time_keyboard: false
  })
}

export async function handleDeposit(bot: any, botUser: any, chatId: number) {
  if (!bot?.settings?.depositEnabled) {
    await sendMessage(bot.botToken, chatId, '💳 Deposits are currently disabled.')
    return
  }
  const address = String(bot?.settings?.depositWalletAddress || '').trim()
  if (!address) {
    await sendMessage(bot.botToken, chatId, '💳 Deposit not configured. Contact bot owner.')
    return
  }
  await redisSet(`deposit_state:${botUser.id}`, 'awaiting_txhash', 600)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(address)}`
  await sendMessage(
    bot.botToken, chatId,
    `📥 <b>Deposit USDT TRC20 (Tron network)</b>\n\n` +
    `💳 Send <b>USDT on TRC20 (Tron)</b> network only\n\n` +
    `Send to this address:\n<code>${address}</code>\n\n` +
    `⚠️ <b>IMPORTANT:</b>\n• Only send USDT on <b>TRC20 (Tron)</b> network\n` +
    `• Sending on wrong network = <b>permanent loss of funds</b>\n` +
    `• Minimum deposit: ${bot.settings?.minDepositUsd || 1} USDT\n\n` +
    `After sending, reply with your <b>transaction hash (TXID)</b>.\n\n📷 QR Code: ${qrUrl}`,
    { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_deposit' }]] }
  )
}

export async function handleWithdraw(bot: any, botUser: any, chatId: number) {
  const settings = bot.settings
  if (!hasAutomaticPayoutKey(settings) && !settings?.manualWithdrawal) {
    await sendMessage(bot.botToken, chatId, '💳 Withdrawals not configured. Contact bot owner.')
    return
  }
  const sym = settings?.currencySymbol || '🪙'
  const currencyName = settings?.currencyName || 'coins'
  const rate = Number(settings?.usdToCurrencyRate || 1000)
  const minWithdrawUsd = Number(settings?.minWithdrawUsd || 0.5)
  const minWithdrawCurrency = minWithdrawUsd * rate
  const balance = Number(botUser.balance)
  if (balance < minWithdrawCurrency) {
    await sendMessage(bot.botToken, chatId,
      `❌ <b>Insufficient Balance</b>\n\nMinimum withdrawal: <b>${minWithdrawCurrency.toFixed(0)} ${sym}</b>\nYour balance: <b>${balance.toFixed(0)} ${sym}</b>\n\n👥 Share your referral link to earn more!`
    )
    return
  }
  const provider = getWithdrawProvider(settings)
  const providerLabel = provider === 'manual' ? 'Manual review'
    : provider === 'oxapay' ? 'OxaPay (USDT TRC20)'
    : `FaucetPay (${settings?.faucetpayPayoutCurrency || 'USDT'})`
  await redisSet('withdraw_state:' + botUser.id, 'awaiting_amount', 600)
  await sendMessage(
    bot.botToken, chatId,
    `📤 <b>Withdraw</b>\n\nProvider: <b>${providerLabel}</b>\nBalance: <b>${balance.toFixed(0)} ${sym} ${currencyName}</b>\nMinimum: <b>${minWithdrawCurrency.toFixed(0)} ${sym}</b>\n\nHow much do you want to withdraw?\nJust type the amount — e.g. <code>500</code> or <code>50 ${sym}</code>\n\n⏱ You have 10 minutes.`,
    { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]] }
  )
}

export async function handleWithdrawAmountSelected(bot: any, botUser: any, chatId: number, amount: number) {
  const settings = bot.settings
  const sym = settings?.currencySymbol || '🪙'
  const rate = Number(settings?.usdToCurrencyRate || 1000)
  const usdEquiv = amount / rate
  const feePercent = Number(settings?.withdrawFeePercent || 0)
  const feeUsd = usdEquiv * (feePercent / 100)
  const netUsd = usdEquiv - feeUsd
  await redisSet('withdraw_amount:' + botUser.id, String(amount), 600)
  await redisSet('withdraw_state:' + botUser.id, 'awaiting_address', 600)
  const provider = getWithdrawProvider(settings)
  const savedAddress = await redisGet(`withdraw_saved_address:${botUser.id}`) || null
  if (savedAddress) {
    const providerNote = provider === 'faucetpay'
      ? `\n💳 Payment via: <b>FaucetPay (${settings?.faucetpayPayoutCurrency || 'USDT'})</b>`
      : provider === 'oxapay' ? `\n💳 Payment via: <b>OxaPay (USDT TRC20)</b>` : ''
    await sendMessage(bot.botToken, chatId,
      `📤 <b>Withdrawal: ${amount.toLocaleString()} ${sym}</b>\n≈ ${netUsd.toFixed(4)} USD after fees${providerNote}\n\nYou have a saved address:\n<code>${savedAddress}</code>\n\nUse this address or enter a new one?`,
      { inline_keyboard: [
        [{ text: '✅ Use Saved Address', callback_data: 'withdraw_use_saved' }],
        [{ text: '✏️ Enter New Address', callback_data: 'withdraw_new_address' }],
        [{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]
      ]}
    )
  } else {
    const hint = getWithdrawalDestinationHint(settings)
    const addressLabel = provider === 'faucetpay'
      ? `📧 <b>FaucetPay is your payment method.</b>\n\nEnter your <b>FaucetPay email address</b> or a FaucetPay-linked wallet address to receive your payout:`
      : provider === 'oxapay'
        ? `💳 <b>OxaPay payout — USDT on TRC20 (Tron) network.</b>\n\nEnter your <b>USDT TRC20 wallet address</b>\n(starts with <b>T</b>, exactly 34 characters):`
        : `📝 Enter your payout address or account details:`
    await sendMessage(bot.botToken, chatId,
      `📤 <b>Withdrawal: ${amount.toLocaleString()} ${sym}</b>\n≈ ${netUsd.toFixed(4)} USD after fees\n\n${addressLabel}\n\n<i>${hint}</i>\n\n⏱ You have 10 minutes.`,
      { inline_keyboard: [[{ text: '❌ Cancel', callback_data: 'cmd_cancel_withdraw' }]] }
    )
  }
}

// ── INVESTMENT / PRO PLAN ─────────────────────────────────────────────────────

export async function handleProPlan(bot: any, botUser: any, chatId: number, page: number = 0) {
  const settings = bot.settings as any
  if (!settings?.proPlanEnabled) {
    await sendMessage(bot.botToken, chatId, '💎 Investment plans are not available on this bot.')
    return
  }

  const plans = await (prisma as any).investmentPlan.findMany({
    where: { botId: bot.id, isActive: true },
    orderBy: { sortOrder: 'asc' }
  })

  if (plans.length === 0) {
    await sendMessage(bot.botToken, chatId, '💎 No investment plans are available yet. Check back soon!', {
      keyboard: [[{ text: '⬅️ Back' }]],
      resize_keyboard: true, persistent: true, one_time_keyboard: false
    })
    return
  }

  const PAGE_SIZE = 5
  const totalPages = Math.ceil(plans.length / PAGE_SIZE)
  const pagePlans = plans.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // 3 plan buttons per row, max 5 per page
  const keyboard: any[][] = []
  const planButtons = pagePlans.map((plan) => ({ text: '💎 ' + plan.name }))
  for (let i = 0; i < planButtons.length; i += 3) {
    keyboard.push(planButtons.slice(i, i + 3))
  }

  const navRow: any[] = []
  if (page > 0) navRow.push({ text: '◀️ Previous' })
  if ((page + 1) < totalPages) navRow.push({ text: 'Next ▶️' })
  if (navRow.length > 0) keyboard.push(navRow)
  keyboard.push([{ text: '⬅️ Back' }])

  const planTitle = settings.proPlanButtonLabel || '💎 Invest'
  await sendMessage(
    bot.botToken, chatId,
    `${planTitle}\n\nChoose an investment plan:\n\n` +
    pagePlans.map((p, i) => (page * PAGE_SIZE + i + 1) + '. <b>' + p.name + '</b>\n   💰 ' + p.dailyBonus + ' ' + (settings.currencySymbol || '🪙') + '/day · ⏱ ' + p.durationDays + 'd · 💵 ' + p.activationAmount + ' USDT').join('\n\n'),
    { keyboard, resize_keyboard: true, persistent: true, one_time_keyboard: false }
  )

  await redisSet(`invest_page:${botUser.id}`, String(page), 300)
}

export async function handleProPlanDetail(bot: any, botUser: any, chatId: number, planButtonText: string) {
  const settings = bot.settings as any
  const sym = settings?.currencySymbol || '🪙'

  // Strip "💎 " prefix to get the plan name — button format is now "💎 PlanName"
  const cleanName = planButtonText.replace(/^💎\s*/, '').trim()
  const plan = await (prisma as any).investmentPlan.findFirst({
    where: { botId: bot.id, isActive: true, name: cleanName }
  })

  if (!plan) {
    await sendMessage(bot.botToken, chatId, '❌ Plan not found. Please try again.')
    return
  }

  const isProMember = Boolean((botUser as any).isProMember)
  const proExpiry = (botUser as any).proExpiresAt ? new Date((botUser as any).proExpiresAt) : null
  const isActive = isProMember && proExpiry && proExpiry > new Date()

  if (isActive) {
    const daysLeft = Math.ceil((proExpiry!.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    await sendMessage(bot.botToken, chatId,
      `💎 <b>You already have an active plan!</b>\n\n• Days remaining: <b>${daysLeft}</b>\n\nClaim your daily bonus below.`,
      { keyboard: [[{ text: '🎁 Claim Daily Bonus' }], [{ text: '⬅️ Back' }]], resize_keyboard: true, persistent: true, one_time_keyboard: false }
    )
    return
  }

  const proOxapayConfigured = Boolean(settings.proOxapayConfigured)
  const depositButtons: any[][] = []
  if (proOxapayConfigured) {
    depositButtons.push([{ text: `💳 Deposit $${plan.activationAmount} to Activate` }])
  }
  depositButtons.push([{ text: '⬅️ Back to Plans' }])
  depositButtons.push([{ text: '⬅️ Back' }])

  await redisSet(`invest_selected_plan:${botUser.id}`, plan.id, 600)

  await sendMessage(
    bot.botToken, chatId,
    `💎 <b>${plan.name}</b>\n\n` +
    `• 💰 Daily bonus: <b>${plan.dailyBonus} ${sym}</b> every day\n` +
    `• 🔗 Referral reward: <b>${plan.referralReward} ${sym}</b> per invite\n` +
    `• ⏱ Duration: <b>${plan.durationDays} days</b>\n` +
    `• 💵 Activation: <b>$${plan.activationAmount} USDT</b>\n\n` +
    (proOxapayConfigured ? `Tap below to deposit and activate this plan.` : `Contact the bot owner to activate this plan.`),
    { keyboard: depositButtons, resize_keyboard: true, persistent: true, one_time_keyboard: false }
  )
}


async function payTierCommission(bot: any, botUser: any, bonusAmount: number, settings: any, currentLevel: number) {
  if (currentLevel > 3 || !botUser.referredBy) return
  const percentKey = currentLevel === 1 ? 'proTier1Percent' : currentLevel === 2 ? 'proTier2Percent' : 'proTier3Percent'
  const percent = Number(settings[percentKey] || 0)
  if (percent <= 0) return
  const commission = Math.floor(bonusAmount * (percent / 100))
  if (commission <= 0) return
  const referrer = await prisma.botUser.findUnique({ where: { id: botUser.referredBy } })
  if (!referrer) return
  await prisma.botUser.update({ where: { id: referrer.id }, data: { balance: { increment: commission } } })
  const sym = settings?.currencySymbol || '🪙'
  await sendMessage(
    bot.botToken,
    Number(referrer.telegramUserId),
    `💸 <b>Tier ${currentLevel} Commission!</b>\n\n+${commission} ${sym} from your referral's VIP bonus.`
  )
  if (referrer.referredBy && currentLevel < 3) {
    await payTierCommission(bot, referrer, bonusAmount, settings, currentLevel + 1)
  }
}
