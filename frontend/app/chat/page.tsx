'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
  needs_escalation?: boolean
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Welcome to Airline Assistant! I can help you book flights, cancel bookings, or process refunds. How can I help you today?'
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState('loading')

useEffect(() => {
  setSessionId(Math.random().toString(36).substring(2, 9))
}, [])
  const [escalated, setEscalated] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || loading) return

    const userMessage: Message = { role: 'user', content: messageText }
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

      const assistantMessage: Message = {
        role: 'assistant',
        content: data.reply,
        intent: data.intent,
        needs_escalation: data.needs_escalation
      }

      setMessages(prev => [...prev, assistantMessage])

      if (data.needs_escalation) {
        setEscalated(true)
      }

    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I am having trouble connecting. Please try again.'
      }])
    } finally {
      setLoading(false)
    }
  }

  const quickReplies = [
    'Book a flight from DFW to JFK',
    'Cancel my booking',
    'Request a refund',
    'Speak to a human agent'
  ]

  return (
    <div className="flex flex-col h-screen bg-gray-50">

      {/* Header */}
      <div className="bg-blue-900 text-white px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center font-bold text-sm">
          AA
        </div>
        <div>
          <p className="font-semibold text-sm">Airline Assistant</p>
          <p className="text-xs text-blue-300">
            {escalated ? '🔴 Connecting to human agent...' : '🟢 AI Agent Online'}
          </p>
        </div>
        <div className="ml-auto text-xs text-blue-300">
          Session: {sessionId}
        </div>
      </div>

      {/* Quick replies */}
      <div className="flex gap-2 px-4 py-2 overflow-x-auto bg-white border-b">
        {quickReplies.map((reply, i) => (
          <button
            key={i}
            onClick={() => sendMessage(reply)}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border border-blue-300 text-blue-700 hover:bg-blue-50 transition"
          >
            {reply}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 bg-blue-900 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                AA
              </div>
            )}
            <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-blue-900 text-white rounded-br-sm'
                : 'bg-white text-gray-800 rounded-bl-sm shadow-sm border'
            }`}>
              <p className="leading-relaxed">{msg.content}</p>
              {msg.intent && (
                <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                  {msg.intent}
                </span>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ml-2 flex-shrink-0 mt-1">
                R
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 bg-blue-900 rounded-full flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0">
              AA
            </div>
            <div className="bg-white border rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0.2s'}}></div>
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay:'0.4s'}}></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Escalation banner */}
      {escalated && (
        <div className="bg-yellow-50 border-t border-yellow-200 px-4 py-2 text-sm text-yellow-800 text-center">
          ⚡ You are being connected to a live agent. Estimated wait: 2-3 minutes.
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && sendMessage()}
          placeholder="Type your message..."
          className="flex-1 border rounded-full px-4 py-2 text-sm focus:outline-none focus:border-blue-400"
          disabled={loading}
        />
        <button
          onClick={() => sendMessage()}
          disabled={loading || !input.trim()}
          className="bg-blue-900 text-white px-4 py-2 rounded-full text-sm hover:bg-blue-800 disabled:opacity-50 transition"
        >
          Send
        </button>
      </div>
    </div>
  )
}
