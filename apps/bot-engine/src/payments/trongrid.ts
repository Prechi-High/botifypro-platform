import axios from 'axios'
import crypto from 'crypto'
import { prisma } from '@1-touchbot/database'
import { sendMessage } from '../commands'
import logger from '../logger'
import { redisDel, redisGet, redisSet } from '../redis'
import redis from '../redis'

void [redisGet, redisSet]

/** Official USDT TRC20 on TRON mainnet (base58). */
const USDT_TRC20_CONTRACT_BASE58 = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'

const TRC20_TRANSFER_SELECTOR = 'a9059cbb'

const BASE58 =
  '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function decodeBase58(str: string): Buffer {
  const bytes: number[] = [0]
  for (let p = 0; p < str.length; p++) {
    const val = BASE58.indexOf(str[p]!)
    if (val < 0) throw new Error('invalid base58')
    let carry = val
    for (let i = 0; i < bytes.length; ++i) {
      carry += bytes[i]! * 58
      bytes[i] = carry & 0xff
      carry >>= 8
    }
    while (carry > 0) {
      bytes.push(carry & 0xff)
      carry >>= 8
    }
  }
  for (let p = 0; p < str.length && str[p] === '1'; p++) {
    bytes.push(0)
  }
  return Buffer.from(bytes.reverse())
}

/** Normalize any Tron address (T…, 41-hex, or 20-byte hex) to lowercase 41+40 hex. */
function tronAddressToHex41(addr: string): string | null {
  const a = addr.trim()
  if (/^[0-9a-fA-F]+$/.test(a)) {
    const h = a.toLowerCase().replace(/^0x/, '')
    if (h.length === 40) return ('41' + h).toLowerCase()
    if (h.length === 42 && h.startsWith('41')) return h.toLowerCase()
    return null
  }
  if (!a.startsWith('T')) return null
  try {
    const buf = decodeBase58(a)
    if (buf.length < 4) return null
    const payload = buf.subarray(0, -4)
    const chk = buf.subarray(-4)
    const want = crypto
      .createHash('sha256')
      .update(crypto.createHash('sha256').update(payload).digest())
      .digest()
      .subarray(0, 4)
    if (!chk.equals(want)) return null
    if (payload.length !== 21 || payload[0] !== 0x41) return null
    return payload.toString('hex').toLowerCase()
  } catch {
    return null
  }
}

function tronAddressesEqual(a: string, b: string): boolean {
  const ha = tronAddressToHex41(a)
  const hb = tronAddressToHex41(b)
  if (!ha || !hb) return false
  return ha === hb
}

function parseTrc20Transfer(dataHex: string): { recipientHex41: string; amountRaw: bigint } | null {
  const h = dataHex.replace(/^0x/i, '').toLowerCase()
  if (h.length < 8 + 128) return null
  if (h.slice(0, 8) !== TRC20_TRANSFER_SELECTOR) return null
  const recipient20 = h.slice(8 + 24, 8 + 24 + 40)
  if (recipient20.length !== 40) return null
  const amountHex = h.slice(8 + 64, 8 + 128)
  const amountRaw = BigInt('0x' + amountHex)
  return { recipientHex41: ('41' + recipient20).toLowerCase(), amountRaw }
}

function trxUsdFromEnv(amountTrx: number): number {
  const px = Number(process.env.TRX_USD_PRICE ?? '0.15')
  if (!Number.isFinite(px) || px <= 0) return amountTrx * 0.15
  return amountTrx * px
}

async function fetchTronTransaction(txHash: string): Promise<any | null> {
  const key = process.env.TRONGRID_API_KEY || ''
  const headers = key ? { 'TRON-PRO-API-KEY': key } : undefined

  try {
    const { data, status } = await axios.get(
      `https://api.trongrid.io/v1/transactions/${txHash}`,
      { headers, validateStatus: () => true, timeout: 25000 }
    )
    if (status === 200 && data) {
      const row = data?.data?.[0] ?? data?.data ?? data
      if (row?.raw_data) return row
    }
  } catch (err: any) {
    logger.warn('TronGrid v1 GET transactions failed', { error: err?.message })
  }

  try {
    const { data } = await axios.post(
      'https://api.trongrid.io/wallet/gettransactionbyid',
      { value: txHash },
      { headers, timeout: 25000 }
    )
    if (data?.raw_data) return data
  } catch (err: any) {
    logger.warn('TronGrid wallet gettransactionbyid failed', { error: err?.message })
  }
  return null
}

async function notify(bot: any, chatId: number, text: string) {
  await sendMessage(bot.botToken, chatId, text)
}

/**
 * Full TronGrid deposit verification: TRX (TransferContract) or USDT TRC20 (TriggerSmartContract).
 */
