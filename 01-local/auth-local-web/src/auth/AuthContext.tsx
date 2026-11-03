
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { apiFetch, ApiError } from '../api/apiFetch'

interface TokenPair {
  accessToken: string
  refreshToken: string
}

interface AuthContextValue {
  token: string | null
  isAuthenticated: boolean
  login: (accessToken: string, refreshToken: string) => void
  logout: () => void
  authFetch: <T>(path: string, init?: RequestInit) => Promise<T>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)

  // Ambos tokens permanecen en memoria.
  const accessRef = useRef<string | null>(null)
  const refreshRef = useRef<string | null>(null)

  // Evita solicitar varias renovaciones simultáneas.
  const renewalRef = useRef<Promise<TokenPair> | null>(null)

  const login = useCallback((accessToken: string, refreshToken: string) => {
    accessRef.current = accessToken
    refreshRef.current = refreshToken
    setToken(accessToken)
  }, [])

  const clearSession = useCallback(() => {
    accessRef.current = null
    refreshRef.current = null
    setToken(null)
  }, [])

  const logout = useCallback(() => {
    const currentRefresh = refreshRef.current

    clearSession()

    if (currentRefresh) {
      void apiFetch<void>('/api/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken: currentRefresh }),
      }).catch((error) => {
        console.error('No se pudo revocar la sesión en el servidor:', error)
      })
    }
  }, [clearSession])

  const authFetch = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const originalAccess = accessRef.current

      if (!originalAccess) {
        throw new Error('No hay una sesión activa.')
      }

      try {
        return await apiFetch<T>(path, init, {
          token: originalAccess,
        })
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) {
          throw error
        }

        // No renovar si la sesión cambió mientras se esperaba.
        if (accessRef.current !== originalAccess) {
          throw error
        }

        const currentRefresh = refreshRef.current

        if (!currentRefresh) {
          clearSession()
          throw error
        }

        if (!renewalRef.current) {
          const renewal = apiFetch<TokenPair>('/api/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken: currentRefresh }),
          })

          renewalRef.current = renewal
          void renewal.finally(() => {
            if (renewalRef.current === renewal) {
              renewalRef.current = null
            }
          }).catch(() => {})
        }

        let newTokens: TokenPair

        try {
          newTokens = await renewalRef.current
        } catch (renewalError) {
          clearSession()
          throw renewalError
        }

        // Evitar restaurar una sesión cerrada durante la renovación.
        if (refreshRef.current !== currentRefresh) {
          throw new Error('La sesión cambió durante la renovación.')
        }

        login(newTokens.accessToken, newTokens.refreshToken)

        // Reintentar la solicitud original una sola vez.
        return apiFetch<T>(path, init, {
          token: newTokens.accessToken,
          onUnauthorized: clearSession,
        })
      }
    },
    [login, clearSession],
  )

  const value = useMemo(
    () => ({
      token,
      isAuthenticated: token !== null,
      login,
      logout,
      authFetch,
    }),
    [token, login, logout, authFetch],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  }

  return context
}
