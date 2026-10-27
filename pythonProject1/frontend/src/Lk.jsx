import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatDate } from './api.js'
import { useAuth } from './AuthContext.jsx'

// Личный кабинет: профиль (PUT /api/profile) и управление своими объявлениями
export default function Lk() {
  const { user, setUser } = useAuth()
  const [profile, setProfile] = useState({
    name: user.name || '', group: user.group || '', interests: user.interests || '',
    subjects: user.subjects || '', goals: user.goals || '',
  })
  const [saved, setSaved] = useState('')
  const [error, setError] = useState('')
  const [ads, setAds] = useState([])

  const loadAds = useCallback(async () => {
    try {
      setAds(await api('/my/ads'))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { loadAds() }, [loadAds])

  const change = (e) => setProfile({ ...profile, [e.target.name]: e.target.value })

  async function saveProfile(e) {
    e.preventDefault()
    setSaved(''); setError('')
    try {
      const data = await api('/profile', { method: 'PUT', body: profile })
      setUser(data.user)             // обновляем данные в шапке и по всему приложению
      setSaved('Профиль сохранён')
    } catch (err) {
      setError(err.message)
    }
  }

  // Общий помощник для кнопок «Закрыть / Продлить / Удалить»: выполнить и перезагрузить список
  async function action(path, method = 'POST', body) {
    try {
      await api(path, { method, body })
      loadAds()
    } catch (err) {
      setError(err.message)
    }
  }

  function status(ad) {
    if (ad.is_hidden) return 'Скрыто модератором'
    return ad.is_active ? `Актуально до ${formatDate(ad.expires_at)}` : 'Закрыто / истёк срок'
  }

  return (
    <div className="page">
      <h1 className="page-title">Личный кабинет</h1>
      <p className="page-subtitle">{user.email}</p>
      {error && <div className="flash error">{error}</div>}

      <div className="card">
        <h2>Мой профиль</h2>
        {saved && <div className="flash ok">{saved}</div>}
        <form onSubmit={saveProfile}>
          <div className="field"><label>Имя</label>
            <input name="name" value={profile.name} onChange={change} required /></div>
          <div className="field"><label>Класс / группа</label>
            <input name="group" value={profile.group} onChange={change} /></div>
          <div className="field"><label>Учебные интересы</label>
            <textarea name="interests" rows={2} value={profile.interests} onChange={change} /></div>
          <div className="field"><label>Предметы</label>
            <textarea name="subjects" rows={2} value={profile.subjects} onChange={change} /></div>
          <div className="field"><label>Цели обучения</label>
            <textarea name="goals" rows={2} value={profile.goals} onChange={change} /></div>
          <button className="btn" type="submit">Сохранить</button>
        </form>
      </div>

      <div className="row between section-gap">
        <h2>Мои объявления</h2>
        <Link to="/add_ad"><button className="btn btn-sm">Добавить объявление</button></Link>
      </div>

      {ads.length === 0 && <div className="empty-state">У вас пока нет объявлений.</div>}
      <div className="ads-feed">
        {ads.map((ad) => (
          <article className="ad-card" key={ad.id}>
            <div className="ad-header">
              <div>
                <div className="ad-author">{status(ad)}</div>
                <h2 className="ad-goal">{ad.goal}</h2>
              </div>
              <div className="ad-badge">{ad.category}</div>
            </div>
            <p className="ad-text">{ad.text}</p>
            <div className="ad-actions row">
              {ad.is_active
                ? <button className="btn btn-secondary btn-sm" onClick={() => action(`/ads/${ad.id}/close`)}>Закрыть</button>
                : <button className="btn btn-secondary btn-sm" onClick={() => action(`/ads/${ad.id}/extend`, 'POST', { days: 14 })}>Открыть снова на 14 дней</button>}
              {ad.is_active &&
                <button className="btn btn-secondary btn-sm" onClick={() => action(`/ads/${ad.id}/extend`, 'POST', { days: 14 })}>Продлить на 14 дней</button>}
              <button className="btn btn-danger btn-sm"
                      onClick={() => window.confirm('Удалить объявление?') && action(`/ads/${ad.id}`, 'DELETE')}>Удалить</button>
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}
