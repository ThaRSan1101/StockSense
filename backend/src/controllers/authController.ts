import 'dotenv/config'
import { Request, Response } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js'
import { sendPasswordResetEmail } from '../utils/email.js'
import { AuthRequest } from '../middlewares/authMiddleware.js'
import { prisma } from '../config/prisma.js'

// ─── Zod Schemas ────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters')
})

const updateProfileSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().nullable().optional()
})

const REFRESH_TOKEN_COOKIE = 'stocksense_refresh'

// ─── POST /api/auth/login ───────────────────────────────────────────
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const parsed = loginSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' })
      return
    }

    const { email, password } = parsed.data

    const user = await prisma.user.findUnique({ where: { email } })

    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' })
      return
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash)
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid email or password.' })
      return
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }

    // Sign both tokens
    const accessToken = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    // Set Refresh Token in HttpOnly cookie
    // Secure flag should be true in production (HTTPS)
    res.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    })

    res.status(200).json({
      success: true,
      message: 'Login successful.',
      data: {
        token: accessToken, // Only send short-lived access token
        user: payload,
      },
    })
  } catch (err) {
    console.error('[login error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── POST /api/auth/refresh ─────────────────────────────────────────
export async function refreshToken(req: Request, res: Response): Promise<void> {
  try {
    const token = req.cookies[REFRESH_TOKEN_COOKIE]

    if (!token) {
      res.status(401).json({ success: false, message: 'No refresh token provided.' })
      return
    }

    const decoded = verifyRefreshToken(token)
    
    // Verify user still exists and is active
    const user = await prisma.user.findUnique({ where: { id: decoded.id } })
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, message: 'User deactivated or deleted.' })
      return
    }

    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    }

    const newAccessToken = signAccessToken(payload)

    res.status(200).json({
      success: true,
      data: { token: newAccessToken, user: payload }
    })
  } catch (err) {
    res.status(401).json({ success: false, message: 'Invalid or expired refresh token.' })
  }
}

// ─── POST /api/auth/logout ──────────────────────────────────────────
export async function logout(req: Request, res: Response): Promise<void> {
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
  })
  res.status(200).json({ success: true, message: 'Logged out successfully.' })
}

// ─── GET /api/auth/me ───────────────────────────────────────────────
export async function me(req: AuthRequest, res: Response): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    })

    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    res.status(200).json({ success: true, data: user })
  } catch (err) {
    console.error('[me error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── PUT /api/auth/profile ──────────────────────────────────────────
export async function updateProfile(req: AuthRequest, res: Response): Promise<void> {
  try {
    const parsed = updateProfileSchema.safeParse(req.body)
    if (!parsed.success) {
      res.status(400).json({ success: false, message: parsed.error.issues[0].message })
      return
    }

    const { name, email, phone } = parsed.data
    const userId = req.user!.id

    const existing = await prisma.user.findFirst({
      where: {
        email,
        id: { not: userId }
      }
    })

    if (existing) {
      res.status(409).json({ success: false, message: 'Email already in use.' })
      return
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name,
        email,
        phone
      },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true }
    })

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully.',
      data: updatedUser
    })
  } catch (err) {
    console.error('[updateProfile error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── POST /api/auth/users (Admin only — create cashier/manager) ──────
export async function createUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { name, email, password, role, phone } = req.body

    if (!name || !email || !password || !role) {
      res.status(400).json({ success: false, message: 'name, email, password, and role are required.' })
      return
    }

    if (!['CASHIER', 'INVENTORY_MANAGER'].includes(role)) {
      res.status(400).json({ success: false, message: 'Role must be CASHIER or INVENTORY_MANAGER.' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      res.status(409).json({ success: false, message: 'Email already in use.' })
      return
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: hashedPassword,
        role,
        phone,
      },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    })

    res.status(201).json({ success: true, message: 'User created successfully.', data: newUser })
  } catch (err) {
    console.error('[createUser error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── GET /api/auth/users (Admin only — list all staff) ──────────────
export async function listUsers(req: AuthRequest, res: Response): Promise<void> {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['CASHIER', 'INVENTORY_MANAGER'] } },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    res.status(200).json({ success: true, data: users })
  } catch (err) {
    console.error('[listUsers error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── GET /api/auth/operators (Any authenticated user — list admins + managers) ──
export async function listOperators(req: AuthRequest, res: Response): Promise<void> {
  try {
    const operators = await prisma.user.findMany({
      where: {
        role: { in: ['ADMIN', 'INVENTORY_MANAGER'] },
        isActive: true,
      },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: 'asc' },
    })

    res.status(200).json({ success: true, data: operators })
  } catch (err) {
    console.error('[listOperators error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}


// ─── PATCH /api/auth/users/:id/toggle (Admin only — activate/deactivate) ──
export async function toggleUserStatus(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })

    res.status(200).json({ success: true, data: updated })
  } catch (err) {
    console.error('[toggleUserStatus error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── PUT /api/auth/users/:id (Admin only — update user details) ─────────
export async function updateUser(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    const { name, email, phone, role, isActive } = req.body

    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    if (email && email !== user.email) {
      const existing = await prisma.user.findUnique({ where: { email } })
      if (existing) {
        res.status(409).json({ success: false, message: 'Email already in use.' })
        return
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name !== undefined ? name : user.name,
        email: email !== undefined ? email : user.email,
        phone: phone !== undefined ? phone : user.phone,
        role: role !== undefined ? role : user.role,
        isActive: isActive !== undefined ? isActive : user.isActive,
      },
      select: { id: true, name: true, email: true, role: true, phone: true, isActive: true, createdAt: true },
    })

    res.status(200).json({ success: true, message: 'User updated successfully.', data: updated })
  } catch (err) {
    console.error('[updateUser error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}

// ─── POST /api/auth/users/:id/reset-password (Admin only) ──────────────
export async function resetPassword(req: AuthRequest, res: Response): Promise<void> {
  try {
    const id = req.params.id as string
    
    const user = await prisma.user.findUnique({ where: { id } })
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found.' })
      return
    }

    // Generate a random 8-character password
    const newPassword = Math.random().toString(36).slice(-8)
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    await prisma.user.update({
      where: { id },
      data: { passwordHash: hashedPassword },
    })

    try {
      await sendPasswordResetEmail(user.email, newPassword, user.name)
    } catch (err) {
      console.error('[Email Send Error]', err)
      // We don't block the UI if email sending fails, we just notify
    }

    res.status(200).json({ 
      success: true, 
      message: 'Password reset successful and email sent.', 
      // We can also return newPassword here temporarily if the user hasn't configured SMTP yet
      data: { newPassword, emailSent: !!process.env.SMTP_USER } 
    })
  } catch (err) {
    console.error('[resetPassword error]', err)
    res.status(500).json({ success: false, message: 'Internal server error.' })
  }
}
