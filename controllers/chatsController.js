// controllers/chatsController.js
import response from '../response.js'
import { getSession } from '../whatsapp.js'

/**
 * POST /chats/send?id=device_{id}
 * Body JSON:
 * {
 *   "receiver": "5511999999999",  // ou JID completo
 *   "delay": 1000,                // opcional em ms
 *   "message": { … payload … }    // já formatado pelo PHP trait
 * }
 */
export const messageSend = async (req, res) => {
  const { id: sessionId } = req.query
  const { receiver, delay = 0, message } = req.body

  const session = getSession(sessionId)
  if (!session) {
    return response(res, 404, false, 'Session not found.')
  }

  if (!receiver || !message) {
    return response(res, 400, false, 'Receiver and message are required.')
  }

  try {
    const to = receiver.includes('@')
      ? receiver
      : `${receiver.replace(/\D/g, '')}@s.whatsapp.net`

    if (delay > 0) {
      await new Promise(r => setTimeout(r, Number(delay)))
    }

    // 🔥 Validação específica para evitar erro "Invalid media type"
    if (
      typeof message !== 'object' ||
      Object.keys(message).length === 0
    ) {
      return response(res, 400, false, 'Invalid message payload.')
    }

    const mediaKeys = ['image', 'video', 'document', 'audio']

    const hasMedia = mediaKeys.some(key => key in message)

    if (hasMedia) {
      const mediaKey = mediaKeys.find(key => key in message)
      const mediaObj = message[mediaKey]

      if (!mediaObj || !mediaObj.url) {
        return response(res, 400, false, `Missing URL for ${mediaKey}.`)
      }

      if (mediaKey === 'document' && !message.mimetype) {
        return response(res, 400, false, 'Mimetype is required for document.')
      }

      if (mediaKey === 'audio' && !message.mimetype) {
        // Definir um mimetype padrão se não vier
        message.mimetype = 'audio/mp4'
      }
    }

    await session.sendMessage(to, message)

    return response(res, 200, true, 'The message has been successfully sent.')
  } catch (err) {
    console.error('🔥 /chats/send error:', err)
    return response(
      res,
      500,
      false,
      'Failed to send the message.',
      err?.output?.payload?.message || err.message
    )
  }
}
