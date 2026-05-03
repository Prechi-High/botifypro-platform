import crypto from 'crypto'

export const ADMIN_SESSION_COOKIE = 'admin_session'
export const ADMIN_SESSION_VALUE = 'authenticated'
export const ADMIN_DEFAULT_PASSWORD = '123456'

export function hashAdminPassword(password: string): string {
  return crypto.createHash('sha256').update(password + 'botifypro_admin_salt').digest('hex')
}

export function verifyAdminPassword(password: string, storedHash: string): boolean {
  if (!storedHash || storedHash === '$2b$10$placeholder') {
    return password === ADMIN_DEFAULT_PASSWORD
  }
  return hashAdminPassword(password) === storedHash
}
