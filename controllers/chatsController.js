// controllers/chatsController.js
import response from '../response.js'
import { getSession } from '../whatsapp.js'

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

  const to = receiver.includes('@')
    ? receiver
    : `${receiver.replace(/\D/g, '')}@s.whatsapp.net`

  try {
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, Number(delay)))
    }

    const mediaKeys = ['image', 'video', 'audio', 'document']
    const isMedia = mediaKeys.some(key => key in message)

    if (isMedia) {
      const mediaType = mediaKeys.find(key => key in message)
      const media = message[mediaType]

      if (!media || !media.url) {
        return response(res, 400, false, `Missing url for ${mediaType}.`)
      }

      if (mediaType === 'document') {
        if (!message.mimetype) {
          return response(res, 400, false, 'Mimetype is required for document.')
        }
        if (!message.fileName) {
          return response(res, 400, false, 'fileName is required for document.')
        }
      }

      if (mediaType === 'audio' && !message.mimetype) {
        message.mimetype = 'audio/mp4' // define padrão
      }
    }

    await session.sendMessage(to, message)

    return response(res, 200, true, 'Message sent successfully.')
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
