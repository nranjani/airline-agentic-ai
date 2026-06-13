'use client'

import { useState, useEffect, useRef } from 'react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  intent?: string
  timestamp: string
}

interface Session {
  session_id: string
  messages: Message[]
  needs_escalation: boolean
  intent: string
  pnr: string
}

export default function AgentDashboard() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [agentInput, setAgentInput] = useState('')
  const [takenOver, setTakenOver] = useState<string[]>([])
  const [suggestion, setSuggestion] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Simulate receiving escalated sessions
  useEffect(() => {
    const mockSession: Session = {
      session_id: 'cust-001',
      messages: [
        {
          role: 'user',
          content: 'I need to cancel my booking 5381EB',
          intent: 'CANCEL',
          timestamp: new Date().toLocaleTimeString()
        },
        {
          role: 'assistant',
          content: 'I can help you cancel booking 5381EB. The booking is for Ranju N on flight AA 2847 from DFW to JFK. This is a Main Cabin fare so you are eligible for a full refund.',
          intent: 'CANCEL',
          timestamp: new Date().toLocaleTimeString()
        },
        {
          role: 'user',
          content: 'I need to speak to a human agent',
          intent: 'ESCALATE',
          timestamp: new Date().toLocaleTimeString()
        },
        {
          role: 'assistant',
          content: 'I am connecting you with a live agent now. Your conversation history will be shared.',
          intent: 'ESCALATE',
          timestamp: new Date().toLocaleTimeString()
        }
      ],
      needs_escalation: true,
      intent: 'ESCALATE',
      pnr: '5381EB'
    }
    setSessions([mockSession])
    setActiveSession('cust-001')

    // AI suggestion for agent
    setSuggestion('Customer wants to cancel booking 5381EB (Main Cabin, DFW→JFK). Eligible for full refund. Suggest: confirm cancellation and initiate refund to original payment method within 7-10 business days.')
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeSession])

  const activeSessionData = sessions.find(s => s.session_id === activeSession)

  const handleTakeover = (sessionId: string) => {
    setTakenOver(prev => [...prev, sessionId])
  }

  const handleAgentReply = async () => {
    if (!agentInput.trim() || !activeSession) return

    const newMessage: Message = {
      role: 'assistant',
      content: `[Agent] ${agentInput}`,
      intent: 'AGENT',
      timestamp: new Date().toLocaleTimeString()
    }

    setSessions(prev => prev.map(s =>
      s.session_id === activeSession
        ? { ...s, messages: [...s.messages, newMessage] }
        : s
    ))
    setAgentInput('')
  }

  const useSuggestion = () => {
    setAgentInput(suggestion)
  }

  const intentColor: Record<string, string> = {
    BOOKING: 'bg-blue-100 text-blue-700',
    CANCEL: 'bg-red-100 text-red-700',
    REFUND: 'bg-yellow-100 text-yellow-700',
    ESCALATE: 'bg-purple-100 text-purple-700',
    AGENT: 'bg-green-100 text-green-700',
    GENERAL: 'bg-gray-100 text-gray-700'
  }

  return (
    <div className="flex h-screen bg-gray-100">

      {/* Left sidebar — session list */}
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="bg-blue-900 text-white px-4 py-3">
          <p className="font-semibold text-sm">Agent Dashboard</p>
          <p className="text-xs text-blue-300">CXP Console</p>
        </div>

        <div className="px-3 py-2 border-b">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Active Sessions ({sessions.length})
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sessions.map(session => (
            <div
              key={session.session_id}
              onClick={() => setActiveSession(session.session_id)}
              className={`px-4 py-3 cursor-pointer border-b hover:bg-gray-50 ${
                activeSession === session.session_id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-gray-800">
                  {session.session_id}
                </p>
                {session.needs_escalation && (
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                PNR: {session.pnr || 'N/A'}
              </p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${intentColor[session.intent] || 'bg-gray-100 text-gray-700'}`}>
                {session.intent}
              </span>
              {takenOver.includes(session.session_id) && (
                <p className="text-xs text-green-600 mt-1">● Agent active</p>
              )}
            </div>
          ))}
        </div>

        {/* Agent status */}
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              R
            </div>
            <div>
              <p className="text-xs font-medium text-gray-800">Ranju N</p>
              <p className="text-xs text-green-600">● Available</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">

        {/* Top bar */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm text-gray-800">
              Session: {activeSession}
            </p>
            <p className="text-xs text-gray-500">
              PNR: {activeSessionData?.pnr || 'N/A'} •
              Intent: {activeSessionData?.intent || 'N/A'} •
              Messages: {activeSessionData?.messages.length || 0}
            </p>
          </div>

          <div className="flex gap-2">
            {activeSession && !takenOver.includes(activeSession) && (
              <button
                onClick={() => handleTakeover(activeSession)}
                className="bg-red-600 text-white text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
              >
                ⚡ Take Over
              </button>
            )}
            {takenOver.includes(activeSession) && (
              <span className="bg-green-100 text-green-700 text-xs px-4 py-2 rounded-lg font-medium">
                ✓ Agent in control
              </span>
            )}
          </div>
        </div>

        {/* Three panel layout */}
        <div className="flex-1 flex overflow-hidden">

          {/* Transcript panel */}
          <div className="flex-1 flex flex-col border-r">
            <div className="px-4 py-2 bg-gray-50 border-b">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Live Transcript
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
              {activeSessionData?.messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                    msg.role === 'user'
                      ? 'bg-blue-900 text-white'
                      : msg.intent === 'AGENT'
                      ? 'bg-green-50 border border-green-200 text-gray-800'
                      : 'bg-white border text-gray-800 shadow-sm'
                  }`}>
                    <p className="leading-relaxed">{msg.content}</p>
                    <div className="flex items-center justify-between mt-1 gap-2">
                      <span className="text-xs opacity-60">{msg.timestamp}</span>
                      {msg.intent && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${intentColor[msg.intent] || 'bg-gray-100 text-gray-600'}`}>
                          {msg.intent}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Agent input */}
            {takenOver.includes(activeSession) && (
              <div className="border-t px-4 py-3 bg-white">
                <p className="text-xs text-green-600 font-medium mb-2">
                  ✓ You are in control — AI paused
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={agentInput}
                    onChange={e => setAgentInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAgentReply()}
                    placeholder="Type your reply to the customer..."
                    className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                  />
                  <button
                    onClick={handleAgentReply}
                    className="bg-blue-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-800"
                  >
                    Send
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Right panel */}
          <div className="w-72 flex flex-col">

            {/* AI Suggestion */}
            <div className="border-b">
              <div className="px-4 py-2 bg-purple-50 border-b">
                <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">
                  🤖 AI Suggestion
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-gray-700 leading-relaxed mb-3">
                  {suggestion}
                </p>
                <button
                  onClick={useSuggestion}
                  className="w-full text-xs bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition"
                >
                  Use this suggestion
                </button>
              </div>
            </div>

            {/* Booking context */}
            <div className="border-b">
              <div className="px-4 py-2 bg-blue-50 border-b">
                <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">
                  Booking Context
                </p>
              </div>
              <div className="px-4 py-3 space-y-2">
                {[
                  ['PNR', activeSessionData?.pnr || 'N/A'],
                  ['Passenger', 'Ranju N'],
                  ['Flight', 'AA 2847'],
                  ['Route', 'DFW → JFK'],
                  ['Date', '2026-07-10'],
                  ['Fare', 'Main Cabin'],
                  ['Status', 'CANCELLED'],
                  ['Loyalty', 'AAdvantage Gold'],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-xs text-gray-500">{label}</span>
                    <span className="text-xs font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Sentiment */}
            <div>
              <div className="px-4 py-2 bg-gray-50 border-b">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  Sentiment
                </p>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <div className="flex-1 h-2 bg-gray-200 rounded-full">
                    <div className="h-2 bg-yellow-400 rounded-full" style={{width:'45%'}}></div>
                  </div>
                  <span className="text-xs text-yellow-600 font-medium">Neutral</span>
                </div>
                <p className="text-xs text-gray-500">
                  Customer is calm. Requesting standard cancellation assistance.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
