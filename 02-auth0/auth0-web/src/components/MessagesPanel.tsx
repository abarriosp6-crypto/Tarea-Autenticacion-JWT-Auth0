
import { useAuth0 } from '@auth0/auth0-react'
import { useEffect, useState } from 'react'

type Message = {
  id: number
  text: string
  createdBy: string
}

export default function MessagesPanel() {
  const { getAccessTokenSilently, user } = useAuth0()
  const [messages, setMessages] = useState<Message[]>([])
  const [permissions, setPermissions] = useState<string[]>([])
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)

  const apiUrl = 'http://localhost:5090'
  const audience = 'https://api.umg-messages.com'

  async function getToken() {
    return getAccessTokenSilently({
      authorizationParams: { audience }
    })
  }

  async function loadMessages() {
    setLoading(true)
    try {
      const token = await getToken()
      const payload = JSON.parse(atob(token.split('.')[1]
        .replace(/-/g, '+').replace(/_/g, '/')))

      setPermissions(payload.permissions ?? [])

      const response = await fetch(`${apiUrl}/api/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      setResult(`GET /api/messages → HTTP ${response.status}`)

      if (response.ok) {
        setMessages(await response.json())
      } else {
        setMessages([])
      }
    } catch (error) {
      setResult(`Error: ${String(error)}`)
    } finally {
      setLoading(false)
    }
  }

  async function deleteMessage(id: number) {
    try {
      const token = await getToken()
      const response = await fetch(`${apiUrl}/api/messages/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      })

      setResult(`DELETE /api/messages/${id} → HTTP ${response.status}`)

      if (response.ok) {
        setMessages(current => current.filter(m => m.id !== id))
      }
    } catch (error) {
      setResult(`Error: ${String(error)}`)
    }
  }

  useEffect(() => {
    void loadMessages()
  }, [user?.sub])

  const canDelete = permissions.includes('delete:messages')

  return (
    <section className="card">
      <h2>Gestión de mensajes (RBAC)</h2>
      <p>Usuario: <strong>{user?.email}</strong></p>
      <p>Permisos: <code>{permissions.join(', ') || 'Ninguno'}</code></p>

      <button onClick={loadMessages} disabled={loading}>
        {loading ? 'Cargando...' : 'Consultar mensajes'}
      </button>

      {result && <p><strong>Resultado: {result}</strong></p>}

      {messages.map(message => (
        <div key={message.id} style={{
          padding: '12px',
          marginTop: '10px',
          border: '1px solid #555',
          borderRadius: '8px'
        }}>
          <p>{message.text}</p>
          <small>Creado por: {message.createdBy}</small>
          {canDelete && (
            <div style={{ marginTop: '10px' }}>
              <button onClick={() => deleteMessage(message.id)}>
                Eliminar mensaje
              </button>
            </div>
          )}
        </div>
      ))}

      <p>
        El botón Eliminar solo aparece con el permiso
        <code> delete:messages</code>.
        La API también verifica el permiso.
      </p>
    </section>
  )
}
