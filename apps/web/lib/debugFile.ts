import fs from 'fs'
import path from 'path'

function getDebugLogPath() {
  const cwd = process.cwd().replace(/\\/g, '/')
  if (cwd.endsWith('/apps/web') || cwd.endsWith('/apps/bot-engine')) {
    return path.resolve(process.cwd(), '..', '..', 'debug-auth-webhook.log')
  }
  return path.resolve(process.cwd(), 'debug-auth-webhook.log')
}

export function writeDebugLog(scope: string, message: string, data?: Record<string, unknown>) {
  const entry = {
    timestamp: new Date().toISOString(),
    scope,
    message,
    data: data || {},
  }

  try {
    fs.appendFileSync(getDebugLogPath(), JSON.stringify(entry) + '\n', 'utf8')
  } catch (error) {
    console.error('[debug-auth-webhook] failed to write log', error)
  }
}
