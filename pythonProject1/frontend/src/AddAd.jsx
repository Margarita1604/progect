import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from './api.js'

// Создание объявления: POST /api/ads
export default function AddAd() {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [form, setForm] = useState({ goal: '', text: '', category: 'Другое', days: 14 })
  const [error, setError] = useState('')

  // Список категорий берём с сервера, чтобы он был в одном месте (app.py)
  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {})
  }, [])

  const change = (e) => setForm({ ...form, [e.target.name]: e.target.value })

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    try {
      await api('/ads', { method: 'POST', body: form })
      navigate('/lk')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="card form-card">
      <h2>Новое объявление</h2>
      {error && <div className="flash error">{error}</div>}
      <form onSubmit={handleSubmit}>
        <div className="field">
          <label>Цель объявления</label>
          <input name="goal" value={form.goal} onChange={change} placeholder="Ищу напарника для олимпиады по информатике" required />
        </div>
        <div className="field">
          <label>Категория</label>
          <select name="category" value={form.category} onChange={change}>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>Описание</label>
          <textarea name="text" rows={5} value={form.text} onChange={change} required />
        </div>
        <div className="field">
          <label>Сколько дней объявление актуально</label>
          <select name="days" value={form.days} onChange={change}>
            {[3, 7, 14, 30, 60].map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <button className="btn btn-block" type="submit">Опубликовать</button>
      </form>
    </div>
  )
}
