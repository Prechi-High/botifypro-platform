import crypto from 'crypto'

function getSecretKey() {
  const secret = process.env.PAYMENT_KEYS_SECRET || process.env.SECRET_ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYMENT_KEYS_SECRET is not configured')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', getSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`
}

export function maskSecret(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const last4 = trimmed.slice(-4)
  return `••••••••${last4}`
}

export function last4Secret(value: string) {
  return value.trim().slice(-4)
}
