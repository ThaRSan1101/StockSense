import jwt from 'jsonwebtoken'

export function getJwtAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET
  if (!secret) {
    throw new Error('FATAL SECURITY ERROR: JWT_ACCESS_SECRET environment variable is missing or empty.')
  }
  return secret
}

export function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET
  if (!secret) {
    throw new Error('FATAL SECURITY ERROR: JWT_REFRESH_SECRET environment variable is missing or empty.')
  }
  return secret
}

const ACCESS_EXPIRES_IN = '15m' // 15 minutes
const REFRESH_EXPIRES_IN = '7d' // 7 days

export interface JwtPayload {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'CASHIER' | 'INVENTORY_MANAGER'
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtAccessSecret(), { expiresIn: ACCESS_EXPIRES_IN })
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, getJwtRefreshSecret(), { expiresIn: REFRESH_EXPIRES_IN })
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtAccessSecret()) as JwtPayload
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtRefreshSecret()) as JwtPayload
}
