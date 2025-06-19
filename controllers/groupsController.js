import response from '../response.js'
import { getSession, isExists, formatGroup } from '../whatsapp.js'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'
import axios from 'axios'
import fs from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

// 🔥 Faz download de arquivo
async function downloadFile(fileUrl, outputLocationPath) {
    const writer = fs.createWriteStream(outputLocationPath)
    const res = await axios({ method: 'get', url: fileUrl, responseType: 'stream' })
    res.data.pipe(writer)
    return new Promise((resolvePromise, reject) => {
        writer.on('finish', resolvePromise)
        writer.on('error', reject)
    })
}

// 🔧 Cria pasta temp se não existir
function ensureTempFolder() {
    const tempDir = resolve(__dirname, '../temp')
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true })
    return tempDir
}

// 📑 Listar grupos
export const getList = (req, res) => {
    const groups = getSession(res.locals.sessionId)
        ? getSession(res.locals.sessionId).store.chats.filter(c => c.id.endsWith('@g.us'))
        : []
    return response(res, 200, true, '', groups)
}

// 📄 Obter metadata de um grupo
export const getGroupMetaData = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const { jid } = req.params
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const data = await session.groupMetadata(jid)
        if (!data.id) return response(res, 400, false, 'The group does not exist.')
        return response(res, 200, true, '', data)
    } catch (err) {
        return response(res, 500, false, 'Failed to get group metadata.', err.message)
    }
}

// ✉️ Enviar texto simples para grupo
export const send = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { message } = req.body
    if (!session) return response(res, 404, false, 'Session not found.')

    try {
        const exists = await isExists(session, receiver, true)
        if (!exists) return response(res, 400, false, 'The group does not exist.')
        await session.sendMessage(receiver, { text: message })
        return response(res, 200, true, 'Message sent.')
    } catch (err) {
        return response(res, 500, false, 'Failed to send message.', err.message)
    }
}

// 🖼️ Enviar imagem para grupo
export const sendImage = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { mediaUrl, caption } = req.body

    if (!session) return response(res, 404, false, 'Session not found.')
    try {
        const exists = await isExists(session, receiver, true)
        if (!exists) return response(res, 400, false, 'The group does not exist.')

        const tempDir = ensureTempFolder()
        const mediaPath = resolve(tempDir, 'group-image.jpg')
        await downloadFile(mediaUrl, mediaPath)
        const buffer = fs.readFileSync(mediaPath)
        await session.sendMessage(receiver, { image: buffer, caption })
        fs.unlinkSync(mediaPath)

        return response(res, 200, true, 'Image sent.')
    } catch (err) {
        return response(res, 500, false, 'Failed to send image.', err.message)
    }
}

// 🎥 Enviar vídeo para grupo
export const sendVideo = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { mediaUrl, caption } = req.body

    if (!session) return response(res, 404, false, 'Session not found.')
    try {
        const exists = await isExists(session, receiver, true)
        if (!exists) return response(res, 400, false, 'The group does not exist.')

        const tempDir = ensureTempFolder()
        const mediaPath = resolve(tempDir, 'group-video.mp4')
        await downloadFile(mediaUrl, mediaPath)
        const buffer = fs.readFileSync(mediaPath)
        await session.sendMessage(receiver, { video: buffer, caption })
        fs.unlinkSync(mediaPath)

        return response(res, 200, true, 'Video sent.')
    } catch (err) {
        return response(res, 500, false, 'Failed to send video.', err.message)
    }
}

// 🔊 Enviar áudio para grupo
export const sendAudio = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { mediaUrl, ptt = false } = req.body

    if (!session) return response(res, 404, false, 'Session not found.')
    try {
        const exists = await isExists(session, receiver, true)
        if (!exists) return response(res, 400, false, 'The group does not exist.')

        const tempDir = ensureTempFolder()
        const mediaPath = resolve(tempDir, 'group-audio.mp3')
        await downloadFile(mediaUrl, mediaPath)
        const buffer = fs.readFileSync(mediaPath)
        await session.sendMessage(receiver, { audio: buffer, ptt })
        fs.unlinkSync(mediaPath)

        return response(res, 200, true, 'Audio sent.')
    } catch (err) {
        return response(res, 500, false, 'Failed to send audio.', err.message)
    }
}

// 🔘 Enviar botão para grupo
export const sendTextWithButton = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { message, buttons, footer } = req.body

    if (!session) return response(res, 404, false, 'Session not found.')
    try {
        const exists = await isExists(session, receiver, true)
        if (!exists) return response(res, 400, false, 'The group does not exist.')

        const buttonTemplate = { text: message, footer, buttons, headerType: 1 }
        await session.sendMessage(receiver, { buttonsMessage: buttonTemplate })
        return response(res, 200, true, 'Button message sent.')
    } catch (err) {
        return response(res, 500, false, 'Failed to send button message.', err.message)
    }
}

// 📄 Enviar lista para grupo
export const sendListMessage = async (req, res) => {
    const session = getSession(res.locals.sessionId)
    const receiver = formatGroup(req.body.receiver)
    const { title, text, footer, buttonText, sections } = req.body

    if (!session) return response(res, 404, false, 'Session not found.')
    try {
        const exists = await isExists(session, receiver, true)
        if (!exists) return response(res, 400, false, 'The group does not exist.')

        const listMessage = { text, footer, title, buttonText, sections }
        await session.sendMessage(receiver, { listMessage })
        return response(res, 200, true, 'List message sent.')
    } catch (err) {
        return response(res, 500, false, 'Failed to send list message.', err.message)
    }
}
