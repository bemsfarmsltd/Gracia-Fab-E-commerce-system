import express from 'express'
import {
  registerUser, loginUser, verifyOtp, resendOtp, getUserProfile, updateUserProfile, refreshSession
} from '../controllers/authController.js'
import { googleLogin, facebookLogin } from '../controllers/oauthController.js'
import { setPasswordFromInvite } from '../controllers/staffController.js'
import { setPasswordSchema } from '../validators/staffValidators.js'
import protect from '../middleware/authMiddleware.js'
import validate from '../middleware/validate.js'
import {
  registerSchema,
  loginSchema,
  verifyOtpSchema,
  resendOtpSchema,
  updateProfileSchema,
  googleLoginSchema,
  facebookLoginSchema,
} from '../validators/authValidators.js'

const router = express.Router()

router.post('/register', validate(registerSchema), registerUser)
router.post('/login', validate(loginSchema), loginUser)
router.post('/verify-otp', validate(verifyOtpSchema), verifyOtp)
router.post('/resend-otp', validate(resendOtpSchema), resendOtp)
router.get('/profile', protect, getUserProfile)
router.post('/refresh', protect, refreshSession)
router.put('/profile', protect, validate(updateProfileSchema), updateUserProfile)
router.post('/google', validate(googleLoginSchema), googleLogin)
router.post('/facebook', validate(facebookLoginSchema), facebookLogin)
// A new staff member chooses a password from their invite link.
router.post('/set-password', validate(setPasswordSchema), setPasswordFromInvite)

export default router
