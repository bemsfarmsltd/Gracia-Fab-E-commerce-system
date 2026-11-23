import mongoose from 'mongoose'
import logger from '../utils/logger.js'

const connectDB = async () => {
  if (!process.env.MONGO_URI) {
    logger.warn('MONGO_URI is not set — server starting without database connection')
    return false
  }
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI)
    logger.info({ host: conn.connection.host }, 'MongoDB connected')
    return true
  } catch (error) {
    logger.error({ err: error }, 'MongoDB connection error')
    // Flush before exiting so the log line isn't lost — pino's dev
    // transport runs in a worker thread and is not written synchronously.
    logger.flush(() => process.exit(1))
    return false
  }
}

export default connectDB
