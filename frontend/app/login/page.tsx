'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getRoleRoute, saveAuthSession, type UserRole } from '@/lib/auth'

const EMAIL_HINTS: Record<UserRole, { label: string; example: string; password: string }> = {
  customer: {
    label: 'Customer login',
    example: 'customer@primeair.com',
    password: 'customer123',
  },
  agent: {
    label: 'Agent login',
    example: 'agent@primeair.com',
    password: 'agent123',
  },
}

export default function LoginPage() {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>('customer')
  const [email, setEmail] = useState(EMAIL_HINTS.customer.example)
  const [password, setPassword] = useState(EMAIL_HINTS.customer.password)
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole)
    setEmail(EMAIL_HINTS[nextRole].example)
    setPassword(EMAIL_HINTS[nextRole].password)
    setError('')
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const normalizedEmail = email.trim().toLowerCase()
      const expected = EMAIL_HINTS[role]

      if (!normalizedEmail || !password.trim()) {
        setError('Please enter both email and password.')
        return
      }

      const isValid =
        normalizedEmail === expected.example.toLowerCase() && password === expected.password

      if (!isValid) {
        setError(`Use ${expected.example} and password ${expected.password} for the ${expected.label.toLowerCase()} demo.`)
        return
      }

      const session = {
        email: normalizedEmail,
        name: role === 'agent' ? 'Prime Agent' : 'Prime Customer',
        role,
        isAuthenticated: true,
      }

      saveAuthSession(session)
      router.push(getRoleRoute(role))
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        <div className="bg-blue-900 px-6 py-5 text-white">
          <p className="text-xs uppercase tracking-[0.2em] text-blue-200">Prime Airlines</p>
          <h1 className="mt-2 text-2xl font-bold">Sign in</h1>
        </div>

        <div className="p-6">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
            {(['customer', 'agent'] as UserRole[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => handleRoleChange(option)}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                  role === option
                    ? 'bg-white text-blue-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {option === 'customer' ? 'Customer' : 'Agent'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder={EMAIL_HINTS[role].example}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white"
                placeholder="Enter password"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}

            <div className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 border border-slate-200">
              Demo login: <strong>{EMAIL_HINTS[role].example}</strong> / <strong>{EMAIL_HINTS[role].password}</strong>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? 'Signing in...' : `Continue as ${role === 'customer' ? 'Customer' : 'Agent'}`}
            </button>
          </form>

          <div className="mt-4 text-center text-sm text-slate-500">
            Need a quick demo? <a href="/" className="font-medium text-blue-700 hover:text-blue-800">Go home</a>
          </div>
        </div>
      </div>
    </div>
  )
}
