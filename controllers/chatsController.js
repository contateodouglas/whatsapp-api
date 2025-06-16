import response from '../response.js'
import { getSession } from '../whatsapp.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

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

export const sendMessage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, message } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        await session.sendMessage(receiver, message)
        response(res, 200, true, 'Message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send message.', err.message)
    }
}

export const sendBulkMessage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receivers, message } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const results = []
        for (const number of receivers) {
            const result = await session.sendMessage(number, message)
            results.push({ number, status: 'sent', result })
        }
        response(res, 200, true, 'Bulk message sent.', results)
    } catch (err) {
        response(res, 500, false, 'Failed to send bulk message.', err.message)
    }
}

export const sendImage = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, mediaUrl, caption } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const mediaPath = resolve(__dirname, '../temp', 'image.jpg')
        await downloadFile(mediaUrl, mediaPath)

        const media = await session.loadMedia(mediaPath)
        await session.sendMessage(receiver, media, { caption })

        fs.unlinkSync(mediaPath)

        response(res, 200, true, 'Image sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send image.', err.message)
    }
}

export const sendVideo = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, mediaUrl, caption } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const mediaPath = resolve(__dirname, '../temp', 'video.mp4')
        await downloadFile(mediaUrl, mediaPath)

        const media = await session.loadMedia(mediaPath)
        await session.sendMessage(receiver, media, { caption })

        fs.unlinkSync(mediaPath)

        response(res, 200, true, 'Video sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send video.', err.message)
    }
}

export const sendAudio = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, mediaUrl } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const mediaPath = resolve(__dirname, '../temp', 'audio.mp3')
        await downloadFile(mediaUrl, mediaPath)

        const media = await session.loadMedia(mediaPath)
        await session.sendMessage(receiver, media, { sendAudioAsVoice: true })

        fs.unlinkSync(mediaPath)

        response(res, 200, true, 'Audio sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send audio.', err.message)
    }
}

export const sendTextWithButton = async (req, res) => {
    const { id: sessionId } = req.query
    const { receiver, message, buttons, footer } = req.body

    const session = getSession(sessionId)
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const buttonTemplate = {
            text: message,
            footer,
            buttons,
            headerType: 1
        }

        await session.sendMessage(receiver, buttonTemplate)

        response(res, 200, true, 'Button message sent.')
    } catch (err) {
        response(res, 500, false, 'Failed to send button message.', err.message)
    }
}
