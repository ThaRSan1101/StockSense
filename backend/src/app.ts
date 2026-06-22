import 'dotenv/config'
import express, { Request, Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import rateLimit from 'express-rate-limit'
import authRoutes from './routes/authRoutes.js'
import categoryRoutes from './routes/categoryRoutes.js'
import brandRoutes from './routes/brandRoutes.js'
import supplierRoutes from './routes/supplierRoutes.js'
import productRoutes from './routes/productRoutes.js'
import inventoryRoutes from './routes/inventoryRoutes.js'
import dashboardRoutes from './routes/dashboardRoutes.js'
import discountRoutes from './routes/discountRoutes.js'
import salesRoutes from './routes/salesRoutes.js'
import refundRoutes from './routes/refundRoutes.js'
import reportRoutes from './routes/reportRoutes.js'
import settingsRoutes from './routes/settingsRoutes.js'
import notificationRoutes from './routes/notificationRoutes.js'
import aiRoutes from './routes/aiRoutes.js'

const app = express()

// ── CORS ─────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true, // IMPORTANT: Required for cookies
}))

// ── Security Middlewares ─────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: false })) // Set security HTTP headers
app.use(cookieParser()) // Parse HttpOnly cookies

// ── Body Parser ───────────────────────────────────────
app.use(express.json({ limit: '5mb' })) // Limit body size to prevent DOS attacks (increased for base64 image uploads)
app.use(express.urlencoded({ extended: true, limit: '5mb' }))

// Sanitize data (Prevent XSS attacks)
import { xss } from 'express-xss-sanitizer'
app.use(xss()) // Strip malicious HTML/JS tags from req.body, req.query, and req.params

// Rate limiting for auth routes (max 1000 requests per 15 mins for development)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: process.env.NODE_ENV === 'production' ? 100 : 1000,
  message: { success: false, message: 'Too many requests from this IP, please try again later.' }
})

// ── Health Check ──────────────────────────────────────
app.get('/', (_req: Request, res: Response) => {
  res.json({ success: true, message: 'StockSense API is running 🚀' })
})

// ── Routes ────────────────────────────────────────────
app.use('/api/auth', authLimiter, authRoutes)
app.use('/api/categories', categoryRoutes)
app.use('/api/brands', brandRoutes)
app.use('/api/suppliers', supplierRoutes)
app.use('/api/products', productRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/discounts', discountRoutes)
app.use('/api/sales', salesRoutes)
app.use('/api/refunds', refundRoutes)
app.use('/api/reports', reportRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/ai', aiRoutes)

// ── 404 Handler ───────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found.' })
})

export default app
