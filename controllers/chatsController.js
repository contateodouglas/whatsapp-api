// src/controllers/chatsController.js
import response from '../response.js'
import { getSession, formatPhone } from '../whatsapp.js'

/**
 * Único endpoint de envio. Recebe:
 *  - req.query.id        → sessionId (device_x)
 *  - req.body.receiver   → número ou JID
 *  - req.body.message    → objeto exatamente como o Laravel montou:
 *       • { text: "..."}                          (plain-text)
 *       • { image: { url: "…"}, caption: "…"}     (text-with-media)
 *       • { buttonsMessage: { text, footer, buttons, headerType } } (text-with-button)
 *       • { listMessage: { title, text, buttonText, sections, footer } } (text-with-list)
 */
export const messageSend = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, message } = req.body

  const session = getSession(sessionId)
  if (!session) {
    return response(res, 404, false, 'Session not found.')
	
 // --- DEBUG: veja exatamente o payload que vamos enviar ---
 console.log('→ payload to sendMessage:', {
to: formatPhone(receiver),
content: message
})
  }

  // formata o JID (+55xxx…@s.whatsapp.net)
  const to = formatPhone(receiver)

  // Reconstrói o payload que o Baileys espera:
  let payload = {}

  if (message.buttonsMessage) {
    // Desempacota botões para o root
    const { text, footer, buttons, headerType } = message.buttonsMessage
    payload = { text, footer, buttons, headerType }
  } else if (message.listMessage) {
    // Passa exatamente listMessage
    payload = { listMessage: message.listMessage }
  } else {
    // Para texto simples, mídia, etc. passa tudo como recebido
    payload = message
  }

  try {
    await session.sendMessage(to, payload)
    return response(res, 200, true, 'Message sent.')
  } catch (err) {
    console.error('🔥 /chats/send error:', err)
    return response(res, 400, false, 'Invalid media type or malformed payload', err.message)
  }
}
