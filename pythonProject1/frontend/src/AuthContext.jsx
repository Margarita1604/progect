import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'

// Контекст — «общая переменная» для всего приложения.
// Любой компонент может вызвать useAuth() и узнать, кто сейчас вошёл.
const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)       // null = не вошёл
  const [loading, setLoading] = useState(true) // пока спрашиваем сервер, кто мы

  // При загрузке страницы спрашиваем у сервера, есть ли активная сессия
  useEffect(() => {
    api('/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email, password) {
    const data = await api('/login', { method: 'POST', body: { email, password } })
    setUser(data.user)
  }

  async function register(form) {
    const data = await api('/register', { method: 'POST', body: form })
    setUser(data.user)
  }

  async function logout() {
    await api('/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, setUser, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
