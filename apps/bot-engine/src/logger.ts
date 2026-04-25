import fs from 'fs'
import path from 'path'
import { prisma } from '@1-touchbot/database'

const logsDir = path.join(process.cwd(), 'logs')

function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true })
  }
}

function getLogFile(): string {
  const date = new Date().toISOString().split('T')[0]
  return path.join(logsDir, `${date}.log`)
}

function formatMessage(level: string, message: string, data?: any): string {
  const timestamp = new Date().toISOString()
  const dataStr = data ? ' | ' + JSON.stringify(data) : ''
  return `[${timestamp}] [${level}] ${message}${dataStr}\n`
}

function writeLog(level: string, message: string, data?: any) {
  ensureLogsDir()
  const formatted = formatMessage(level, message, data)
  process.stdout.write(formatted)
  try {
    fs.appendFileSync(getLogFile(), formatted)
  } catch (err) {
    process.stdout.write(`[LOGGER ERROR] Could not write to log file: ${err}\n`)
  }

  if (level === 'INFO' || level === 'WARN' || level === 'ERROR') {
    try {
      prisma.log.create({
        data: {
          level,
          message,
          data: data ? JSON.stringify(data) : null,
          service: 'bot-engine'
        }
      }).catch(() => {})
    } catch {
      // ignore db logging errors
    }
  }
}

export const logger = {
  info: (message: string, data?: any) => writeLog('INFO', message, data),
  warn: (message: string, data?: any) => writeLog('WARN', message, data),
  error: (message: string, data?: any) => writeLog('ERROR', message, data),
  debug: (message: string, data?: any) => writeLog('DEBUG', message, data),
}

export default logger

