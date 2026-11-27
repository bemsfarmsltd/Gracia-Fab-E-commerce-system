import User from '../models/User.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'
import logger from '../utils/logger.js'
import {
  storeProductImage,
  ImageStorageNotConfiguredError,
} from '../services/imageStorage.js'
import { sendServerError } from '../utils/httpErrors.js'
import { LOW_STOCK_THRESHOLD } from '../config/inventory.js'
import { ALLOWED_UPLOAD_MIME_TYPES } from '../validators/adminValidators.js'
import { naira, fieldChanges, describeProductChanges } from '../utils/activityText.js'

const MIME_TO_EXTENSION = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

// @desc   Get dashboard stats
// @route  GET /api/admin/stats
export const getDashboardStats = async (req, res) => {
  try {
    const totalProducts = await Product.countDocuments()
    const totalOrders = await Order.countDocuments()
    const totalUsers = await User.countDocuments()

    // Cancelled paid orders are refunded, so they aren't revenue.
    const revenueData = await Order.aggregate([
      { $match: { isPaid: true, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, total: { $sum: '$totalPrice' } } }
    ])

    const totalRevenue = revenueData[0]?.total || 0

    const recentOrders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)

    // Low stock: 1..LOW_STOCK_THRESHOLD units. Out of stock: 0 or no count.
    const [lowStock, outOfStockCount] = await Promise.all([
      Product.find({ stock: { $gt: 0, $lte: LOW_STOCK_THRESHOLD } })
        .select('name stock category')
        .sort({ stock: 1, name: 1 })
        .lean(),
      Product.countDocuments({ $or: [{ stock: { $lte: 0 } }, { stock: null }] }),
    ])

    res.json({
      totalProducts,
      totalOrders,
      totalUsers,
      totalRevenue,
      recentOrders,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      lowStock,
      outOfStockCount,
    })
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Get all orders
// @route  GET /api/admin/orders
export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user', 'name email')
      .sort({ createdAt: -1 })
    res.json(orders)
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Get all products (admin)
// @route  GET /api/admin/products
export const getAllProducts = async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 })
    res.json(products)
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Create product
// @route  POST /api/admin/products
export const createProduct = async (req, res) => {
  try {
    const {
      name, description, price, image, secondaryImage,
      category, brand, stock,
      tags, isFeatured
    } = req.body

    const product = await Product.create({
      name,
      description,
      price,
      image,
      secondaryImage,
      category,
      brand,
      stock,
      tags: tags ? tags.split(',').map(t => t.trim()) : [],
      isFeatured: isFeatured || false,
      suitableFor: {}
    })

    res.locals.activity = {
      targetId: String(product._id),
      summary: `Added "${product.name}" at ${naira(product.price)}, stock ${product.stock}`,
      changes: { name: product.name, price: product.price, stock: product.stock, category: product.category },
    }
    res.status(201).json(product)
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Update product
// @route  PUT /api/admin/products/:id
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    const before = product.toObject()

    const {
      name, description, price, image, secondaryImage,
      category, brand, stock,
      tags, isFeatured
    } = req.body

    product.name = name || product.name
    product.description = description || product.description
    product.price = price ?? product.price
product.image = image ?? product.image
    product.secondaryImage = secondaryImage ?? product.secondaryImage
    product.category = category || product.category
    product.brand = brand || product.brand
    product.stock = stock ?? product.stock
    product.tags = tags
      ? tags.split(',').map(t => t.trim())
      : product.tags
    product.isFeatured = isFeatured ?? product.isFeatured

    // Before/after for the activity log, read before saving.
    const changes = fieldChanges(before, product, ['name', 'price', 'stock', 'category', 'brand', 'isFeatured', 'image', 'secondaryImage', 'description'])

    const updatedProduct = await product.save()
    res.locals.activity = { changes, summary: describeProductChanges(updatedProduct.name, changes) }
    res.json(updatedProduct)
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Set stock counts for many products at once (Inventory tab: inline
//         edits and CSV uploads)
// @route  PUT /api/admin/products/stock
export const bulkUpdateStock = async (req, res) => {
  try {
    const { updates } = req.body

    // Counts before the change, for the activity log.
    const before = await Product.find({ _id: { $in: updates.map((u) => u.id) } }).select('name stock').lean()
    const beforeById = new Map(before.map((p) => [String(p._id), p]))

    // bulkWrite skips the save hook, so set isInStock alongside stock here.
    const result = await Product.bulkWrite(
      updates.map(({ id, stock }) => ({
        updateOne: {
          filter: { _id: id },
          update: { $set: { stock, isInStock: stock > 0 } },
        },
      })),
    )

    // Report ids that didn't match a product (e.g. a stale CSV row).
    const ids = updates.map((u) => u.id)
    const found = await Product.find({ _id: { $in: ids } }).distinct('_id')
    const foundSet = new Set(found.map(String))
    const notFound = ids.filter((id) => !foundSet.has(id))

    const changed = updates
      .filter(({ id, stock }) => beforeById.has(id) && beforeById.get(id).stock !== stock)
      .map(({ id, stock }) => ({ product: id, name: beforeById.get(id).name, from: beforeById.get(id).stock ?? 0, to: stock }))
    res.locals.activity = {
      targetId: changed.length === 1 ? changed[0].product : undefined,
      summary: changed.length === 1
        ? `Stock of "${changed[0].name}" ${changed[0].from} → ${changed[0].to}`
        : `Stock counts changed for ${changed.length} product(s)`,
      changes: { stock: changed },
    }
    res.json({ updated: result.matchedCount, notFound })
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Delete product
// @route  DELETE /api/admin/products/:id
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found' })
    }
    await product.deleteOne()
    res.locals.activity = {
      summary: `Deleted "${product.name}" (${naira(product.price)}, stock ${product.stock ?? 0})`,
      changes: { name: product.name, price: product.price, stock: product.stock },
    }
    res.json({ message: 'Product deleted successfully' })
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Get all users
// @route  GET /api/admin/users
export const getAllUsers = async (req, res) => {
  try {
    // Never send password or login-code hashes to the browser.
    const users = await User.find().select('-password -otpCodeHash -otpExpiresAt -otpAttempts')
      .sort({ createdAt: -1 })
    res.json(users)
  } catch (error) {
    return sendServerError(res, error, "adminController error");
  }
}

// @desc   Upload product image
// @route  POST /api/admin/upload
export const uploadImage = async (req, res) => {
  try {
    const { imageBase64, mimeType } = req.body

    // mimeType is already restricted to ALLOWED_UPLOAD_MIME_TYPES by
    // uploadImageSchema, so this lookup can't produce an attacker-chosen
    // extension (e.g. .svg, which could embed a script and serve as
    // stored XSS when the uploaded file's URL is opened directly).
    const extension = MIME_TO_EXTENSION[mimeType]
    if (!extension) {
      return res.status(400).json({ message: 'Unsupported image type' })
    }

    // Cloudinary in production (Render's disk is wiped on every deploy);
    // local disk only in development. See services/imageStorage.js.
    const { url, storage } = await storeProductImage({
      imageBase64,
      mimeType,
      extension,
      req,
    })

    logger.info({ url, storage }, 'Image uploaded')

    res.status(201).json({ success: true, url })
  } catch (error) {
    if (error instanceof ImageStorageNotConfiguredError) {
      logger.error('Image upload refused: Cloudinary is not configured')
      return res.status(503).json({ message: error.message })
    }
    logger.error({ err: error }, 'uploadImage error')
    res.status(500).json({ message: 'Image upload failed. Please try again.' })
  }
}