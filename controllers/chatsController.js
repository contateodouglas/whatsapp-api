// controllers/chatsController.js
import response from '../response.js'
import { getSession } from '../whatsapp.js'

/**
 * Rota única que substitui todas as chamadas feitas pelo Trait Laravel:
 *
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

  try {
    const to = receiver.includes('@')
      ? receiver
      : `${receiver.replace(/\D/g, '')}@s.whatsapp.net`

    if (delay > 0) {
      await new Promise(r => setTimeout(r, Number(delay)))
    }

    await session.sendMessage(to, message)
    return response(res, 200, true, 'The message has been successfully sent.')
  } catch (err) {
    console.error('🔥 /chats/send error:', err)
    return response(res, 500, false, 'Failed to send the message.', err.message)
  }
}
