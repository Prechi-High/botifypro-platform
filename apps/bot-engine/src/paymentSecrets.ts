import crypto from 'crypto'

function getSecretKey() {
  const secret = process.env.PAYMENT_KEYS_SECRET || process.env.SECRET_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYMENT_KEYS_SECRET is not configured. Add PAYMENT_KEYS_SECRET to your .env file.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function decryptSecret(payload: string) {
  const [ivHex, tagHex, encryptedHex] = String(payload || '').split(':')
  if (!ivHex || !tagHex || !encryptedHex) {
    throw new Error('Invalid encrypted secret payload')
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    getSecretKey(),
    Buffer.from(ivHex, 'hex')
  )
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
