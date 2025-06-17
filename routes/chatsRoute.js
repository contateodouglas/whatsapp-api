import { Router } from 'express'
import { body, query } from 'express-validator'
import * as controller from '../controllers/chatsController.js'  // Importação corrigida
import requestValidator from '../middlewares/requestValidator.js'
import sessionValidator from '../middlewares/sessionValidator.js'

const router = Router()

// Enviar mensagem de texto
router.post(
  '/send-message',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.sendMessage
)

// Enviar mensagem em massa
router.post(
  '/send-bulk-message',
  query('id').notEmpty(),
  body('receivers').isArray({ min: 1 }),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.sendBulkMessage
)

// Enviar imagem
router.post(
  '/send-image',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  body('caption').optional(),
  requestValidator,
  sessionValidator,
  controller.sendImage
)

// Enviar vídeo
router.post(
  '/send-video',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  body('caption').optional(),
  requestValidator,
  sessionValidator,
  controller.sendVideo
)

// Enviar áudio
router.post(
  '/send-audio',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.sendAudio
)

// Enviar texto com botões
router.post(
  '/send-text-button',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  body('buttons').isArray({ min: 1 }),
  requestValidator,
  sessionValidator,
  controller.sendTextWithButton
)

// Rotas alias para front-end existente
router.post(
  '/user/sent-whatsapp-custom-text/plain-text',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.sendMessage
)

router.post(
  '/user/sent-whatsapp-custom-text/text-with-button',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  body('buttons').isArray({ min: 1 }),
  requestValidator,
  sessionValidator,
  controller.sendTextWithButton
)

export default router
