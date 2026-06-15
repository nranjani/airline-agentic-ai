'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
}

interface Session {
  session_id: string
  messages: Message[]
  needs_escalation: boolean
  intent: string
  pnr: string
  taken_over: boolean
}

const FASTAPI = 'http://127.0.0.1:8000'

const intentColor: Record<string, string> = {
  BOOKING:  'bg-blue-100 text-blue-700',
  CANCEL:   'bg-red-100 text-red-700',
  REFUND:   'bg-yellow-100 text-yellow-700',
  ESCALATE: 'bg-purple-100 text-purple-700',
  AGENT:    'bg-green-100 text-green-700',
  GENERAL:  'bg-gray-100 text-gray-700'
}

export default function AgentDashboard() {
  const [sessions, setSessions]           = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [agentInput, setAgentInput]       = useState('')
  const [sending, setSending]             = useState(false)
  const messagesEndRef                    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res  = await fetch(`${FASTAPI}/agent/sessions`)
        const data: Session[] = await res.json()
        setSessions(data)
        if (data.length > 0 && !activeSession) {
          setActiveSession(data[0].session_id)
        }
      } catch { }
    }
    poll()
    const interval = setInterval(poll, 3000)
    return () => clearInterval(interval)
  }, [activeSession])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeSession])

  const activeData = sessions.find(s => s.session_id === activeSession)

  // Get last customer message
  const getLastUserMsg = () => {
    if (!activeData) return ''
    // Get last meaningful user message (longer than 4 chars)
    return [...activeData.messages].reverse().find(m => 
      m.role === 'user' && m.content.trim().length > 4
    )?.content || ''
  }

  // Dynamic AI suggestion based on last customer message
  const getSuggestion = () => {
    const msg = getLastUserMsg().toLowerCase()
    const raw = getLastUserMsg().slice(0, 60)
    if (msg.includes('refund')) return `Customer asked about refund: "${raw}..." — Confirm booking is cancelled first, then process refund. Timeline: 7-10 business days for credit card.`
    if (msg.includes('cancel')) return `Customer wants to cancel: "${raw}..." — Check fare type. Main Cabin gets full refund. Basic Economy gets travel credit only.`
    if (msg.includes('book') || msg.includes('flight')) return `Customer wants to book: "${raw}..." — Help them find available flights for their route and date.`
    if (msg.includes('delay') || msg.includes('late')) return `Customer has delay issue: "${raw}..." — Check flight status and offer rebooking or compensation options.`
    if (msg.includes('baggage') || msg.includes('bag')) return `Customer has baggage issue: "${raw}..." — Check baggage policy and help file a claim if needed.`
    return `Customer said: "${raw}..." — Review the full conversation above and assist based on their specific need.`
  }

  // Dynamic suggested reply based on last customer message
  const getSuggestedReply = () => {
    const msg = getLastUserMsg().toLowerCase()
    if (msg.includes('refund')) return `I can process your refund right away. Could you confirm your booking reference number so I can look that up for you?`
    if (msg.includes('cancel')) return `I can help you cancel that booking. Could you share your booking reference number?`
    if (msg.includes('book') || msg.includes('flight')) return `I can help you find the perfect flight. Which city are you flying from?`
    if (msg.includes('delay') || msg.includes('late')) return `I apologize for the inconvenience. Let me check your flight status and find the best options for you right now.`
    return `Thank you for reaching out. I can see your conversation and I am here to help. Could you tell me a bit more about what you need?`
  }

  const handleTakeover = async () => {
    if (!activeSession) return
    await fetch(`${FASTAPI}/agent/takeover/${activeSession}`, { method: 'POST' })
    const res  = await fetch(`${FASTAPI}/agent/sessions`)
    setSessions(await res.json())
  }

  const handleAgentReply = async () => {
    if (!agentInput.trim() || !activeSession || sending) return
    setSending(true)
    await fetch(`${FASTAPI}/agent/reply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: activeSession, message: agentInput })
    })
    setAgentInput('')
    const res  = await fetch(`${FASTAPI}/agent/sessions`)
    setSessions(await res.json())
    setSending(false)
  }

  return (
    <div className="flex h-screen bg-gray-100">

      {/* Sidebar */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="bg-blue-900 text-white px-4 py-3">
          <p className="font-semibold text-sm">Agent Dashboard</p>
          <p className="text-xs text-blue-300">CXP Console — Live</p>
        </div>
        <div className="px-3 py-2 border-b flex items-center justify-between">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Escalated Sessions</p>
          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{sessions.length}</span>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-gray-400">No escalated sessions yet.</p>
              <p className="text-xs text-gray-400 mt-1">Go to /chat and click "Speak to an agent"</p>
            </div>
          )}
          {sessions.map(session => (
            <div key={session.session_id} onClick={() => setActiveSession(session.session_id)}
              className={`px-4 py-3 cursor-pointer border-b hover:bg-gray-50 transition ${activeSession === session.session_id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-gray-800 truncate">{session.session_id}</p>
                {!session.taken_over && <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse flex-shrink-0" />}
              </div>
              <p className="text-xs text-gray-500 mb-1">PNR: {session.pnr || 'N/A'}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${intentColor[session.intent] || 'bg-gray-100 text-gray-600'}`}>{session.intent}</span>
              {session.taken_over && <p className="text-xs text-green-600 mt-1">● Agent active</p>}
            </div>
          ))}
        </div>
        <div className="px-4 py-3 border-t bg-gray-50 flex items-center gap-2">
          <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">R</div>
          <div>
            <p className="text-xs font-medium text-gray-800">Ranju N</p>
            <p className="text-xs text-green-600">● Available</p>
          </div>
        </div>
      </div>

      {/* Main */}
      {!activeData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-sm">No session selected</p>
            <p className="text-gray-400 text-xs mt-1">Go to localhost:3000/chat and click "Speak to an agent"</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">

          {/* Top bar */}
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-800">Session: {activeData.session_id}</p>
              <p className="text-xs text-gray-500">PNR: {activeData.pnr || 'N/A'} · Intent: {activeData.intent} · Messages: {activeData.messages.length}</p>
            </div>
            <div>
              {!activeData.taken_over ? (
                <button onClick={handleTakeover} className="bg-red-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium">⚡ Take Over</button>
              ) : (
                <span className="bg-green-100 text-green-700 text-xs px-4 py-2 rounded-lg font-medium">✓ Agent in control</span>
              )}
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">

            {/* Transcript */}
            <div className="flex-1 flex flex-col border-r">
              <div className="px-4 py-2 bg-gray-50 border-b">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Live Transcript</p>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
                {activeData.messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                      msg.role === 'user' ? 'bg-blue-900 text-white'
                      : msg.intent === 'AGENT' ? 'bg-green-50 border border-green-200 text-gray-800'
                      : 'bg-white border text-gray-800 shadow-sm'}`}>
                      <p className="leading-relaxed">{msg.content}</p>
                      {msg.intent && <span className={`inline-block mt-1 text-xs px-1.5 py-0.5 rounded-full ${intentColor[msg.intent] || 'bg-gray-100 text-gray-600'}`}>{msg.intent}</span>}
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              {activeData.taken_over && (
                <div className="border-t px-4 py-3 bg-white">
                  <p className="text-xs text-green-600 font-medium mb-2">✓ You are in control — AI paused</p>
                  <div className="flex gap-2">
                    <input type="text" value={agentInput} onChange={e => setAgentInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleAgentReply()}
                      placeholder="Type your reply to the customer..."
                      className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                      disabled={sending} />
                    <button onClick={handleAgentReply} disabled={sending || !agentInput.trim()}
                      className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800 disabled:opacity-50">Send</button>
                  </div>
                </div>
              )}
            </div>

            {/* Right panel */}
            <div className="w-72 flex flex-col overflow-y-auto">

              {/* AI Suggestion — fully dynamic */}
              <div className="border-b">
                <div className="px-4 py-2 bg-purple-50 border-b">
                  <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">🤖 AI Suggestion</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-700 leading-relaxed mb-3">{getSuggestion()}</p>
                  <button
                    onClick={() => setAgentInput(getSuggestedReply())}
                    className="w-full text-xs bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition">
                    Use this suggestion
                  </button>
                </div>
              </div>

              {/* Booking context */}
              <div className="border-b">
                <div className="px-4 py-2 bg-blue-50 border-b">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Context</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    ['Session', activeData.session_id],
                    ['PNR', activeData.pnr || 'N/A'],
                    ['Intent', activeData.intent],
                    ['Status', activeData.taken_over ? 'Agent Active' : 'Waiting'],
                    ['Messages', String(activeData.messages.length)],
                    ['Last msg', getLastUserMsg().slice(0, 28) + (getLastUserMsg().length > 28 ? '...' : '')],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
                      <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <div className="px-4 py-2 bg-gray-50 border-b">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Sentiment</p>
                </div>
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="flex-1 h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-yellow-400 rounded-full" style={{ width: '45%' }} />
                    </div>
                    <span className="text-xs text-yellow-600 font-medium">Neutral</span>
                  </div>
                  <p className="text-xs text-gray-500">Customer is calm. Requesting assistance.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
