import express from 'express'
import {
  submitContact,
  getContacts,
  updateContactStatus,
  deleteContact,
  subscribe,
  getSubscribers,
  deleteSubscriber
} from '../controllers/contactController.js'
import protect from '../middleware/authMiddleware.js'
import { portal, can } from '../middleware/portalMiddleware.js'
import activityLog from '../middleware/activityLog.js'
import validate from '../middleware/validate.js'
import {
  submitContactSchema,
  subscribeSchema,
  updateContactStatusSchema,
} from '../validators/contactValidators.js'

const router = express.Router()

// Public
router.post('/', validate(submitContactSchema), submitContact)
router.post('/subscribe', validate(subscribeSchema), subscribe)

// Admin only
router.get('/', protect, portal, can('messages'), getContacts)
router.put('/:id', protect, portal, can('messages'), activityLog, validate(updateContactStatusSchema), updateContactStatus)
router.delete('/:id', protect, portal, can('messages.delete'), activityLog, deleteContact)
router.get('/subscribers', protect, portal, can('subscribers'), getSubscribers)
router.delete('/subscribers/:id', protect, portal, can('subscribers'), activityLog, deleteSubscriber)

export default router
