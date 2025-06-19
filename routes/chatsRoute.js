// src/routes/chatsRoute.js
import { Router } from 'express'
import { query, body } from 'express-validator'
import { messageSend } from '../controllers/chatsController.js'
import requestValidator from '../middlewares/requestValidator.js'
import sessionValidator from '../middlewares/sessionValidator.js'

const router = Router()

// rota “oficial”
router.post(
  '/send',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(),
  requestValidator,
  sessionValidator,
  messageSend
)

// aliases para manter compatibilidade com o PHP (não altera nada no Laravel)
router.post(
  '/user/sent-whatsapp-custom-text/plain-text',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(),        // aqui message = { text: "..." }
  requestValidator,
  sessionValidator,
  messageSend
)

router.post(
  '/user/sent-whatsapp-custom-text/text-with-button',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').isObject(),        // aqui message = { buttonsMessage: { … } }
  requestValidator,
  sessionValidator,
  messageSend
)

export default router
