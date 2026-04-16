import { useState, useEffect, useRef, useCallback } from 'react'
import ChatBubble from '../../components/dashboard/ChatBubble'

interface Conversation {
  id: string
  title: string
  created_at: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

function getToken() {
  return localStorage.getItem('access_token') || ''
}

async function apiFetch(path: string, options?: RequestInit) {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Load conversations
  useEffect(() => {
    apiFetch('/api/chat/conversations').then(setConversations).catch(() => {})
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (!activeConvId) {
      setMessages([])
      return
    }
    apiFetch(`/api/chat/conversations/${activeConvId}/messages`)
      .then(setMessages)
      .catch(() => {})
  }, [activeConvId])

  // Auto-scroll on new messages
  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const createConversation = async () => {
    const conv = await apiFetch('/api/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    setConversations((prev) => [conv, ...prev])
    setActiveConvId(conv.id)
    setMessages([])
    setSidebarOpen(false)
  }

  const sendMessage = async () => {
    if (!input.trim() || streaming) return
    if (!activeConvId) {
      // Auto-create conversation
      const conv = await apiFetch('/api/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: input.slice(0, 50) }),
      })
      setConversations((prev) => [conv, ...prev])
      setActiveConvId(conv.id)
      await sendToConversation(conv.id, input)
    } else {
      await sendToConversation(activeConvId, input)
    }
  }

  const sendToConversation = async (convId: string, content: string) => {
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setStreaming(true)

    // Add placeholder assistant message
    const assistantId = `stream-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: 'assistant', content: '', created_at: new Date().toISOString() },
    ])

    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`,
          'Accept': 'text/event-stream',
        },
        body: JSON.stringify({ content }),
      })

      console.log('[SSE] status:', res.status, 'content-type:', res.headers.get('content-type'))

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      if (!res.body) throw new Error('ReadableStream not supported')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) {
          console.log('[SSE] stream ended')
          break
        }

        const chunk = decoder.decode(value, { stream: true })
        buffer += chunk

        // Process complete lines from buffer
        let newlineIdx: number
        while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
          const line = buffer.slice(0, newlineIdx)
          buffer = buffer.slice(newlineIdx + 1)

          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6).trim()
          if (payload === '[DONE]') continue

          try {
            const parsed = JSON.parse(payload)
            if (parsed.error) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: `错误: ${parsed.error}` } : m,
                ),
              )
            } else if (parsed.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId ? { ...m, content: m.content + parsed.delta } : m,
                ),
              )
            }
          } catch (e) {
            console.warn('[SSE] parse error:', payload, e)
          }
        }
      }

      // Refresh conversation list to get updated title
      apiFetch('/api/chat/conversations').then(setConversations).catch(() => {})
    } catch (err) {
      console.error('[SSE] fetch error:', err)
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: `连接中断: ${err instanceof Error ? err.message : '未知错误'}` }
            : m,
        ),
      )
    } finally {
      setStreaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="flex h-full">
      {/* Conversation list sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-64 border-r border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900 transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-14 items-center justify-between border-b border-gray-200 px-4 dark:border-gray-800">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">对话列表</h3>
          <button
            type="button"
            onClick={createConversation}
            className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500"
          >
            新建
          </button>
        </div>
        <div className="overflow-y-auto p-2">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              type="button"
              onClick={() => {
                setActiveConvId(conv.id)
                setSidebarOpen(false)
              }}
              className={`mb-1 w-full truncate rounded-lg px-3 py-2 text-left text-sm ${
                activeConvId === conv.id
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
              }`}
            >
              {conv.title}
            </button>
          ))}
          {conversations.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-gray-400">还没有对话</p>
          )}
        </div>
      </div>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Chat main area */}
      <div className="flex flex-1 flex-col">
        {/* Mobile header */}
        <div className="flex h-14 items-center gap-3 border-b border-gray-200 px-4 dark:border-gray-800 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 dark:text-gray-300"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5">
              <line x1={3} y1={12} x2={21} y2={12} />
              <line x1={3} y1={6} x2={21} y2={6} />
              <line x1={3} y1={18} x2={21} y2={18} />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-900 dark:text-white">AI 对话</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !activeConvId && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <p className="text-lg font-medium text-gray-400 dark:text-gray-500">开始新的对话</p>
                <p className="mt-1 text-sm text-gray-400 dark:text-gray-500">向 AI 学习助手提问任何学习相关的问题</p>
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} role={msg.role} content={msg.content} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={streaming}
              placeholder="输入你的问题..."
              rows={1}
              className="flex-1 resize-none rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
              className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-600"
            >
              {streaming ? '回复中...' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
