import axios from 'axios'
import { decryptSecret } from '../paymentSecrets'

export const FAUCETPAY_PAYOUT_CURRENCY = 'USDT'
export const OXAPAY_PAYOUT_CURRENCY = 'USDT'
export const OXAPAY_PAYOUT_NETWORK = 'TRC20'

export function getWithdrawProvider(settings: any) {
  if (settings?.manualWithdrawal) return 'manual'
  return settings?.withdrawProvider === 'oxapay' ? 'oxapay' : 'faucetpay'
}

export function hasAutomaticPayoutKey(settings: any) {
  const provider = getWithdrawProvider(settings)
  if (provider === 'oxapay') {
    return Boolean(settings?.oxapayPayoutConfigured && settings?.oxapayPayoutApiKeyEncrypted)
  }
  if (provider === 'faucetpay') {
    return Boolean(settings?.faucetpayConfigured && settings?.faucetpayApiKeyEncrypted)
  }
  return false
}

export function getWithdrawalDestinationHint(settings: any) {
  const provider = getWithdrawProvider(settings)
  if (provider === 'manual') {
    return 'Send your payout address or account details (bot owner will process manually).'
  }
  if (provider === 'oxapay') {
    return 'Reply with your USDT TRC20 wallet address (starts with T, 34 characters).'
  }
  return 'Reply with your FaucetPay email or a wallet address linked to your FaucetPay account. FaucetPay payouts are sent in USDT.'
}

export function validateWithdrawalDestination(settings: any, destination: string) {
  const trimmed = String(destination || '').trim()
  const provider = getWithdrawProvider(settings)

  if (provider === 'manual') {
    if (trimmed.length < 10) {
      return '❌ Invalid payout details. Please try again.'
    }
    return null
  }

  if (provider === 'oxapay') {
    if (!trimmed.startsWith('T') || trimmed.length !== 34 || !/^[A-Za-z0-9]{34}$/.test(trimmed)) {
      return '❌ Invalid TRC20 address.\n\nA valid address starts with T and is exactly 34 characters.\n\nPlease try again with a valid TRX address.'
    }
    return null
  }

  const looksLikeEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
  if (looksLikeEmail || trimmed.length >= 10) {
    return null
  }
  return '❌ Invalid FaucetPay destination.\n\nSend a FaucetPay email or a wallet address linked to your FaucetPay account.'
}

export async function executeFaucetPayPayout(settings: any, destination: string, amountUsd: number) {
  const encryptedKey = settings?.faucetpayApiKeyEncrypted
  if (!encryptedKey) {
    throw new Error('FaucetPay payout key is not configured')
  }

  const apiKey = decryptSecret(encryptedKey)
  const payoutUnits = Math.max(1, Math.round(amountUsd * 1e8))
  const payload = new URLSearchParams({
    api_key: apiKey,
    amount: String(payoutUnits),
    to: destination.trim(),
    currency: settings?.faucetpayPayoutCurrency || FAUCETPAY_PAYOUT_CURRENCY,
  })

  const response = await axios.post('https://faucetpay.io/api/v1/send', payload.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  const data = response.data || {}
  if (Number(data.status) !== 200) {
    throw new Error(data.message || 'FaucetPay payout failed')
  }

  return {
    gateway: 'faucetpay',
    gatewayTxId: String(data.payout_id || `${Date.now()}`),
    status: 'completed',
    payoutCurrency: String(data.currency || settings?.faucetpayPayoutCurrency || FAUCETPAY_PAYOUT_CURRENCY),
    payoutAmount: amountUsd,
  }
}

export async function executeOxapayPayout(settings: any, destination: string, amountUsd: number, callbackUrl?: string) {
  const encryptedKey = settings?.oxapayPayoutApiKeyEncrypted
  if (!encryptedKey) {
    throw new Error('OxaPay payout key is not configured')
  }

  const payoutApiKey = decryptSecret(encryptedKey)
  const response = await axios.post(
    'https://api.oxapay.com/v1/payout',
    {
      address: destination.trim(),
      amount: Number(amountUsd.toFixed(8)),
      currency: OXAPAY_PAYOUT_CURRENCY,
      network: OXAPAY_PAYOUT_NETWORK,
      callback_url: callbackUrl,
      description: '1-TouchBot withdrawal payout',
    },
    {
      headers: {
        payout_api_key: payoutApiKey,
        'Content-Type': 'application/json',
      },
    }
  )

  const data = response.data || {}
  if (Number(data.status) !== 200) {
    throw new Error(data?.error?.message || data.message || 'OxaPay payout failed')
  }

  return {
    gateway: 'oxapay',
    gatewayTxId: String(data?.data?.track_id || `${Date.now()}`),
    status: String(data?.data?.status || 'processing').toLowerCase(),
    payoutCurrency: OXAPAY_PAYOUT_CURRENCY,
    payoutAmount: amountUsd,
  }
}
