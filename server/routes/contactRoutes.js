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
import admin from '../middleware/adminMiddleware.js'
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
router.get('/', protect, admin, getContacts)
router.put('/:id', protect, admin, activityLog, validate(updateContactStatusSchema), updateContactStatus)
router.delete('/:id', protect, admin, activityLog, deleteContact)
router.get('/subscribers', protect, admin, getSubscribers)
router.delete('/subscribers/:id', protect, admin, activityLog, deleteSubscriber)

export default router
