import response from '../response.js'
import { getSession, formatPhone } from '../whatsapp.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Download de arquivo
async function downloadFile(url, path) {
  const writer = fs.createWriteStream(path)
  const res = await axios.get(url, { responseType: 'stream' })
  res.data.pipe(writer)
  return new Promise((resv, rej) => {
    writer.on('finish', resv)
    writer.on('error', rej)
  })
}

// Garante temp
function ensureTemp() {
  const dir = resolve(__dirname, '../temp')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

// Enviar texto simples
export const sendMessage = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, message } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const to = formatPhone(receiver)
    await session.sendMessage(to, { text: message })
    response(res, 200, true, 'Message sent.')
  } catch (e) {
    response(res, 500, false, 'Failed to send message.', e.message)
  }
}

// Enviar bulk
export const sendBulkMessage = async (req, res) => {
  const { id: sessionId } = req.query
  const { receivers, message } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const results = []
    for (let num of receivers) {
      const to = formatPhone(num)
      const result = await session.sendMessage(to, { text: message })
      results.push({ number: num, status: 'sent', result })
    }
    response(res, 200, true, 'Bulk sent.', results)
  } catch (e) {
    response(res, 500, false, 'Failed bulk.', e.message)
  }
}

// Enviar imagem
export const sendImage = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, mediaUrl, caption } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const to = formatPhone(receiver)
    const temp = ensureTemp()
    const p = resolve(temp, 'img')
    await downloadFile(mediaUrl, p)
    const buffer = fs.readFileSync(p)
    await session.sendMessage(to, { image: buffer, caption })
    fs.unlinkSync(p)
    response(res, 200, true, 'Image sent.')
  } catch (e) {
    response(res, 500, false, 'Failed image.', e.message)
  }
}

// Enviar vídeo
export const sendVideo = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, mediaUrl, caption } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const to = formatPhone(receiver)
    const temp = ensureTemp()
    const p = resolve(temp, 'vid')
    await downloadFile(mediaUrl, p)
    const buffer = fs.readFileSync(p)
    await session.sendMessage(to, { video: buffer, caption })
    fs.unlinkSync(p)
    response(res, 200, true, 'Video sent.')
  } catch (e) {
    response(res, 500, false, 'Failed video.', e.message)
  }
}

// Enviar áudio
export const sendAudio = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, mediaUrl, ptt = false } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const to = formatPhone(receiver)
    const temp = ensureTemp()
    const p = resolve(temp, 'aud')
    await downloadFile(mediaUrl, p)
    const buffer = fs.readFileSync(p)
    await session.sendMessage(to, { audio: buffer, ptt })
    fs.unlinkSync(p)
    response(res, 200, true, 'Audio sent.')
  } catch (e) {
    response(res, 500, false, 'Failed audio.', e.message)
  }
}

// Enviar botões
export const sendTextWithButton = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, message, buttons, footer } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const to = formatPhone(receiver)
    const buttonMessage = {
      text: message,
      footer,
      buttons: buttons.map((b, i) => ({ buttonId: `id${i}`, buttonText: { displayText: b }, type: 1 })),
      headerType: 1
    }
    await session.sendMessage(to, { buttonsMessage: buttonMessage })
    response(res, 200, true, 'Buttons sent.')
  } catch (e) {
    response(res, 500, false, 'Failed buttons.', e.message)
  }
}

// Enviar lista
export const sendListMessage = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, title, text, footer, buttonText, sections } = req.body
  const session = getSession(sessionId)
  if (!session) return response(res, 404, false, 'Session not found.')
  try {
    const to = formatPhone(receiver)
    const listMessage = { title, text, footer, buttonText, sections }
    await session.sendMessage(to, { listMessage })
    response(res, 200, true, 'List sent.')
  } catch (e) {
    response(res, 500, false, 'Failed list.', e.message)
  }
}
