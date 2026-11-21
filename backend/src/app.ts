import 'dotenv/config'
import express, { Request, Response, NextFunction } from 'express'
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
import aiDemandRoutes from './routes/aiDemandRoutes.js'
import comboRoutes from './routes/comboRoutes.js'
import uploadRoutes from './routes/uploadRoutes.js'

const app = express()

// ── Reverse Proxy Trust ──────────────────────────────
// Render terminates TLS at a single reverse proxy hop.
// Trusting 1 hop allows Express to resolve req.ip accurately from X-Forwarded-For
// and enables secure cookies over HTTPS without trusting arbitrary spoofed headers.
app.set('trust proxy', 1)

// ── CORS ─────────────────────────────────────────────
const rawFrontendUrl = process.env.FRONTEND_URL
if (process.env.NODE_ENV === 'production' && !rawFrontendUrl) {
  console.error('⚠️ [SECURITY WARNING] FRONTEND_URL is not defined in production. Cross-origin requests will be rejected.')
}

// Normalize origin by stripping any accidental trailing slash
const allowedOrigin = (rawFrontendUrl || 'http://localhost:5173').trim().replace(/\/+$/, '')

app.use(cors({
  origin: allowedOrigin,
  credentials: true, // IMPORTANT: Required for HttpOnly cookies
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

// Decode unintentionally escaped HTML entities (such as &amp;) created by xss sanitizer
app.use((req: Request, _res: Response, next: NextFunction) => {
  const decodeEntities = (obj: any): any => {
    if (typeof obj === 'string') {
      let str = obj;
      while (str.includes('&amp;')) {
        str = str.replace(/&amp;/g, '&');
      }
      return str;
    }
    if (Array.isArray(obj)) {
      return obj.map(decodeEntities);
    }
    if (obj !== null && typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        obj[key] = decodeEntities(obj[key]);
      }
    }
    return obj;
  };

  if (req.body) req.body = decodeEntities(req.body);
  if (req.params) req.params = decodeEntities(req.params);
  next();
})

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
app.use('/api/ai-demand', aiDemandRoutes)
app.use('/api', comboRoutes)
app.use('/api/upload', uploadRoutes)

// ── 404 Handler ───────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: 'Route not found.' })
})

// ── Centralized Error Handler ─────────────────────────
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Unhandled Error]', err)
  const status = typeof err.status === 'number' ? err.status : (typeof err.statusCode === 'number' ? err.statusCode : 500)
  const isProd = process.env.NODE_ENV === 'production'

  // Do not expose stack traces, SQL errors, or internal diagnostics to public clients in production
  const message = isProd && status === 500
    ? 'Internal server error.'
    : (err.message || 'An unexpected error occurred.')

  res.status(status).json({
    success: false,
    message,
  })
})

export default app
