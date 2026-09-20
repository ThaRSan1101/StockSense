import { Request, Response, NextFunction } from 'express'
import { verifyAccessToken, JwtPayload } from '../utils/jwt.js'

export interface AuthRequest extends Request {
  user?: JwtPayload
}

// Verify JWT token from Authorization header
export function authenticate(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access denied. No token provided.' })
    return
  }

  const token = authHeader.split(' ')[1]

  try {
    const decoded = verifyAccessToken(token)
    req.user = decoded
    next()
  } catch {
    res.status(401).json({ success: false, message: 'Invalid or expired token.' })
  }
}

// Optional authentication middleware: attaches req.user if valid token provided
export function optionalAuthenticate(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1]
    try {
      const decoded = verifyAccessToken(token)
      req.user = decoded
    } catch {
      // Invalid/expired token: leave req.user undefined
    }
  }

  next()
}

// Role-based access control middleware
export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Not authenticated.' })
      return
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      })
      return
    }

    next()
  }
}
