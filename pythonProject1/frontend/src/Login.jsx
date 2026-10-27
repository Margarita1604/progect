import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

// Форма входа. Данные уходят на POST /api/login, при успехе — переход в личный кабинет.
export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()           // не даём браузеру перезагрузить страницу
    setError('')
    try {
      await login(email, password)
      navigate('/lk')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card form-card">
      <h2>Вход</h2>
      {error && <div className="flash error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button className="btn btn-block" type="submit">Войти</button>
      </form>
      <p className="muted center">Нет аккаунта? <Link to="/register">Зарегистрироваться</Link></p>
    </div>
  )
}
