import { Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import Header from './header.jsx'
import Home from './Home.jsx'
import Ads from './Ads.jsx'
import Login from './Login.jsx'
import Register from './Register.jsx'
import AddAd from './AddAd.jsx'
import Lk from './Lk.jsx'
import Chats from './Chats.jsx'
import Admin from './Admin.jsx'
import { useAuth } from './AuthContext.jsx'

// Обёртка для страниц, доступных только после входа (admin=true — только админу)
function RequireAuth({ children, admin = false }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="page">Загрузка…</p>
  if (!user) return <Navigate to="/login" replace />
  if (admin && !user.is_admin) return <Navigate to="/" replace />
  return children
}

function App() {
  return (
    <>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/ads" element={<Ads />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/add_ad" element={<RequireAuth><AddAd /></RequireAuth>} />
        <Route path="/lk" element={<RequireAuth><Lk /></RequireAuth>} />
        <Route path="/chats" element={<RequireAuth><Chats /></RequireAuth>} />
        <Route path="/chats/:chatId" element={<RequireAuth><Chats /></RequireAuth>} />
        <Route path="/admin" element={<RequireAuth admin><Admin /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}

export default App
