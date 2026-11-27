import { ADMIN_SESSION_SECONDS } from '../utils/generateToken.js'
import { canUsePortal, hasPermission } from '../utils/roles.js'

// The admin portal: the owner and staff, within 8 hours of signing in. The
// role is read from the database on every request (protect loads the user),
// so removing someone's staff access takes effect on their next click.
export const portal = (req, res, next) => {
  if (!canUsePortal(req.user)) {
    return res.status(401).json({ message: 'Not authorized for the admin portal' })
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

// can('orders.fulfil'): 403 for portal users whose role doesn't allow it.
export const can = (permission) => (req, res, next) => {
  if (hasPermission(req.user, permission)) return next()
  return res.status(403).json({ message: "Your account isn't allowed to do this. Ask the owner if you need it.", code: 'forbidden' })
}
