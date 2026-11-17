import express from 'express'
import { getPublicVouchers, validateVoucher } from '../controllers/voucherController.js'
import protect from '../middleware/authMiddleware.js'
import validate from '../middleware/validate.js'
import { validateVoucherSchema } from '../validators/voucherValidators.js'

const router = express.Router()

router.get('/public', getPublicVouchers)
router.post('/validate', protect, validate(validateVoucherSchema), validateVoucher)

export default router
