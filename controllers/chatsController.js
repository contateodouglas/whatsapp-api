// src/controllers/chatsController.js
import response from '../response.js'
import { getSession, formatPhone } from '../whatsapp.js'

/**
 * Único endpoint de envio. Recebe:
 *  - req.query.id        → sessionId (device_x)
 *  - req.body.receiver   → número ou JID
 *  - req.body.message    → objeto completo montado pelo PHP:
 *      { text: "..."} ou
 *      { buttonMessage: { text, footer, buttons, headerType }} ou
 *      { listMessage: { title, text, buttonText, sections, footer }}
 */
export const messageSend = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, message } = req.body

  const session = getSession(sessionId)
  if (!session) {
    return response(res, 404, false, 'Session not found.')
  }

  try {
    // formata o JID corretamente
    const to = formatPhone(receiver)

    // dispara exatamente o objeto recebido em req.body.message
    await session.sendMessage(to, message)

    return response(res, 200, true, 'Message sent.')
  } catch (err) {
    console.error('🔥 /chats/send error:', err)
    return response(res, 400, false, 'Invalid media type or malformed payload', err.message)
  }
}
