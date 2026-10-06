export type UserRole = 'customer' | 'agent'

export interface AuthSession {
  email: string
  name: string
  role: UserRole
  isAuthenticated: boolean
}

const STORAGE_KEY = 'prime-airline-auth'

export function saveAuthSession(session: AuthSession) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
}

export function getAuthSession(): AuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthSession
    if (!parsed || !parsed.isAuthenticated) return null
    return parsed
  } catch {
    return null
  }
}

export function clearAuthSession() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

export function getRoleRoute(role: UserRole) {
  return role === 'agent' ? '/agent' : '/chat'
}
