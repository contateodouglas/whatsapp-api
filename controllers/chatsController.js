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
  console.log('→ [DEBUG] incoming message body:', JSON.stringify(message, null, 2))
  // ——————————————————

  // Monta o payload que o Baileys espera:
  let payload

  // 1) Quick‑reply buttons (usando templateButtons)
  if (Array.isArray(message.buttons) && message.buttons.length > 0) {
    payload = {
      text: message.text,
      footer: message.footer,
      templateButtons: message.buttons.map((b, idx) => ({
        index: idx,
        quickReplyButton: {
          displayText: b.buttonText?.displayText ?? '',
          id: b.buttonId ?? `btn_${idx}`
        }
      }))
    }

  // 2) List menus
  } else if (message.listMessage) {
    payload = { listMessage: message.listMessage }

  // 3) Qualquer outra (texto simples, mídia, document, etc)
  } else {
    payload = message
  }

  // ——— DEBUG PAYLOAD FINAL ———
  console.log('→ [DEBUG] payload to sendMessage:', JSON.stringify({ to, payload }, null, 2))
  // ————————————————————————

  try {
    await session.sendMessage(to, payload)
    return response(res, 200, true, 'Message sent.')
  } catch (err) {
    console.error('🔥 sendMessage error payload was:', err)
    return response(res, 400, false, 'Invalid media type or malformed payload', err.message)
  }
}
