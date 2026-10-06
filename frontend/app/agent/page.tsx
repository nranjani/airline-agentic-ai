'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { clearAuthSession, getAuthSession } from '@/lib/auth'

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
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [sessions, setSessions]           = useState<Session[]>([])
  const [activeSession, setActiveSession] = useState<string>('')
  const [agentInput, setAgentInput]       = useState('')
  const [sending, setSending]             = useState(false)
  const messagesEndRef                    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const session = getAuthSession()

    if (!session) {
      router.replace('/login')
      return
    }

    if (session.role !== 'agent') {
      router.replace('/chat')
      return
    }

    setReady(true)
  }, [router])

  useEffect(() => {
    if (!ready) return

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
  }, [activeSession, ready])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sessions, activeSession])

  const activeData = sessions.find(s => s.session_id === activeSession)

  const getConversationContext = () => {
    if (!activeData) return { topic: '', pnrFound: '', lastUserMsg: '', pnrAlreadyAsked: false, bookingStep: '' }

    // Only scan USER messages for topic and PNR
    const userMsgs = activeData.messages.filter(m => m.role === 'user')
    const userText = userMsgs.map(m => m.content).join(' ')
    const userTextLower = userText.toLowerCase()

    const lastUserMsg = [...userMsgs].reverse()
      .find(m => m.content.trim().length > 3)?.content || ''

    // Extract PNR from USER messages only — avoid matching words like PLEASE
    // PNR must be exactly 6 alphanumeric chars and NOT a common English word
    const commonWords = ['PLEASE', 'THANKS', 'CANCEL', 'REFUND', 'FLIGHT', 'TICKET', 'DALLAS', 'BOSTON', 'NEWYOR']
    const pnrMatch = userText.match(/\b[A-Z0-9]{6}\b/gi)
    const pnrFound = pnrMatch
      ? pnrMatch.find(p => !commonWords.includes(p.toUpperCase()) && /[0-9]/.test(p))?.toUpperCase() || ''
      : ''

    // Check if agent already asked for PNR
    const agentMsgs = activeData.messages
      .filter(m => m.role === 'assistant' && m.content.includes('[Agent]'))
      .map(m => m.content.toLowerCase()).join(' ')
    const pnrAlreadyAsked = agentMsgs.includes('reference number') || agentMsgs.includes('booking number')

    // Detect topic from user messages only
    let topic = 'general'
    if (userTextLower.includes('refund')) topic = 'refund'
    else if (userTextLower.includes('cancel')) topic = 'cancel'
    else if (userTextLower.includes('book') || userTextLower.includes('flight') || userTextLower.includes('reschedule') || userTextLower.includes('fly')) topic = 'booking'
    else if (userTextLower.includes('delay') || userTextLower.includes('late')) topic = 'delay'
    else if (userTextLower.includes('baggage') || userTextLower.includes('bag')) topic = 'baggage'

    // Booking step — check what info customer has provided
    const hasOrigin = userTextLower.includes('from') || userTextLower.includes('dallas') || userTextLower.includes('dfw') || userTextLower.includes('jfk') || userTextLower.includes('lax')
    const hasDestination = userTextLower.includes(' to ') || userTextLower.includes('newyork') || userTextLower.includes('new york') || userTextLower.includes('chicago') || userTextLower.includes('miami')
    const hasRoute = hasOrigin && hasDestination
    const hasDate = userTextLower.includes('next') || userTextLower.includes('friday') || userTextLower.includes('monday') || userTextLower.includes('january') || userTextLower.includes('february') || userTextLower.includes('march') || userTextLower.includes('april') || userTextLower.includes('may') || userTextLower.includes('june') || userTextLower.includes('july') || userTextLower.includes('august') || userTextLower.includes('september') || userTextLower.includes('october') || userTextLower.includes('november') || userTextLower.includes('december') || /\b\d{1,2}\/\d{1,2}/.test(userTextLower)
    const hasPassengers = /\b[1-9]\s*(passenger|person|people|adult|travell)/.test(userTextLower) || userTextLower.includes('just me') || userTextLower.includes('one person') || userTextLower.includes('two people')
    const hasCabin = userTextLower.includes('economy') || userTextLower.includes('business') || userTextLower.includes('first class') || userTextLower.includes('main cabin')

    let bookingStep = 'ask_origin'
    if (hasRoute && hasDate && hasPassengers && hasCabin) bookingStep = 'confirm'
    else if (hasRoute && hasDate && hasPassengers) bookingStep = 'ask_cabin'
    else if (hasRoute && hasDate) bookingStep = 'ask_passengers'
    else if (hasRoute) bookingStep = 'ask_date'
    else if (hasOrigin) bookingStep = 'ask_destination'

    return { topic, pnrFound, lastUserMsg, pnrAlreadyAsked, bookingStep }
  }

  const getSuggestion = () => {
    const { topic, pnrFound, lastUserMsg, pnrAlreadyAsked, bookingStep } = getConversationContext()
    const preview = lastUserMsg.slice(0, 60)

    switch (topic) {
      case 'refund':
        if (pnrFound) return `✅ PNR found: ${pnrFound}. Process the refund now — initiate to their original payment method. Timeline: 7-10 business days for credit card.`
        if (pnrAlreadyAsked) return `⏳ Already asked for PNR. Customer last said: "${preview}". Check if they gave a 6-character code with numbers (like AB1234).`
        return `💳 Customer wants a refund. Ask for their booking reference number — a 6-character code from their confirmation email.`
      case 'cancel':
        if (pnrFound) return `✅ PNR found: ${pnrFound}. Check fare type — Main Cabin = full refund, Basic Economy = travel credit only. Confirm cancellation.`
        if (pnrAlreadyAsked) return `⏳ Already asked for PNR. Customer last said: "${preview}". Check if they gave a reference number.`
        return `❌ Customer wants to cancel. Ask for their booking reference number.`
      case 'booking':
        if (bookingStep === 'ask_origin') return `✈️ Ask: "Which city are you flying from?"`
        if (bookingStep === 'ask_destination') return `✈️ Got origin. Ask: "And where would you like to fly to?"`
        if (bookingStep === 'ask_date') return `📅 Got route. Ask: "What date would you like to travel?"`
        if (bookingStep === 'ask_passengers') return `👥 Got date. Ask: "How many passengers will be travelling?"`
        if (bookingStep === 'ask_cabin') return `💺 Got passengers. Ask: "Which cabin class — Economy, Main Cabin, Business, or First Class?"`
        if (bookingStep === 'confirm') return `✅ All details collected. Finalize the booking without asking for payment details; provide a PNR number and confirmation.`
        return `Help the customer book their flight step by step.`
      case 'delay':
        return `⏰ Customer has a delay issue. Last said: "${preview}". Check flight status and offer rebooking or compensation.`
      case 'baggage':
        return `🧳 Customer has a baggage issue. Last said: "${preview}". Check policy and help file a claim.`
      default:
        return `Customer last said: "${preview}". Review the transcript on the left and assist based on their need.`
    }
  }

  const getSuggestedReply = () => {
    const { topic, pnrFound, pnrAlreadyAsked, bookingStep } = getConversationContext()

    switch (topic) {
      case 'refund':
        if (pnrFound) return `Thank you. I have located booking ${pnrFound} and I am processing your refund now. You will receive it within 7-10 business days to your original payment method.`
        if (pnrAlreadyAsked) return `Just to confirm — your booking reference is a 6-character code containing both letters and numbers, like AB1234. Could you double-check that for me?`
        return `I can process your refund right away. Could you share your booking reference number?`
      case 'cancel':
        if (pnrFound) return `I can confirm the cancellation of booking ${pnrFound}. You are eligible for a full refund within 7-10 business days. Shall I proceed?`
        if (pnrAlreadyAsked) return `Your booking reference should be a 6-character code like AB1234. Could you check your confirmation email?`
        return `I can help you cancel. Could you share your booking reference number?`
      case 'booking':
        if (bookingStep === 'ask_origin') return `I can help you with that! Which city are you flying from?`
        if (bookingStep === 'ask_destination') return `Got it! And where would you like to fly to?`
        if (bookingStep === 'ask_date') return `Great! What date would you like to travel?`
        if (bookingStep === 'ask_passengers') return `Perfect! How many passengers will be travelling?`
        if (bookingStep === 'ask_cabin') return `Almost there! Which cabin class would you prefer — Economy, Main Cabin, Business, or First Class?`
        if (bookingStep === 'confirm') return `Thank you for all the details! I have booked your flight and skipped the payment step for this demo. Your booking reference number is ${Math.random().toString(36).substring(2,5).toUpperCase()}${Math.floor(Math.random()*900+100)}. You will receive a confirmation email shortly.`
        return `I can help you with your flight. Which city are you flying from?`
      case 'delay':
        return `I sincerely apologize for the inconvenience. Let me check your flight status right now and find the best available options for you.`
      case 'baggage':
        return `I am sorry to hear about your baggage issue. Could you provide your flight number and booking reference so I can look into this?`
      default:
        return `Thank you for reaching out. I can see your full conversation and I am here to help. What would you like me to assist you with?`
    }
  }

  const handleLogout = () => {
    clearAuthSession()
    router.push('/login')
  }

  const handleTakeover = async () => {
    if (!activeSession) return
    await fetch(`${FASTAPI}/agent/takeover/${activeSession}`, { method: 'POST' })
    const res = await fetch(`${FASTAPI}/agent/sessions`)
    setSessions(await res.json())
  }

  const handleAgentReply = async () => {
    if (!agentInput.trim() || !activeSession || sending) return
    const msgToSend = agentInput
    setSending(true)
    setAgentInput('')
    await fetch(`${FASTAPI}/agent/reply`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ session_id: activeSession, message: msgToSend })
    })
    const res = await fetch(`${FASTAPI}/agent/sessions`)
    setSessions(await res.json())
    setSending(false)
  }

  if (!ready) {
    return null
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <div className="w-64 bg-white border-r flex flex-col">
        <div className="bg-blue-900 text-white px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-semibold text-sm">Agent Dashboard</p>
              <p className="text-xs text-blue-300">CXP Console — Live</p>
            </div>
            <button onClick={handleLogout} className="rounded-full border border-blue-300 px-2 py-1 text-[10px] font-medium text-white hover:bg-blue-800">Logout</button>
          </div>
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

      {!activeData ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-400 text-sm">No session selected</p>
            <p className="text-gray-400 text-xs mt-1">Go to localhost:3000/chat and click "Speak to an agent"</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
            <div>
              <p className="font-semibold text-sm text-gray-800">Session: {activeData.session_id}</p>
              <p className="text-xs text-gray-500">
                PNR: {getConversationContext().pnrFound || 'N/A'} ·
                Topic: {getConversationContext().topic || activeData.intent} ·
                Step: {getConversationContext().bookingStep || 'N/A'} ·
                Messages: {activeData.messages.length}
              </p>
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

            <div className="w-72 flex flex-col overflow-y-auto">
              <div className="border-b">
                <div className="px-4 py-2 bg-purple-50 border-b">
                  <p className="text-xs font-medium text-purple-700 uppercase tracking-wide">🤖 AI Suggestion</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-gray-700 leading-relaxed mb-3">{getSuggestion()}</p>
                  <button onClick={() => setAgentInput(getSuggestedReply())}
                    className="w-full text-xs bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 transition">
                    Use this suggestion
                  </button>
                </div>
              </div>

              <div className="border-b">
                <div className="px-4 py-2 bg-blue-50 border-b">
                  <p className="text-xs font-medium text-blue-700 uppercase tracking-wide">Context</p>
                </div>
                <div className="px-4 py-3 space-y-2">
                  {[
                    ['Session', activeData.session_id],
                    ['PNR', getConversationContext().pnrFound || 'Not provided yet'],
                    ['Topic', getConversationContext().topic || activeData.intent],
                    ['Step', getConversationContext().bookingStep || 'N/A'],
                    ['Status', activeData.taken_over ? 'Agent Active' : 'Waiting'],
                    ['Messages', String(activeData.messages.length)],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-2">
                      <span className="text-xs text-gray-500 flex-shrink-0">{label}</span>
                      <span className="text-xs font-medium text-gray-800 text-right">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

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
