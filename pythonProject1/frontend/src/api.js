// Единая функция для обращений к Flask API.
//  - добавляет префикс /api (его перехватывает прокси Vite, см. vite.config.js)
//  - credentials: 'include' — отправляет cookie сессии (так сервер знает, кто вошёл)
//  - превращает ошибки сервера ({"error": "..."}) в обычное исключение Error
export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch('/api' + path, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  let data = null
  try {
    data = await response.json()
  } catch {
    // пустой ответ — это нормально
  }
  if (!response.ok) {
    throw new Error((data && data.error) || `Ошибка сервера (${response.status})`)
  }
  return data
}

// Сервер отдаёт время в UTC (строка с 'Z'), браузер переводит в местное.
export function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}
