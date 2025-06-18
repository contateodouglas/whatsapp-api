import response from '../response.js'
import { getSession, formatPhone } from '../whatsapp.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 🔥 Faz download de arquivo
async function downloadFile(fileUrl, outputLocationPath) {
    const writer = fs.createWriteStream(outputLocationPath)
    const res = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream'
    })
    res.data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

// 🔧 Cria pasta temp se não existir
function ensureTempFolder() {
    const tempDir = resolve(__dirname, '../temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir)
    return tempDir
}

// ✉️ Enviar mensagem de texto
export const sendMessage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, message } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const to = formatPhone(receiver)
        await session.sendMessage(to, { text: message })
        response(res, 200, true, 'Message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send message.', err.message)
    }
}

// 📑 Enviar mensagem para vários números
export const sendBulkMessage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receivers, message } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const results = []
        for (const number of receivers) {
            const to = formatPhone(number)
            const result = await session.sendMessage(to, { text: message })
            results.push({ number, status: 'sent', result })
        }
        response(res, 200, true, 'Bulk message sent.', results)
    } catch (err) {
        response(res, 500, false, 'Failed to send bulk message.', err.message)
    }
}

// 🖼️ Enviar imagem
export const sendImage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, mediaUrl, caption } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const to = formatPhone(receiver)

        const tempDir = ensureTempFolder()
        const mediaPath = resolve(tempDir, 'image.jpg')
        await downloadFile(mediaUrl, mediaPath)

        const buffer = fs.readFileSync(mediaPath)
        await session.sendMessage(to, { image: buffer, caption })

        fs.unlinkSync(mediaPath)
        response(res, 200, true, 'Image sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send image.', err.message)
    }
}

// 🎥 Enviar vídeo
export const sendVideo = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, mediaUrl, caption } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const to = formatPhone(receiver)

        const tempDir = ensureTempFolder()
        const mediaPath = resolve(tempDir, 'video.mp4')
        await downloadFile(mediaUrl, mediaPath)

        const buffer = fs.readFileSync(mediaPath)
        await session.sendMessage(to, { video: buffer, caption })

        fs.unlinkSync(mediaPath)
        response(res, 200, true, 'Video sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send video.', err.message)
    }
}

// 🔊 Enviar áudio
export const sendAudio = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, mediaUrl, ptt = false } = req.body  // ptt = true se for áudio como voz

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const to = formatPhone(receiver)

        const tempDir = ensureTempFolder()
        const mediaPath = resolve(tempDir, 'audio.mp3')
        await downloadFile(mediaUrl, mediaPath)

        const buffer = fs.readFileSync(mediaPath)
        await session.sendMessage(to, { audio: buffer, ptt })

        fs.unlinkSync(mediaPath)
        response(res, 200, true, 'Audio sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send audio.', err.message)
    }
}

// 🔘 Enviar mensagem de texto com botões
export const sendTextWithButton = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, message, buttons, footer } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const to = formatPhone(receiver)

        const buttonTemplate = {
            text: message,
            footer,
            buttons,
            headerType: 1
        }

        await session.sendMessage(to, { buttonsMessage: buttonTemplate })
        response(res, 200, true, 'Button message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send button message.', err.message)
    }
}

// 📄 Enviar lista interativa
export const sendListMessage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, title, text, footer, buttonText, sections } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const to = formatPhone(receiver)

        const listMessage = {
            text,
            footer,
            title,
            buttonText,
            sections
        }

        await session.sendMessage(to, { listMessage })
        response(res, 200, true, 'List message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send list message.', err.message)
    }
}
