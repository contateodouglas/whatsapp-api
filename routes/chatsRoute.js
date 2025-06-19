// src/routes/chatsRoute.js
import { Router } from 'express'
import { query, body } from 'express-validator'
import { messageSend } from '../controllers/chatsController.js'
import requestValidator from '../middlewares/requestValidator.js'
import sessionValidator from '../middlewares/sessionValidator.js'

const router = Router()

// 🚩 Rota principal de envio
router.post(
  '/send',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(),
  requestValidator,
  sessionValidator,
  messageSend
)

// 🚩 Aliases para compatibilidade (se realmente precisar)
router.post(
  '/user/sent-whatsapp-custom-text/plain-text',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(), // { text: "..." }
  requestValidator,
  sessionValidator,
  messageSend
)

router.post(
  '/user/sent-whatsapp-custom-text/text-with-button',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(), // Agora { templateButtons: [ ... ] }
  requestValidator,
  sessionValidator,
  messageSend
)

router.post(
  '/user/sent-whatsapp-custom-text/list-message',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(), // { listMessage: { ... } }
  requestValidator,
  sessionValidator,
  messageSend
)

export default router
