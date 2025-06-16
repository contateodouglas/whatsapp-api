import { rmSync, readdirSync } from 'fs'
import { join } from 'path'
import pino from 'pino'
import { toDataURL } from 'qrcode'
import __dirname from './dirname.js'
import response from './response.js'
import axios from 'axios'
import express from 'express'
import pkg from '@whiskeysockets/baileys'

const {
  default: makeWASocket,
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  delay
} = pkg

// Sessões e tentativas de reconexão
const sessions = new Map()
const retries = new Map()

// Express interno para envio direto
const app = express()
app.use(express.json())

app.post('/chats/send', async (req, res) => {
  const { device, receiver, message, delay: delayMs = 0 } = req.body

  const entry = sessions.get(`device_${device}`)
  if (!entry) return res.status(404).json({ message: 'Session not found' })

  try {
    if (delayMs) await new Promise(r => setTimeout(r, delayMs))
    const interactive = Boolean(message.buttonsMessage || message.listMessage)
    const payload = interactive
      ? { viewOnceMessage: { message } }
      : message

    const toJid = /^\d+@s\.whatsapp\.net$/.test(receiver)
      ? receiver
      : `${receiver.replace(/\D/g, '')}@s.whatsapp.net`

    const result = await entry.sock.sendMessage(toJid, payload)
    return res.json({ success: true, data: result })
  } catch (e) {
    console.error('🔥 /chats/send error:', e)
    return res.status(500).json({ message: 'Failed to send message' })
  }
})

// Diretórios e reconexões
const sessionsDir = id => join(__dirname, 'sessions', id)

const shouldReconnect = id => {
  const max = +process.env.MAX_RETRIES || 3
  const at = retries.get(id) || 0
  if (at < max) {
    retries.set(id, at + 1)
    console.log(`🔄 Reconnect #${at + 1} for ${id}`)
    return true
  }
  return false
}

// 🔗 Helpers
const isSessionExists = id => {
  return sessions.has(id)
}

// 🔌 Cria sessão
async function createSession(sessionId, isLegacy = false, res = null) {
  const fileId = (isLegacy ? 'legacy_' : 'md_') + sessionId
  const logger = pino({ level: 'silent' })

  const { state, saveCreds } = await useMultiFileAuthState(sessionsDir(fileId))
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger,
    browser: Browsers.ubuntu('Chrome'),
    printQRInTerminal: false,
    patchMessageBeforeSending: msg => {
      if (msg.buttonsMessage || msg.listMessage) {
        return {
          viewOnceMessage: {
            message: {
              messageContextInfo: { deviceListMetadataVersion: 2, deviceListMetadata: {} },
              ...msg
            }
          }
        }
      }
      return msg
    }
  })

  sessions.set(sessionId, { sock, isLegacy })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', m => {
    const msg = m.messages[0]
    if (msg && !msg.key.fromMe && !msg.key.remoteJid.endsWith('@g.us')) {
      axios.post(process.env.WEBHOOK_URL, {
        sessionId,
        remote_id: msg.key.remoteJid,
        message: msg.message
      }).catch(console.error)
    }
  })

  sock.ev.on('connection.update', up => {
    const { connection, lastDisconnect, qr } = up
    const code = lastDisconnect?.error?.output?.statusCode

    if (connection === 'open') {
      retries.delete(sessionId)
      console.log(`✅ ${sessionId} connected`)
    }
    if (connection === 'close') {
      if (code === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
        if (res && !res.headersSent) response(res, 500, false, 'Unable to create session.')
        deleteSession(sessionId)
      } else {
        setTimeout(() => createSession(sessionId, isLegacy, res),
          code === DisconnectReason.restartRequired ? 0 : (+process.env.RECONNECT_INTERVAL || 5000)
        )
      }
    }
    if (qr && res && !res.headersSent) {
      toDataURL(qr)
        .then(q => response(res, 200, true, 'QR received', { qr: q }))
        .catch(() => response(res, 500, false, 'QR generation failed'))
    }
  })
}

// ❌ Deleta sessão
function deleteSession(sessionId) {
  const fileId = `md_${sessionId}`
  ;[fileId].forEach(f =>
    rmSync(sessionsDir(f), { force: true, recursive: true })
  )
  sessions.delete(sessionId)
  retries.delete(sessionId)
}

// 📑 Lista chats
async function getChatList(sessionId, isGroup = false) {
  const entry = sessions.get(sessionId)
  if (!entry) return []
  const filter = isGroup ? '@g.us' : '@s.whatsapp.net'
  const chats = await entry.sock.chatFetchAll()
  return chats.filter(c => c.id.endsWith(filter))
}

// 🔍 Verifica existência
async function isExists(session, jid, isGroup = false) {
  try {
    if (isGroup) {
      const gm = await session.groupMetadata(jid)
      return Boolean(gm.id)
    }
    const [r] = await session.onWhatsApp(jid)
    return !!r?.exists
  } catch {
    return false
  }
}

// ✉️ Envio
async function sendMessage(sessionEntry, to, message, ms = 0) {
  await delay(ms)
  return sessionEntry.sock.sendMessage(to, message)
}

// 🔢 Formata número
function formatPhone(phone) {
  const f = phone.replace(/\D/g, '')
  return f.endsWith('@s.whatsapp.net') ? f : `${f}@s.whatsapp.net`
}

// 🔢 Formata grupo
function formatGroup(grp) {
  const f = grp.replace(/[^\d-]/g, '')
  return f.endsWith('@g.us') ? f : `${f}@g.us`
}

// 🧹 Cleanup
function cleanup() {
  console.log('🧹 Running cleanup before exit.')
  // As credenciais são salvas automaticamente
}

// 🚀 Init (carregar sessões existentes)
function init() {
  try {
    readdirSync(sessionsDir()).forEach(f => {
      if (!/^md_|^legacy_/.test(f)) return
      const id = f.replace(/^(md_|legacy_)/, '')
      createSession(id, f.startsWith('legacy_'))
    })
  } catch {}
}

// 🔗 Retorna sessão ativa
function getSession(sessionId) {
  const e = sessions.get(sessionId)
  return e ? e.sock : null
}

// ✅ Exporta tudo
export {
  init,
  cleanup,
  isSessionExists,
  createSession,
  getSession,
  deleteSession,
  getChatList,
  isExists,
  sendMessage,
  formatPhone,
  formatGroup
}
