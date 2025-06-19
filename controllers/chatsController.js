// src/controllers/chatsController.js
import response from '../response.js'
import { getSession, formatPhone } from '../whatsapp.js'

export const messageSend = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, message } = req.body

  const session = getSession(sessionId)
  if (!session) {
    return response(res, 404, false, 'Session not found.')
  }

  const to = formatPhone(receiver)

  // ——— DEBUG PAYLOAD ———
  console.log('→ [DEBUG] payload to sendMessage:', JSON.stringify({
    to,
    message
  }, null, 2))
  // ——————————————————

  // Reconstrói o payload que o Baileys espera:
  let payload
  if (message.buttonsMessage) {
    const { text, footer, buttons, headerType } = message.buttonsMessage
    payload = { text, footer, buttons, headerType }
  } else if (message.listMessage) {
    payload = { listMessage: message.listMessage }
  } else {
    payload = message
  }

  try {
    await session.sendMessage(to, payload)
    return response(res, 200, true, 'Message sent.')
  } catch (err) {
    console.error('🔥 sendMessage error payload was:', { to, payload })
    return response(res, 400, false, 'Invalid media type or malformed payload', err.message)
  }
}
