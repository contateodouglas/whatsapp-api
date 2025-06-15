import { rmSync, readdir } from 'fs'
import { join } from 'path'
import pino from 'pino'
import { toDataURL } from 'qrcode'
import express from 'express'
import __dirname from './dirname.js'
import response from './response.js'
import bodyParser from 'body-parser'
import makeWASocket, {
  useMultiFileAuthState,
  makeInMemoryStore,
  Browsers,
  DisconnectReason,
  delay
} from '@adiwajshing/baileys'

const app = express()
app.use(bodyParser.json())

const sessions = new Map()
const retries = new Map()

const sessionsDir = (sessionId = '') => join(__dirname, 'sessions', sessionId)

const shouldReconnect = (sessionId) => {
  let maxRetries = parseInt(process.env.MAX_RETRIES ?? 0)
  let attempts = retries.get(sessionId) ?? 0
  maxRetries = Math.max(maxRetries, 1)
  if (attempts < maxRetries) {
    retries.set(sessionId, attempts + 1)
    console.log('Reconnecting...', { attempts: attempts + 1, sessionId })
    return true
  }
  return false
}

const createSession = async (sessionId, isLegacy = false, res = null) => {
  const sessionFile = `${isLegacy ? 'legacy_' : 'md_'}${sessionId}${isLegacy ? '.json' : ''}`
  const logger = pino({ level: 'warn' })
  const store = makeInMemoryStore({ logger })

  let state, saveState
  if (!isLegacy) {
    ({ state, saveCreds: saveState } = await useMultiFileAuthState(sessionsDir(sessionFile)))
  }

  const waConfig = {
    auth: state,
    version: [2, 3000, 1023249347],
    printQRInTerminal: false,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    patchMessageBeforeSending: (message) => {
      const requiresPatch = Boolean(message.buttonsMessage || message.listMessage)
      if (requiresPatch) {
        return {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
              ...message
            }
          }
        }
      }
      return message
    }
  }

  const wa = makeWASocket(waConfig)

  if (!isLegacy) {
    store.readFromFile(sessionsDir(`${sessionId}_store.json`))
    store.bind(wa.ev)
  }

  sessions.set(sessionId, { ...wa, store, isLegacy })
  wa.ev.on('creds.update', saveState)

  wa.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    const statusCode = lastDisconnect?.error?.output?.statusCode
    if (connection === 'open') retries.delete(sessionId)
    if (qr && res && !res.headersSent) {
      try {
        const qrData = await toDataURL(qr)
        response(res, 200, true, 'QR code received, please scan.', { qr: qrData })
      } catch {
        response(res, 500, false, 'Failed to generate QR.')
      }
    }
    if (connection === 'close') {
      if (statusCode === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
        if (res && !res.headersSent) response(res, 500, false, 'Session ended.')
        return deleteSession(sessionId, isLegacy)
      }
      setTimeout(
        () => createSession(sessionId, isLegacy, res),
        statusCode === DisconnectReason.restartRequired ? 0 : parseInt(process.env.RECONNECT_INTERVAL ?? 5000)
      )
    }
  })
}

// ### Express Routes ###
app.post('/chats/send', async (req, res) => {
  const session = sessions.get(req.query.id)
  if (!session) return res.status(404).json({ message: 'Session not found' })
  const { receiver, message, delay: d } = req.body
  try {
    if (d) await new Promise((r) => setTimeout(r, parseInt(d)))
    const isInteractive = Boolean(message.buttonsMessage || message.listMessage)
    const payload = isInteractive ? { viewOnceMessage: { message } } : message
    const result = await session.sendMessage(receiver, payload)
    res.json({ success: true, data: result })
  } catch (e) {
    console.error('Error on /chats/send:', e)
    res.status(500).json({ message: 'Failed to send the message.' })
  }
})

app.post('/groups/send', async (req, res) => {
  const session = sessions.get(req.query.id)
  if (!session) return res.status(404).json({ message: 'Session not found' })
  const { receiver, message, delay: d } = req.body
  try {
    if (d) await new Promise((r) => setTimeout(r, parseInt(d)))
    const isInteractive = Boolean(message.buttonsMessage || message.listMessage)
    const payload = isInteractive ? { viewOnceMessage: { message } } : message
    const result = await session.sendMessage(receiver, payload)
    res.json({ success: true, data: result })
  } catch (e) {
    console.error('Error on /groups/send:', e)
    res.status(500).json({ message: 'Failed to send group message.' })
  }
})

// ### Utilities ###
const deleteSession = (sessionId, isLegacy = false) => {
  const sessionFile = `${isLegacy ? 'legacy_' : 'md_'}${sessionId}${isLegacy ? '.json' : ''}`
  const storeFile = `${sessionId}_store.json`
  rmSync(sessionsDir(sessionFile), { force: true, recursive: true })
  rmSync(sessionsDir(storeFile), { force: true, recursive: true })
  sessions.delete(sessionId)
  retries.delete(sessionId)
}
const init = () => readdir(sessionsDir(), (err, files) => {
  if (err) throw err
  for (const file of files) {
    if ((!file.startsWith('md_') && !file.startsWith('legacy_')) || file.endsWith('_store')) continue
    const name = file.replace('.json', '')
    const isLegacy = name.split('_', 1)[0] !== 'md'
    const sessionId = name.substring(isLegacy ? 7 : 3)
    createSession(sessionId, isLegacy)
  }
})

// Start server
const PORT = process.env.PORT || 8000
app.listen(PORT, () => console.log(`Server listening on http://0.0.0.0:${PORT}`))
init()

export { createSession, deleteSession }
