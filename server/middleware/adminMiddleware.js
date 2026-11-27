import { ADMIN_SESSION_SECONDS } from '../utils/generateToken.js'

// Admins only, and only within 8 hours of signing in. The age check also
// catches a 7-day token issued before the account became an admin.
const admin = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(401).json({ message: 'Not authorized as admin' })
  }
  const signedInAt = req.authTime || 0
  if (Math.floor(Date.now() / 1000) - signedInAt > ADMIN_SESSION_SECONDS) {
    return res.status(401).json({
      message: 'Your admin session has ended (8 hours). Please sign in again.',
      code: 'admin-session-expired',
    })
  }
  next()
}

export default admin
