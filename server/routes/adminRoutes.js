import express from 'express'
import {
  getDashboardStats,
  getAllOrders,
  getAllProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllUsers,
  uploadImage,
  bulkUpdateStock
} from '../controllers/adminController.js'
import { getSalesReport, exportOrdersCsv } from '../controllers/reportController.js'
import { updateOrderStatus, bulkUpdateOrderStatus, cancelOrderHandler, markRefundedHandler } from '../controllers/orderController.js'
import { getOverview } from '../controllers/adminOverviewController.js'
import { getCustomers, getCustomerDetail, postCustomerNote, removeCustomerNote } from '../controllers/customerController.js'
import { getBookingOptions, getBookings, postBooking, putBooking, removeBooking } from '../controllers/bookingController.js'
import { customerNoteSchema } from '../validators/customerValidators.js'
import { createBookingSchema, updateBookingSchema } from '../validators/bookingValidators.js'
import {
  listVouchers,
  createVoucher,
  updateVoucher,
  deleteVoucher
} from '../controllers/voucherController.js'
import { createVoucherSchema, updateVoucherSchema } from '../validators/voucherValidators.js'
import protect from '../middleware/authMiddleware.js'
import { portal, can } from '../middleware/portalMiddleware.js'
import { listStaff, addStaff, resendInvite, removeStaff } from '../controllers/staffController.js'
import { addStaffSchema } from '../validators/staffValidators.js'
import activityLog from '../middleware/activityLog.js'
import { getActivity } from '../controllers/activityController.js'
import validate from '../middleware/validate.js'
import {
  createProductSchema,
  updateProductSchema,
  uploadImageSchema,
  bulkStockSchema,
} from '../validators/adminValidators.js'
import { updateOrderStatusSchema, cancelOrderSchema, markRefundedSchema, bulkOrderStatusSchema } from '../validators/orderValidators.js'

const router = express.Router()

// The admin portal: the owner and staff (8-hour sessions). Each route names
// the permission it needs (config/permissions.js); the owner has them all.
router.use(protect, portal)
// Every successful change below is recorded in the activity log.
router.use(activityLog)

// Cancelling through the status route needs the cancel permission too.
const cancelNeedsPermission = (req, res, next) =>
  req.body?.status === 'cancelled' ? can('orders.cancel')(req, res, next) : next()

router.get('/activity', can('activity.view'), getActivity)

// Staff (owner only)
router.get('/staff', can('staff.manage'), listStaff)
router.post('/staff', can('staff.manage'), validate(addStaffSchema), addStaff)
router.post('/staff/:id/resend-invite', can('staff.manage'), resendInvite)
router.delete('/staff/:id', can('staff.manage'), removeStaff)

router.get('/stats', can('reports'), getDashboardStats)
router.get('/overview', can('reports'), getOverview)
router.get('/reports/sales', can('reports'), getSalesReport)
router.get('/orders', can('orders.view'), getAllOrders)
router.get('/orders/export', can('customers.export'), exportOrdersCsv)
// Must come before /orders/:id so "status" isn't read as an order id.
router.put('/orders/status', can('orders.fulfil'), validate(bulkOrderStatusSchema), bulkUpdateOrderStatus)
router.put('/orders/:id/cancel', can('orders.cancel'), validate(cancelOrderSchema), cancelOrderHandler)
router.put('/orders/:id/refund', can('orders.cancel'), validate(markRefundedSchema), markRefundedHandler)
router.put('/orders/:id', can('orders.fulfil'), cancelNeedsPermission, validate(updateOrderStatusSchema), updateOrderStatus)
router.get('/products', can('products.view'), getAllProducts)
router.post('/products', can('products.edit'), validate(createProductSchema), createProduct)
router.post('/upload', can('products.edit'), validate(uploadImageSchema), uploadImage)
// Must come before /products/:id so "stock" isn't read as a product id.
router.put('/products/stock', can('stock.count'), validate(bulkStockSchema), bulkUpdateStock)
router.put('/products/:id', can('products.edit'), validate(updateProductSchema), updateProduct)
router.delete('/products/:id', can('products.edit'), deleteProduct)
router.get('/users', can('customers.export'), getAllUsers)
// Customers (redesign stage 2)
router.get('/customers', can('customers.view'), getCustomers)
router.get('/customers/:id', can('customers.view'), getCustomerDetail)
router.post('/customers/:id/notes', can('customers.notes'), validate(customerNoteSchema), postCustomerNote)
router.delete('/customers/:id/notes/:noteId', can('customers.export'), removeCustomerNote)
// Bookings calendar (redesign stage 3). /options before /:id.
router.get('/bookings/options', can('bookings'), getBookingOptions)
router.get('/bookings', can('bookings'), getBookings)
router.post('/bookings', can('bookings'), validate(createBookingSchema), postBooking)
router.put('/bookings/:id', can('bookings'), validate(updateBookingSchema), putBooking)
router.delete('/bookings/:id', can('bookings'), removeBooking)
router.get('/vouchers', can('vouchers'), listVouchers)
router.post('/vouchers', can('vouchers'), validate(createVoucherSchema), createVoucher)
router.put('/vouchers/:id', can('vouchers'), validate(updateVoucherSchema), updateVoucher)
router.delete('/vouchers/:id', can('vouchers'), deleteVoucher)

export default router
