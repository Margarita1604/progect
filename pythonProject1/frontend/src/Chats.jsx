import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, formatDate } from './api.js'
import { useAuth } from './AuthContext.jsx'

// Добавляет новые сообщения к списку, отбрасывая дубликаты (по id)
function mergeMessages(old, incoming) {
  const ids = new Set(old.map((m) => m.id))
  return [...old, ...incoming.filter((m) => !ids.has(m.id))]
}

// Окно переписки. «Реальное время» сделано простым опросом: раз в 3 секунды
// спрашиваем у сервера только новые сообщения (GET .../messages?after=<id>).
function ChatWindow({ chatId }) {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const lastId = useRef(0)        // id последнего полученного сообщения
  const bottomRef = useRef(null)  // невидимый элемент внизу — для прокрутки

  useEffect(() => {
    let cancelled = false
    setMessages([])
    lastId.current = 0

    async function poll() {
      try {
        const data = await api(`/chats/${chatId}/messages?after=${lastId.current}`)
        if (cancelled || data.length === 0) return
        lastId.current = Math.max(lastId.current, data[data.length - 1].id)
        setMessages((prev) => mergeMessages(prev, data))
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }

    poll()
    const timer = setInterval(poll, 3000)
    return () => { cancelled = true; clearInterval(timer) }   // при смене чата останавливаем опрос
  }, [chatId])

  // Прокручиваем вниз при появлении новых сообщений
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const msg = await api(`/chats/${chatId}/messages`, { method: 'POST', body: { text } })
      lastId.current = Math.max(lastId.current, msg.id)
      setMessages((prev) => mergeMessages(prev, [msg]))
      setText('')
    } catch (err) {
      setError(err.message)
    }
  }

  return (
    <div className="chat-window">
      {error && <div className="flash error">{error}</div>}
      <div className="chat-messages">
        {messages.map((m) => (
          <div key={m.id} className={'bubble ' + (m.sender_id === user.id ? 'mine' : 'theirs')}>
            <div>{m.text}</div>
            <div className="bubble-time">{formatDate(m.created_at)}</div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Напишите сообщение…" />
        <button className="btn" type="submit">Отправить</button>
      </form>
    </div>
  )
}

// Страница чатов: слева список диалогов, справа выбранная переписка
export default function Chats() {
  const { chatId } = useParams()      // id из адреса /chats/:chatId (может отсутствовать)
  const [chats, setChats] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    api('/chats').then(setChats).catch((err) => setError(err.message))
  }, [chatId])

  return (
    <div className="page">
      <h1 className="page-title">Чаты</h1>
      {error && <div className="flash error">{error}</div>}
      <div className="chats-layout">
        <aside className="chat-list">
          {chats.length === 0 && <div className="empty-state">Пока нет диалогов. Откликнитесь на объявление.</div>}
          {chats.map((c) => (
            <Link key={c.id} to={`/chats/${c.id}`}
                  className={'chat-item' + (String(c.id) === chatId ? ' active' : '')}>
              <strong>{c.partner.name}</strong>
              <span className="muted">{c.ad.goal}</span>
              {c.last_message && <span className="muted">{c.last_message.text.slice(0, 40)}</span>}
            </Link>
          ))}
        </aside>
        <section className="chat-main">
          {chatId ? <ChatWindow chatId={chatId} /> : <div className="empty-state">Выберите диалог слева.</div>}
        </section>
      </div>
    </div>
  )
}
