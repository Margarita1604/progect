import { NavLink, useNavigate } from 'react-router-dom'
import './App.css'
import { useAuth } from './AuthContext.jsx'

// Шапка сайта. Набор ссылок зависит от того, вошёл ли пользователь и админ ли он.
function Header() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <header className="site-header">
      <nav className="nav">
        <NavLink to="/" end className="nav-link">Главная</NavLink>
        <NavLink to="/ads" className="nav-link">Объявления</NavLink>
        {user ? (
          <>
            <NavLink to="/lk" className="nav-link">Личный кабинет</NavLink>
            <NavLink to="/chats" className="nav-link">Чаты</NavLink>
            <NavLink to="/add_ad" className="nav-link">Добавить объявление</NavLink>
            {user.is_admin && <NavLink to="/admin" className="nav-link">Модерация</NavLink>}
            <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Выйти</button>
          </>
        ) : (
          <>
            <NavLink to="/login" className="nav-link">Войти</NavLink>
            <NavLink to="/register" className="nav-link">Регистрация</NavLink>
          </>
        )}
      </nav>
    </header>
  )
}

export default Header
