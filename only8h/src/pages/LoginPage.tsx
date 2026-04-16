import { useState } from 'react'
import type { FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { Scale, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      // Map common Supabase error messages to Spanish
      if (authError.message === 'Invalid login credentials') {
        setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      } else if (authError.message.includes('Email not confirmed')) {
        setError('Debes confirmar tu dirección de email antes de iniciar sesión.')
      } else {
        setError('Error al iniciar sesión. Inténtalo de nuevo.')
      }
      setLoading(false)
    }
    // On success, App.tsx will detect the session change and re-render
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo & Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-[#2B58C4] rounded-xl mb-4">
            <Scale className="w-7 h-7 text-white" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-[#2B58C4] tracking-tight">
            ONLY8H
          </h1>
          <p className="text-sm text-gray-500 mt-1 font-medium">
            Analizador de Documentación Legal con IA
          </p>
          <p className="text-xs text-gray-400 mt-0.5">RUA Abogados</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">
            Iniciar sesión
          </h2>

          <form onSubmit={handleSubmit} noValidate>
            {/* Error message */}
            {error && (
              <div
                role="alert"
                className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700"
              >
                {error}
              </div>
            )}

            {/* Email */}
            <div className="mb-4">
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:border-transparent transition-colors"
              />
            </div>

            {/* Password */}
            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:border-transparent transition-colors"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#2B58C4] hover:bg-[#2348A8] disabled:bg-[#2B58C4]/50 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#2B58C4] focus:ring-offset-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  Entrando...
                </>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Acceso exclusivo para el equipo de RUA Abogados
        </p>
      </div>
    </div>
  )
}
