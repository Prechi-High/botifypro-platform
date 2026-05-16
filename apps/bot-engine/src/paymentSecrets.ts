import crypto from 'crypto'

function getSecretKey() {
  const secret = process.env.PAYMENT_KEYS_SECRET || process.env.SECRET_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY
  if (!secret) {
    throw new Error('PAYMENT_KEYS_SECRET is not configured. Add PAYMENT_KEYS_SECRET to your .env file.')
  }
  return crypto.createHash('sha256').update(secret).digest()
}

export function decryptSecret(payload: string) {
  if (!payload) return ''

  // If it doesn't look like an encrypted payload (not 3 colon-separated hex parts),
  // it's stored as plaintext — return as-is
  const parts = String(payload).split(':')
  if (parts.length !== 3) {
    return payload // plaintext fallback
  }

  const [ivHex, tagHex, encryptedHex] = parts
  if (!ivHex || !tagHex || !encryptedHex) {
    return payload // plaintext fallback
  }

  try {
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
  } catch {
    // Decryption failed — key may be stored as plaintext or encrypted with a different secret
    return payload
  }
}
