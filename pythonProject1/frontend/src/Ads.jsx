import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './App.css'
import { api, formatDate } from './api.js'
import { useAuth } from './AuthContext.jsx'

// Одна карточка объявления + кнопка «Откликнуться»
function AdCard({ ad }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)       // показана ли форма отклика
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const isMine = user && user.id === ad.author_user.id

  // Отклик создаёт чат (POST /api/ads/<id>/respond) и открывает его
  async function respond() {
    setError('')
    try {
      const data = await api(`/ads/${ad.id}/respond`, { method: 'POST', body: { message } })
      navigate(`/chats/${data.chat_id}`)
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <article className="ad-card">
      <div className="ad-header">
        <div>
          <div className="ad-author">
            Автор: {ad.author_user.name}{ad.author_user.group ? ` (${ad.author_user.group})` : ''}
          </div>
          <div className="ad-author">Опубликовано: {formatDate(ad.creation_date)}</div>
          <h2 className="ad-goal">{ad.goal}</h2>
        </div>
        <div className="ad-badge">{ad.category}</div>
      </div>
      <p className="ad-text">{ad.text}</p>

      {!isMine && (
        <div className="ad-actions">
          {!user ? (
            <button className="btn btn-sm" onClick={() => navigate('/login')}>Войдите, чтобы откликнуться</button>
          ) : open ? (
            <div className="respond-box">
              <textarea rows={2} placeholder="Первое сообщение (необязательно)"
                        value={message} onChange={(e) => setMessage(e.target.value)} />
              <div className="row">
                <button className="btn btn-sm" onClick={respond}>Отправить отклик</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setOpen(false)}>Отмена</button>
              </div>
              {error && <div className="flash error">{error}</div>}
            </div>
          ) : (
            <button className="btn btn-sm" onClick={() => setOpen(true)}>Откликнуться</button>
          )}
        </div>
      )}
    </article>
  )
}

// Лента объявлений с поиском и фильтрами (GET /api/ads?category=...&date_from=...)
function Ads() {
  const [ads, setAds] = useState([])
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const emptyFilters = { q: '', category: '', date_from: '', date_to: '', sort: 'new' }
  const [filters, setFilters] = useState(emptyFilters)   // то, что вводит пользователь
  const [applied, setApplied] = useState(emptyFilters)   // то, что реально применено

  useEffect(() => {
    api('/categories').then(setCategories).catch(() => {})
  }, [])

  // Загружаем ленту при открытии страницы и каждый раз, когда нажали «Найти»
  useEffect(() => {
    // пустые фильтры в запрос не добавляем
    const params = new URLSearchParams(Object.entries(applied).filter(([, v]) => v))
    api('/ads?' + params.toString())
      .then((data) => { setAds(data); setError('') })
      .catch((err) => setError(err.message))
  }, [applied])

  const change = (e) => setFilters({ ...filters, [e.target.name]: e.target.value })

  function submit(e) {
    e.preventDefault()
    setApplied(filters)
  }

  function reset() {
    setFilters(emptyFilters)
    setApplied(emptyFilters)
  }

  return (
    <div className="page">
      <h1 className="page-title">Лента объявлений</h1>
      <p className="page-subtitle">Актуальные объявления о поиске учебных партнёров</p>

      <form className="filters" onSubmit={submit}>
        <input name="q" placeholder="Поиск по тексту" value={filters.q} onChange={change} />
        <select name="category" value={filters.category} onChange={change}>
          <option value="">Все категории</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label>С <input type="date" name="date_from" value={filters.date_from} onChange={change} /></label>
        <label>По <input type="date" name="date_to" value={filters.date_to} onChange={change} /></label>
        <select name="sort" value={filters.sort} onChange={change}>
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
        </select>
        <button className="btn btn-sm" type="submit">Найти</button>
        <button className="btn btn-secondary btn-sm" type="button" onClick={reset}>Сбросить</button>
      </form>

      {error && <div className="flash error">{error}</div>}

      {ads.length > 0 ? (
        <div className="ads-feed">
          {ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
        </div>
      ) : (
        <div className="empty-state">Объявлений не найдено.</div>
      )}
    </div>
  )
}

export default Ads