export async function verifyAndCreditDeposit(
  bot: any,
  botUser: any,
  txHash: string,
  chatId: number
): Promise<void> {
  const normalizedHash = (txHash || '').trim().toLowerCase()
  let lockAcquired = false
  const lockKey = `deposit_lock:${normalizedHash}`

  const fail = async (msg: string) => {
    await notify(bot, chatId, msg)
  }

  try {
    // 1. HASH FORMAT
    if (!/^[0-9a-f]{64}$/i.test(normalizedHash)) {
      await fail('❌ Invalid transaction hash format.')
      return
    }

    // 2. DUPLICATE
    const dup = await prisma.depositTransaction.findUnique({
      where: { txHash: normalizedHash }
    })
    if (dup) {
      await fail('❌ This transaction has already been processed.')
      return
    }

    // 3. LOCK
    const setNx = await redis.set(lockKey, '1', 'EX', 30, 'NX')
    if (setNx !== 'OK') {
      await fail('⏳ This transaction is already being processed.')
      return
    }
    lockAcquired = true

    if (!bot?.settings) {
      await fail('❌ Deposits are not configured for this bot.')
      return
    }

    // 4. FETCH
    const tx = await fetchTronTransaction(normalizedHash)
    if (!tx) {
      await fail('❌ Transaction not found on blockchain.')
      return
    }

    // 5. CONFIRMATION
    const ret = Array.isArray(tx.ret) ? tx.ret : []
    if (!ret[0] || ret[0].contractRet !== 'SUCCESS') {
      await fail('❌ Transaction not confirmed yet. Please wait and try again.')
      return
    }

    const contracts = tx.raw_data?.contract
    if (!Array.isArray(contracts) || contracts.length === 0) {
      await fail('❌ Transaction not found on blockchain.')
      return
    }

    const c0 = contracts[0]
    const ctype = c0?.type as string
    const value = c0?.parameter?.value ?? {}

    let coin: string
    let network: string
    let amountCrypto: number
    let recipientHex41: string | null
    let usdAmount: number

    if (ctype === 'TriggerSmartContract') {
      // 6 & 7 — USDT TRC20
      const contractAddr =
        value.contract_address ?? value.contractAddress ?? value.contract_address_Base58
      const dataHex: string =
        typeof value.data === 'string' ? value.data : String(value.data ?? '')

      if (!contractAddr || !dataHex) {
        await fail('❌ Only USDT (TRC20) deposits are accepted.')
        return
      }

      const matchesUsdt =
        contractAddr === USDT_TRC20_CONTRACT_BASE58 ||
        tronAddressesEqual(String(contractAddr), USDT_TRC20_CONTRACT_BASE58)
      if (!matchesUsdt) {
        await fail('❌ Only USDT (TRC20) deposits are accepted.')
        return
      }

      const parsed = parseTrc20Transfer(dataHex)
      if (!parsed) {
        await fail('❌ Only USDT (TRC20) deposits are accepted.')
        return
      }

      recipientHex41 = parsed.recipientHex41
      amountCrypto = Number(parsed.amountRaw) / 1_000_000
      coin = 'USDT'
      network = 'trc20'
      usdAmount = amountCrypto
    } else if (ctype === 'TransferContract') {
      const toRaw = value.to_address ?? value.toAddress
      const sun = Number(value.amount ?? 0)
      if (!toRaw || !Number.isFinite(sun)) {
        await fail('❌ Transaction not found on blockchain.')
        return
      }
      const hex = tronAddressToHex41(String(toRaw))
      recipientHex41 = hex
      amountCrypto = sun / 1_000_000
      coin = 'TRX'
      network = 'trx'
      usdAmount = trxUsdFromEnv(amountCrypto)
    } else {
      await fail('❌ Only USDT (TRC20) deposits are accepted.')
      return
    }

    // 8. RECIPIENT
    const expected = bot.settings.depositWalletAddress?.trim()
    if (
      !expected ||
      !recipientHex41 ||
      !tronAddressesEqual(recipientHex41, expected)
    ) {
      await fail("❌ Transaction was not sent to this bot's deposit address.")
      return
    }

    const recipientAddress = recipientHex41

    const rate = Number(bot.settings.usdToCurrencyRate ?? 0)
    const minUsd = bot.settings.minDepositUsd ?? 1.0

    // 10. MINIMUM
    if (usdAmount < minUsd) {
      await fail(
        `❌ Minimum deposit is $${minUsd.toFixed(2)} USD. You sent $${usdAmount.toFixed(2)}.`
      )
      return
    }

    const currencyAmount = usdAmount * rate
    const currencySymbol = bot.settings.currencySymbol ?? '🪙'

    // 11. CREDIT
    try {
      await prisma.$transaction([
        prisma.depositTransaction.create({
          data: {
            txHash: normalizedHash,
            botId: bot.id,
            botUserId: botUser.id,
            amountUsd: usdAmount,
            amountCrypto,
            coin,
            network,
            recipientAddress,
            status: 'completed'
          }
        }),
        prisma.botUser.update({
          where: { id: botUser.id },
          data: { balance: { increment: currencyAmount } }
        })
      ])
    } catch (error: any) {
      logger.error('verifyAndCreditDeposit prisma transaction failed', {
        error: error?.message,
        stack: error?.stack,
        txHash: normalizedHash,
        botId: bot.id
      })
      await fail('❌ Could not credit deposit. Try again or contact support.')
      return
    }

    await notify(
      bot,
      chatId,
      `✅ Deposit confirmed!\n\n+${currencyAmount.toFixed(0)} ${currencySymbol}\n≈ $${usdAmount.toFixed(2)} USD\n\nTX: ${normalizedHash}`
    )

    logger.info('Tron deposit credited', {
      txHash: normalizedHash,
      botId: bot.id,
      botUserId: botUser.id,
      coin,
      usdAmount,
      currencyAmount
    })
  } catch (error: any) {
    logger.error('verifyAndCreditDeposit top-level error', {
      error: error?.message,
      stack: error?.stack
    })
    await notify(bot, chatId, '❌ Transaction not found on blockchain.')
  } finally {
    if (lockAcquired) {
      await redisDel(lockKey)
    }
  }
}
