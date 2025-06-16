import response from '../response.js'
import { getSession } from '../whatsapp.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Função para baixar arquivos temporários
async function downloadFile(fileUrl, outputLocationPath) {
    const writer = fs.createWriteStream(outputLocationPath)
    const response = await axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream'
    })
    response.data.pipe(writer)
    return new Promise((resolve, reject) => {
        writer.on('finish', resolve)
        writer.on('error', reject)
    })
}

// Enviar mensagem de texto
export const sendMessage = async (req, res) => {
    const { sessionId } = req.params
    const { to, message } = req.body

    const session = getSession(sessionId)

    if (!session) {
        return response(res, 404, false, 'Session not found.')
    }

    try {
        await session.sendMessage(to, message)
        response(res, 200, true, 'Message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send message.', err.message)
    }
}

// Enviar mensagem em massa (texto)
export const sendBulkMessage = async (req, res) => {
    const { sessionId } = req.params
    const { numbers, message } = req.body

    const session = getSession(sessionId)

    if (!session) {
        return response(res, 404, false, 'Session not found.')
    }

    try {
        const results = []

        for (const number of numbers) {
            const result = await session.sendMessage(number, message)
            results.push({ number, status: 'sent', result })
        }

        response(res, 200, true, 'Bulk message sent.', results)
    } catch (err) {
        response(res, 500, false, 'Failed to send bulk message.', err.message)
    }
}

// Enviar imagem
export const sendImage = async (req, res) => {
    const { sessionId } = req.params
    const { to, imageUrl, caption } = req.body

    const session = getSession(sessionId)

    if (!session) {
        return response(res, 404, false, 'Session not found.')
    }

    try {
        const mediaPath = resolve(__dirname, '../temp', 'image.jpg')
        await downloadFile(imageUrl, mediaPath)

        const media = await session.loadMedia(mediaPath)
        await session.sendMessage(to, media, { caption })

        fs.unlinkSync(mediaPath)

        response(res, 200, true, 'Image sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send image.', err.message)
    }
}

// Enviar vídeo
export const sendVideo = async (req, res) => {
    const { sessionId } = req.params
    const { to, videoUrl, caption } = req.body

    const session = getSession(sessionId)

    if (!session) {
        return response(res, 404, false, 'Session not found.')
    }

    try {
        const mediaPath = resolve(__dirname, '../temp', 'video.mp4')
        await downloadFile(videoUrl, mediaPath)

        const media = await session.loadMedia(mediaPath)
        await session.sendMessage(to, media, { caption })

        fs.unlinkSync(mediaPath)

        response(res, 200, true, 'Video sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send video.', err.message)
    }
}

// Enviar áudio
export const sendAudio = async (req, res) => {
    const { sessionId } = req.params
    const { to, audioUrl } = req.body

    const session = getSession(sessionId)

    if (!session) {
        return response(res, 404, false, 'Session not found.')
    }

    try {
        const mediaPath = resolve(__dirname, '../temp', 'audio.mp3')
        await downloadFile(audioUrl, mediaPath)

        const media = await session.loadMedia(mediaPath)
        await session.sendMessage(to, media, { sendAudioAsVoice: true })

        fs.unlinkSync(mediaPath)

        response(res, 200, true, 'Audio sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send audio.', err.message)
    }
}

// Enviar texto com botões
export const sendTextButton = async (req, res) => {
    const { sessionId } = req.params
    const { to, message, buttons, footer } = req.body

    const session = getSession(sessionId)

    if (!session) {
        return response(res, 404, false, 'Session not found.')
    }

    try {
        const buttonTemplate = {
            text: message,
            footer,
            buttons,
            headerType: 1
        }

        await session.sendMessage(to, buttonTemplate)

        response(res, 200, true, 'Button message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send button message.', err.message)
    }
}
