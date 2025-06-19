// routes/groupsRoute.js
import { Router } from 'express';
import { body, query, param } from 'express-validator';
import * as controller from '../controllers/groupsController.js';
import requestValidator from '../middlewares/requestValidator.js';
import sessionValidator from '../middlewares/sessionValidator.js';

const router = Router();

// ✅ Listar grupos (PHP chama `/groups?id=`? se for GET /groups?id=… você já tem em routes.js)
router.get(
  '/', 
  query('id').notEmpty(),
  requestValidator, 
  sessionValidator, 
  controller.getList
);

// ✅ Obter metadata do grupo
router.get(
  '/meta/:jid',
  query('id').notEmpty(),
  param('jid').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.getGroupMetaData
);

// ✅ Enviar texto simples para grupo
router.post(
  '/send-text',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.send
);

// ✅ Enviar texto com botões
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

// ✅ Enviar template buttons
router.post(
  '/send-text-template',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  body('buttons').isArray({ min: 1 }),
  body('footer').optional(),
  requestValidator,
  sessionValidator,
  controller.sendTemplateMessage
);

// ✅ Enviar lista interativa
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

// ✅ Enviar imagem
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

// ✅ Enviar vídeo
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

// ✅ Enviar áudio
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

// ✅ Enviar documento
router.post(
  '/send-document',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('mediaUrl').notEmpty(),
  body('fileName').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.sendDocument
);

// ✅ Enviar localização
router.post(
  '/send-location',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('lat').isFloat(),
  body('lng').isFloat(),
  body('name').optional(),
  requestValidator,
  sessionValidator,
  controller.sendLocation
);

// ✅ Enviar contato (vCard)
router.post(
  '/send-contact',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('contactNumber').notEmpty(),
  body('name').notEmpty(),
  requestValidator,
  sessionValidator,
  controller.sendContact
);

// 🏷️ Alias exato para `/groups/send?id=…` — sem mexer no PHP
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
