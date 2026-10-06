
'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clearAuthSession, getAuthSession } from '@/lib/auth'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
  needs_escalation?: boolean
  timestamp?: string
  isAgent?: boolean
  isMenu?: boolean
}

export default function ChatPage() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Welcome to Prime Airlines! How can I help you today?',
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      isMenu: true
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('loading')
  const [escalated, setEscalated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const session = getAuthSession()

    if (!session) {
      router.replace('/login')
      return
    }

    if (session.role !== 'customer') {
      router.replace('/agent')
      return
    }

    setIsReady(true)
    setSessionId(Math.random().toString(36).substring(2, 9))
  }, [router])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && !loading) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [isOpen, loading, messages.length])

  useEffect(() => {
    if (!sessionId || sessionId === 'loading') return
    const poll = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/agent/sessions/${sessionId}`)
        const data = await res.json()
        if (data && !data.error && data.messages && data.taken_over) {
          setMessages(data.messages.map((m: {role: string, content: string, intent?: string}) => ({
            role: m.role === 'user' ? 'user' : 'assistant' as 'user' | 'assistant',
            content: m.content,
            intent: m.intent || '',
            isAgent: m.content.startsWith('[Agent]'),
            timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
          })))
        }
      } catch { /* not escalated yet */ }
    }
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [sessionId])

  const handleLogout = () => {
    clearAuthSession()
    router.push('/login')
  }

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('http://127.0.0.1:8000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, session_id: sessionId })
      })
      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        intent: data.intent,
        needs_escalation: data.needs_escalation,
        isAgent: false,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        isMenu: false
      }])
      if (data.needs_escalation) setEscalated(true)
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I am having trouble connecting. Please try again.',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }])
    } finally {
      setLoading(false)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }

  const menuActions = [
    { icon: '✈️', label: 'Book a flight', msg: 'I want to book a flight', color: 'bg-blue-50 border-blue-200 hover:bg-blue-100' },
    { icon: '❌', label: 'Cancel my booking', msg: 'I need to cancel my booking', color: 'bg-red-50 border-red-200 hover:bg-red-100' },
    { icon: '💳', label: 'Request a refund', msg: 'I want to request a refund', color: 'bg-green-50 border-green-200 hover:bg-green-100' },
    { icon: '👤', label: 'Speak to an agent', msg: 'I need to speak to a human agent', color: 'bg-purple-50 border-purple-200 hover:bg-purple-100' },
  ]

  if (!isReady) {
    return null
  }

  return (
    <div className="min-h-screen bg-white relative">

      {/* ── PRIME AIRLINES WEBSITE ── */}
      <nav className="bg-blue-900 text-white px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-xs">PR</div>
          <span className="font-semibold text-base tracking-wide">Prime Airlines</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-blue-200">
          <span className="text-blue-100">Customer portal</span>
          <button onClick={handleLogout} className="rounded-full border border-blue-300 px-3 py-1.5 text-xs text-white hover:bg-blue-800">Logout</button>
        </div>
        <div className="flex gap-6 text-sm text-blue-200">
          <span className="cursor-pointer hover:text-white">Book</span>
          <span className="cursor-pointer hover:text-white">My Trips</span>
          <span className="cursor-pointer hover:text-white">Travel Info</span>
          <span className="cursor-pointer hover:text-white">Prime Rewards®</span>
        </div>
        <button className="text-sm border border-blue-400 px-4 py-1.5 rounded hover:bg-blue-800 transition">Log in</button>
      </nav>

      <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white px-8 py-16 text-center">
        <h1 className="text-3xl font-bold mb-3">Contact Prime Airlines</h1>
        <p className="text-blue-200 text-base max-w-xl mx-auto">We are here to help. Chat with our AI assistant or connect with a live agent instantly.</p>
        <div className="flex justify-center gap-4 mt-6">
          <button onClick={() => setIsOpen(true)} className="bg-white text-blue-900 font-semibold px-6 py-2.5 rounded text-sm hover:bg-blue-50 transition">Chat with us</button>
          <button className="border border-white text-white px-6 py-2.5 rounded text-sm hover:bg-blue-800 transition">Find your trip</button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-8 py-12">
        <h2 className="text-xl font-semibold text-blue-900 mb-6">What can we help you with?</h2>
        <div className="grid grid-cols-4 gap-4">
          {[
            { icon: '✈️', title: 'Book a flight', desc: 'Search and book flights' },
            { icon: '❌', title: 'Cancel booking', desc: 'Cancel and get a refund' },
            { icon: '💳', title: 'Refunds', desc: 'Check refund status' },
            { icon: '👤', title: 'Talk to an agent', desc: 'Speak with our team' },
          ].map(({ icon, title, desc }) => (
            <div key={title} onClick={() => setIsOpen(true)} className="bg-white border rounded-xl p-5 text-center cursor-pointer hover:shadow-md hover:border-blue-300 transition">
              <div className="text-3xl mb-2">{icon}</div>
              <h3 className="font-semibold text-gray-800 text-sm mb-1">{title}</h3>
              <p className="text-xs text-gray-500">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FLOATING CHAT PANEL ── */}

      {/* Side panel */}
      <div className={`fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>

        {/* Header */}
        <div className="bg-blue-950 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-600 rounded-lg flex items-center justify-center font-bold text-xs text-white">PR</div>
            <div>
              <p className="text-white font-semibold text-sm leading-none">Prime Airlines</p>
              <p className="text-blue-300 text-xs mt-0.5">{escalated ? '🔴 Connecting to agent...' : '🟢 AI Assistant'}</p>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="text-white opacity-60 hover:opacity-100 transition">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 11H7.83l4.88-4.88c.39-.39.39-1.03 0-1.42-.39-.39-1.02-.39-1.41 0l-6.59 6.59c-.39.39-.39 1.02 0 1.41l6.59 6.59c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L7.83 13H19c.55 0 1-.45 1-1s-.45-1-1-1z"/>
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3" style={{background: '#f0f4f8'}}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>

              {/* Bot label */}
              {msg.role === 'assistant' && (
                <span className="text-xs text-gray-400 mb-1">{msg.isAgent ? '👤 Live Agent' : 'Prime Assistant'}</span>
              )}

              {/* Message bubble */}
              <div className={`max-w-xs rounded-2xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-blue-900 text-white px-4 py-2.5 rounded-br-sm'
                  : msg.isAgent
                  ? 'bg-green-50 border border-green-200 text-gray-800 px-4 py-2.5 rounded-bl-sm'
                  : msg.isMenu
                  ? 'w-full'
                  : 'bg-white border text-gray-800 px-4 py-2.5 rounded-bl-sm shadow-sm'
              }`}>
                {msg.isMenu ? (
                  <div>
                    <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm mb-3">
                      <p className="text-gray-800 text-sm">{msg.content}</p>
                    </div>
                    {/* Action cards */}
                    <div className="grid grid-cols-2 gap-2">
                      {menuActions.map((action) => (
                        <button
                          key={action.label}
                          onClick={() => sendMessage(action.msg)}
                          className={`${action.color} border rounded-xl p-3 text-left transition`}
                        >
                          <div className="text-xl mb-1">{action.icon}</div>
                          <div className="text-xs font-semibold text-gray-800">{action.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <span>{msg.content.replace('[Agent] ', '')}</span>
                )}
              </div>

              {/* Thumbs up/down for bot messages */}
              {msg.role === 'assistant' && !msg.isMenu && i === messages.length - 1 && !loading && (
                <div className="flex gap-2 mt-1 ml-1">
                  <button className="text-gray-300 hover:text-blue-500 transition">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
                  </button>
                  <button className="text-gray-300 hover:text-red-400 transition">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
                  </button>
                </div>
              )}

              <span className="text-xs text-gray-400 mt-1">{msg.timestamp}</span>

              {/* Escalation notice */}
              {msg.needs_escalation && (
                <div className="mt-2 text-center w-full">
                  <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border">Connecting you to a live agent...</span>
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex flex-col items-start">
              <span className="text-xs text-gray-400 mb-1">Prime Assistant</span>
              <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0.15s'}}></div>
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0.3s'}}></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t px-4 py-3 flex items-center gap-3 bg-white flex-shrink-0">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask something..."
            className="flex-1 text-sm text-gray-700 placeholder-gray-400 focus:outline-none"
            disabled={loading}
            autoFocus
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="text-blue-900 disabled:opacity-30 transition hover:text-blue-700">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Chat bubble button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-900 rounded-full shadow-lg flex items-center justify-center hover:bg-blue-800 transition z-40"
      >
        {isOpen ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        )}
      </button>

    </div>
  )
}
