import { rmSync, readdirSync } from 'fs'
import { join } from 'path'
import pino from 'pino'
import { toDataURL } from 'qrcode'
import \_\_dirname from './dirname.js'
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

const sessions = new Map()
const retries = new Map()

const app = express()
app.use(express.json())

// —————————————————————————————————————————————————————
// ✅ Rota interna opcional para envio rápido (via HTTP)
// —————————————————————————————————————————————————————
app.post('/chats/send', async (req, res) => {
const { device, receiver, message, delay: delayMs = 0 } = req.body
const entry = sessions.get(`device_${device}`)
if (!entry) return res.status(404).json({ message: 'Session not found' })

try {
if (delayMs) await delay(delayMs)

```
const toJid = formatPhone(receiver)

// Reconhece mensagens com botões, listas ou templateButtons
const payload = buildMessagePayload(message)

const result = await entry.sock.sendMessage(toJid, payload)
return res.json({ success: true, data: result })
```

} catch (e) {
console.error('🔥 /chats/send error:', e)
return res.status(500).json({ message: 'Failed to send message' })
}
})

// —————————————————————————————————————————————————————
// 🔧 Função auxiliar para construção do payload correto
// —————————————————————————————————————————————————————
function buildMessagePayload(message) {
// botão simples via Laravel: { text, footer, buttons, headerType }
if (message.buttons || message.buttonsMessage) {
const btn = message.buttonsMessage || {
text: message.text,
footer: message.footer,
buttons: message.buttons,
headerType: message.headerType
}
return { buttonMessage: btn }
}

// lista via Laravel: { title, text, footer, buttonText, sections }
if (message.listMessage || message.sections) {
const lst = message.listMessage || {
title: message.title,
text: message.text,
footer: message.footer,
buttonText: message.buttonText,
sections: message.sections
}
return { listMessage: lst }
}

// templateButtons (Baileys native)
if (message.templateButtons) {
return {
text: message.text,
footer: message.footer,
templateButtons: message.templateButtons
}
}

// fallback: texto simples, mídia, document, etc.
return message
}

// —————————————————————————————————————————————————————
// 🚀 Funções principais
// —————————————————————————————————————————————————————

// Gerenciamento de diretórios de sessão
const sessionsDir = id => join(\_\_dirname, 'sessions', id)

const shouldReconnect = id => {
const max = +process.env.MAX\_RETRIES || 3
const at = retries.get(id) || 0
if (at < max) {
retries.set(id, at + 1)
console.log(`🔄 Reconnect #${at + 1} for ${id}`)
return true
}
return false
}

const isSessionExists = id => sessions.has(`device_${id}`)

async function createSession(sessionId, isLegacy = false, res = null) {
const fileId = (isLegacy ? 'legacy\_' : 'md\_') + sessionId
const logger = pino({ level: 'silent' })

const { state, saveCreds } = await useMultiFileAuthState(sessionsDir(fileId))
const { version } = await fetchLatestBaileysVersion()

const sock = makeWASocket({
version,
auth: state,
logger,
browser: Browsers.ubuntu('Chrome'),
printQRInTerminal: false
})

sessions.set(`device_${sessionId}`, { sock, isLegacy })
sock.ev.on('creds.update', saveCreds)

sock.ev.on('messages.upsert', m => {
const msg = m.messages\[0]
if (msg && !msg.key.fromMe && !msg.key.remoteJid.endsWith('@g.us')) {
if (process.env.WEBHOOK\_URL) {
axios.post(process.env.WEBHOOK\_URL, {
sessionId,
remote\_id: msg.key.remoteJid,
message: msg.message
}).catch(console.error)
}
}
})

sock.ev.on('connection.update', up => {
const { connection, lastDisconnect, qr } = up
const code = lastDisconnect?.error?.output?.statusCode

```
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
```

})
}

function deleteSession(sessionId, isLegacy = false) {
const fileId = (isLegacy ? 'legacy\_' : 'md\_') + sessionId
rmSync(sessionsDir(fileId), { force: true, recursive: true })
sessions.delete(`device_${sessionId}`)
retries.delete(sessionId)
}

async function getChatList(sessionId, isGroup = false) {
const entry = sessions.get(`device_${sessionId}`)
if (!entry) return \[]
const filter = isGroup ? '@g.us' : '@s.whatsapp.net'
const all = await entry.sock.chatFetchAll()
return Object.values(all).filter(c => c.id.endsWith(filter))
}

async function isExists(session, jid, isGroup = false) {
try {
if (isGroup) {
const gm = await session.groupMetadata(jid)
return Boolean(gm.id)
}
const \[r] = await session.onWhatsApp(jid)
return !!r.exists
} catch {
return false
}
}

async function sendMessage(session, to, message, ms = 0) {
await delay(ms)
const payload = buildMessagePayload(message)
return session.sendMessage(to, payload)
}

// —————————————————————————————————————————————————————
// 🔗 Utilitários
// —————————————————————————————————————————————————————
function formatPhone(phone) {
const f = phone.replace(/\D/g, '')
return f.endsWith('@s.whatsapp.net') ? f : `${f}@s.whatsapp.net`
}

function formatGroup(grp) {
const f = grp.replace(/\[^\d-]/g, '')
return f.endsWith('@g.us') ? f : `${f}@g.us`
}

function cleanup() {}

function init() {
try {
readdirSync(join(**dirname, 'sessions')).forEach(f => {
if (!/^md*|^legacy*/.test(f)) return
const id = f.replace(/^(md\_|legacy\_)/, '')
createSession(id, f.startsWith('legacy\_'))
})
} catch {}
}

function getSession(sessionId) {
const e = sessions.get(`device_${sessionId}`)
return e?.sock ?? null
}

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
