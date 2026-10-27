import { Link } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

// Главная страница: краткое описание сервиса и ссылки на основные действия
export default function Home() {
  const { user } = useAuth()
  return (
    <div className="page">
      <h1 className="page-title">Поиск учебных партнёров</h1>
      <p className="page-subtitle">
        Находите напарников для подготовки к олимпиадам, хакатонам, экзаменам и групповым проектам.
      </p>
      <div className="row">
        <Link to="/ads"><button className="btn">Смотреть объявления</button></Link>
        {user
          ? <Link to="/add_ad"><button className="btn btn-secondary">Создать объявление</button></Link>
          : <Link to="/register"><button className="btn btn-secondary">Зарегистрироваться</button></Link>}
      </div>
    </div>
  )
}
