// routes/groupsRoute.js
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import * as controller from '../controllers/groupsController.js';
import requestValidator from '../middlewares/requestValidator.js';
import sessionValidator from '../middlewares/sessionValidator.js';

const router = Router();

// ✅ Listar grupos
router.get(
  '/',
  query('id').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.getList
);

// ✅ Obter metadata de um grupo
router.get(
  '/meta/:jid',
  query('id').notEmpty(),
  param('jid').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.getGroupMetaData
);

// ✉️ Enviar texto simples para grupo
router.post(
  '/send-text',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.send
);

// 🖼️ Enviar imagem para grupo
router.post(
  '/send-image',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  body('caption').optional(),
  requestValidator,
  sessionValidator,
  controller.sendImage
);

// 🎥 Enviar vídeo para grupo
router.post(
  '/send-video',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  body('caption').optional(),
  requestValidator,
  sessionValidator,
  controller.sendVideo
);

// 🔊 Enviar áudio para grupo
router.post(
  '/send-audio',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  body('ptt').optional().isBoolean(),
  requestValidator,
  sessionValidator,
  controller.sendAudio
);

// 🔘 Enviar mensagem de texto com botões para grupo
router.post(
  '/send-text-button',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  body('buttons').isArray({ min: 1 }),
  body('footer').optional(),
  requestValidator,
  sessionValidator,
  controller.sendTextWithButton
);

// 📄 Enviar lista interativa para grupo
router.post(
  '/send-list',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('title').notEmpty(),
  body('text').notEmpty(),
  body('footer').optional(),
  body('buttonText').notEmpty(),
  body('sections').isArray({ min: 1 }),
  requestValidator,
  sessionValidator,
  controller.sendListMessage
);

// 🏷️ Alias para /groups/send?id=…
router.post(
  '/send',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.send
);

export default router;
