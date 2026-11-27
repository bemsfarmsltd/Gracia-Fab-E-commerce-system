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
import admin from '../middleware/adminMiddleware.js'
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

// All routes protected by both auth and admin middleware
router.use(protect, admin)
// Every successful change below is recorded in the activity log.
router.use(activityLog)

router.get('/activity', getActivity)

router.get('/stats', getDashboardStats)
router.get('/overview', getOverview)
router.get('/orders', getAllOrders)
router.get('/orders/export', exportOrdersCsv)
router.get('/reports/sales', getSalesReport)
// Must come before /orders/:id so "status" isn't read as an order id.
router.put('/orders/status', validate(bulkOrderStatusSchema), bulkUpdateOrderStatus)
router.put('/orders/:id/cancel', validate(cancelOrderSchema), cancelOrderHandler)
router.put('/orders/:id/refund', validate(markRefundedSchema), markRefundedHandler)
router.put('/orders/:id', validate(updateOrderStatusSchema), updateOrderStatus)
router.get('/products', getAllProducts)
router.post('/products', validate(createProductSchema), createProduct)
router.post('/upload', validate(uploadImageSchema), uploadImage)
// Must come before /products/:id so "stock" isn't read as a product id.
router.put('/products/stock', validate(bulkStockSchema), bulkUpdateStock)
router.put('/products/:id', validate(updateProductSchema), updateProduct)
router.delete('/products/:id', deleteProduct)
router.get('/users', getAllUsers)
// Customers (redesign stage 2)
router.get('/customers', getCustomers)
router.get('/customers/:id', getCustomerDetail)
router.post('/customers/:id/notes', validate(customerNoteSchema), postCustomerNote)
router.delete('/customers/:id/notes/:noteId', removeCustomerNote)
// Bookings calendar (redesign stage 3). /options before /:id.
router.get('/bookings/options', getBookingOptions)
router.get('/bookings', getBookings)
router.post('/bookings', validate(createBookingSchema), postBooking)
router.put('/bookings/:id', validate(updateBookingSchema), putBooking)
router.delete('/bookings/:id', removeBooking)
router.get('/vouchers', listVouchers)
router.post('/vouchers', validate(createVoucherSchema), createVoucher)
router.put('/vouchers/:id', validate(updateVoucherSchema), updateVoucher)
router.delete('/vouchers/:id', deleteVoucher)

export default router
