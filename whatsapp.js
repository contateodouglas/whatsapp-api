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
  delay,
  makeInMemoryStore
} = pkg

// mantenha as sessões e tentativas
const sessions = new Map()
const retries = new Map()

// servidor interno pra /chats/send
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

// helper para diretório de credenciais
const sessionsDir = id => join(__dirname, 'sessions', id)

// controlar reconexões
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

// verifica se já existe
const isSessionExists = id => sessions.has(`device_${id}`)

// cria ou recarrega sessão
async function createSession(sessionId, isLegacy = false, res = null) {
  const fileId = (isLegacy ? 'legacy_' : 'md_') + sessionId
  const logger = pino({ level: 'silent' })

  // estado de autenticação
  const { state, saveCreds } = await useMultiFileAuthState(sessionsDir(fileId))
  const store = makeInMemoryStore({ logger })
  store.readFromFile(sessionsDir(`${fileId}_store.json`))
  store.ev.on('write', () => store.writeToFile(sessionsDir(`${fileId}_store.json`)))

  // qual versão do WA
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

  // bind do store
  store.bind(sock.ev)

  // adiciona na memória
  sessions.set(`device_${sessionId}`, { sock, isLegacy })

  // persiste credenciais
  sock.ev.on('creds.update', saveCreds)

  // webhook de mensagem recebida
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

  // monitor conexão
  sock.ev.on('connection.update', up => {
    const { connection, lastDisconnect, qr } = up
    const code = lastDisconnect?.error?.output?.statusCode

    if (connection === 'open') {
      retries.delete(sessionId)
      console.log(`✅ device_${sessionId} connected`)
    }
    if (connection === 'close') {
      if (code === DisconnectReason.loggedOut || !shouldReconnect(sessionId)) {
        if (res && !res.headersSent) response(res, 500, false, 'Unable to create session.')
        deleteSession(sessionId, isLegacy)
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

// remove sessão + store.json
function deleteSession(sessionId, isLegacy = false) {
  const fileId = (isLegacy ? 'legacy_' : 'md_') + sessionId
  // elimina pasta credenciais e store
  rmSync(sessionsDir(fileId), { force: true, recursive: true })
  rmSync(sessionsDir(`${fileId}_store.json`), { force: true })
  sessions.delete(`device_${sessionId}`)
  retries.delete(sessionId)
}

// lista chats (usa store e chatFetchAll)
async function getChatList(sessionId, isGroup = false) {
  const entry = sessions.get(`device_${sessionId}`)
  if (!entry) return []
  const filter = isGroup ? '@g.us' : '@s.whatsapp.net'
  const all = await entry.sock.chatFetchAll()
  return Object.values(all).filter(c => c.id.endsWith(filter))
}

// verifica existência de número ou grupo
async function isExists(session, jid, isGroup = false) {
  try {
    if (isGroup) {
      const gm = await session.groupMetadata(jid)
      return Boolean(gm.id)
    }
    const [r] = await session.onWhatsApp(jid)
    return !!r.exists
  } catch {
    return false
  }
}

// envia mensagem genérica
async function sendMessage(session, to, message, ms = 0) {
  await delay(ms)
  return session.sendMessage(to, message)
}

// utilitários de formatação
function formatPhone(phone) {
  const f = phone.replace(/\D/g, '')
  return f.endsWith('@s.whatsapp.net') ? f : `${f}@s.whatsapp.net`
}
function formatGroup(grp) {
  const f = grp.replace(/[^\d-]/g, '')
  return f.endsWith('@g.us') ? f : `${f}@g.us`
}

// salva antes de sair
function cleanup() {
  sessions.forEach((entry, k) => {
    try { entry.sock.ev.emit('write') } catch {}
  })
}

function init() {
  try {
    readdirSync(join(__dirname, 'sessions')).forEach(f => {
      if (!/^md_|^legacy_/.test(f)) return
      const id = f.replace(/^(md_|legacy_)/, '')
      createSession(id, f.startsWith('legacy_'))
    })
  } catch {}
}

function getSession(sessionId) {
  const e = sessions.get(`device_${sessionId}`)
  return e?.sock ?? null
}

// exporta tudo
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
