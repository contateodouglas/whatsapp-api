// routes/chatsRoute.js
import { Router } from 'express'
import { query, body } from 'express-validator'
import { messageSend } from '../controllers/chatsController.js'
import requestValidator from '../middlewares/requestValidator.js'
import sessionValidator from '../middlewares/sessionValidator.js'

const router = Router()

// Único endpoint para todas as mensagens (compatível com o Trait Laravel)
router.post(
  [
    '/send',
    '/user/sent-whatsapp-custom-text/plain-text',
    '/user/sent-whatsapp-custom-text/text-with-button',
    '/user/sent-whatsapp-custom-text/text-with-media',
    '/user/sent-whatsapp-custom-text/text-with-list'
  ],
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  messageSend
)

export default router
