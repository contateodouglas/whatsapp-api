// routes/chatsRoute.js
import { Router } from 'express'
import { query, body } from 'express-validator'
import { messageSend } from '../controllers/chatsController.js'
import requestValidator from '../middlewares/requestValidator.js'
import sessionValidator from '../middlewares/sessionValidator.js'

const router = Router()

router.post(
  '/send',
  query('id').notEmpty(),
  body('receiver').notEmpty(),
  body('message').notEmpty(),
  requestValidator,
  sessionValidator,
  messageSend
)

export default router
