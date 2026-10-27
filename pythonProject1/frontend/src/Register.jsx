import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

// Регистрация: POST /api/register. После успеха пользователь уже вошёл.
export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', group: '', email: '', password: '' })
  const [error, setError] = useState('')

  // Один обработчик на все поля: по имени поля обновляем нужный ключ
  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await register(form)
      navigate('/lk')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card form-card">
      <h2>Регистрация</h2>
      {error && <div className="flash error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Имя</label>
          <input name="name" value={form.name} onChange={change} required />
        </div>
        <div className="field">
          <label>Класс / группа</label>
          <input name="group" value={form.group} onChange={change} placeholder="например, 10Б" />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="email" type="email" value={form.email} onChange={change} required />
        </div>
        <div className="field">
          <label>Пароль</label>
          <input name="password" type="password" minLength={6} value={form.password}
                 onChange={change} placeholder="Минимум 6 символов" required />
        </div>
        <button className="btn btn-block" type="submit">Создать аккаунт</button>
      </form>
      <p className="muted center">Уже есть аккаунт? <Link to="/login">Войти</Link></p>
    </div>
  )
}
