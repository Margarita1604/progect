import { useCallback, useEffect, useState } from 'react'
import { api, formatDate } from './api.js'

// Панель модератора: скрывать/удалять объявления, блокировать нарушителей.
// Доступна только пользователю с is_admin=true (проверяется и в App.jsx, и на сервере).
export default function Admin() {
  const [tab, setTab] = useState('ads')
  const [ads, setAds] = useState([])
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      setAds(await api('/admin/ads'))
      setUsers(await api('/admin/users'))
    } catch (err) {
      setError(err.message)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Выполнить действие на сервере и обновить таблицы
  async function act(path, method = 'POST') {
    try {
      await api(path, { method })
      load()
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="page">
      <h1 className="page-title">Модерация</h1>
      {error && <div className="flash error">{error}</div>}
      <div className="row">
        <button className={'btn btn-sm' + (tab === 'ads' ? '' : ' btn-secondary')} onClick={() => setTab('ads')}>Объявления</button>
        <button className={'btn btn-sm' + (tab === 'users' ? '' : ' btn-secondary')} onClick={() => setTab('users')}>Пользователи</button>
      </div>

      {tab === 'ads' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Дата</th><th>Автор</th><th>Заголовок</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>
              {ads.map((ad) => (
                <tr key={ad.id}>
                  <td>{formatDate(ad.creation_date)}</td>
                  <td>{ad.author_user.name}</td>
                  <td>{ad.goal}</td>
                  <td>{ad.is_hidden ? 'Скрыто' : ad.is_active ? 'Активно' : 'Закрыто'}</td>
                  <td className="row">
                    <button className="btn btn-secondary btn-sm" onClick={() => act(`/admin/ads/${ad.id}/hide`)}>
                      {ad.is_hidden ? 'Вернуть' : 'Скрыть'}
                    </button>
                    <button className="btn btn-danger btn-sm"
                            onClick={() => window.confirm('Удалить как спам?') && act(`/ads/${ad.id}`, 'DELETE')}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'users' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Имя</th><th>Email</th><th>Статус</th><th>Действия</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.is_admin ? 'Админ' : u.is_blocked ? 'Заблокирован' : 'Активен'}</td>
                  <td>
                    {!u.is_admin && (
                      <button className="btn btn-secondary btn-sm" onClick={() => act(`/admin/users/${u.id}/block`)}>
                        {u.is_blocked ? 'Разблокировать' : 'Заблокировать'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
