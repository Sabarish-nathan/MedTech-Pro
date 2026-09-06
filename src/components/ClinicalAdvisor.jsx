import React, { useState, useEffect, useRef } from 'react'
import {
  Bot,
  Send,
  Sparkles,
  Database,
  UserCheck,
  UserPlus,
  RefreshCw,
  Search,
  Activity,
  AlertTriangle,
  Pill,
  Terminal,
  Shield,
  Clock,
  CheckCircle2,
  FileText,
  HelpCircle,
  Stethoscope
} from 'lucide-react'

export default function ClinicalAdvisor() {
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'bot',
      text: "👋 **Welcome to the Aegis AI Clinical Decision Chatbot!**\n\nConnected in real-time to your **MySQL Hospital EHR Database** (`aegis_amr_db`):\n\n• **Returning Patient in Database**: Enter an existing name (e.g. *'Eleanor Vance'* or *'Marcus Brody'*). I will ask for their **Patient ID** to verify and **immediately display all their old details** and past bacterial infection history!\n\n• **New Patient**: Enter a new name (e.g. *'Bruce Wayne'*). I will prompt for their **gender, age, and bacterial infection details** (suspected bacteria, infection site, ICU, GFR), register them into MySQL, and generate the AMR prediction!\n\nType a patient name or select a quick option below to begin.",
      quickReplies: ["Check Eleanor Vance (PT-1001)", "Check Marcus Brody (PT-1002)", "New patient Bruce Wayne"],
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ])

  const [inputMessage, setInputMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [activePatient, setActivePatient] = useState(null)
  const [patientHistory, setPatientHistory] = useState([])
  const [allPatients, setAllPatients] = useState([])
  const [sqlLogs, setSqlLogs] = useState([])
  const [dbStatus, setDbStatus] = useState(null)
  const [patientSearchQuery, setPatientSearchQuery] = useState('')
  const [sessionId] = useState(() => 'sess_' + Math.random().toString(36).substring(2, 9))

  const chatEndRef = useRef(null)
  const sqlEndRef = useRef(null)

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, loading])

  // Fetch initial data: database status, patients, query logs
  const fetchDbData = async () => {
    try {
      const [statusRes, patientsRes, logsRes] = await Promise.all([
        fetch('/api/database/status').then(r => r.json()),
        fetch('/api/database/patients').then(r => r.json()),
        fetch('/api/database/query-logs').then(r => r.json())
      ])
      setDbStatus(statusRes)
      if (patientsRes?.patients) setAllPatients(patientsRes.patients)
      if (logsRes?.logs) setSqlLogs(logsRes.logs)
    } catch (err) {
      console.error("Failed to load MySQL database state:", err)
    }
  }

  useEffect(() => {
    fetchDbData()
    // Periodic refresh of logs and status every 6 seconds
    const interval = setInterval(fetchDbData, 6000)
    return () => clearInterval(interval)
  }, [])

  // When active patient changes, fetch their specific consultation history
  useEffect(() => {
    if (activePatient?.patient_uid) {
      fetch(`/api/database/patient/${activePatient.patient_uid}`)
        .then(r => r.json())
        .then(data => {
          if (data?.consultations) setPatientHistory(data.consultations)
        })
        .catch(err => console.error("Error fetching patient history:", err))
    } else {
      setPatientHistory([])
    }
  }, [activePatient])

  // Send message to chatbot API
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || inputMessage).trim()
    if (!query || loading) return

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    setMessages(prev => [...prev, userMsg])
    setInputMessage('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: query,
          session_id: sessionId
        })
      })

      if (!res.ok) throw new Error("Chatbot API server error")
      const data = await res.json()

      const botMsg = {
        id: Date.now() + 1,
        sender: 'bot',
        text: data.reply,
        quickReplies: data.quick_replies || [],
        prediction: data.prediction_result,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }

      setMessages(prev => [...prev, botMsg])

      if (data.active_patient) {
        setActivePatient(data.active_patient)
      } else if (data.session?.state === 'IDLE') {
        setActivePatient(null)
      }

      if (data.recent_sql_logs) {
        setSqlLogs(data.recent_sql_logs)
      }

      // Refresh database records
      fetchDbData()
    } catch (err) {
      console.error("Chatbot processing error:", err)
      setMessages(prev => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: 'bot',
          text: "⚠️ **Connection Error**: Unable to reach backend server. Please verify the API is running.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const handleResetChat = async () => {
    try {
      const res = await fetch('/api/chat/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId })
      })
      const data = await res.json()
      setActivePatient(null)
      setMessages([
        {
          id: Date.now(),
          sender: 'bot',
          text: data.reply || "🔄 Conversation reset. Please enter a patient name to begin.",
          quickReplies: ["Check Eleanor Vance (PT-1001)", "Check Marcus Brody (PT-1002)", "Register New Patient Bruce Wayne"],
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ])
      fetchDbData()
    } catch (err) {
      console.error("Reset chat failed:", err)
    }
  }

  // Quick selection of a patient from the database table
  const selectPatientFromTable = (patient) => {
    handleSendMessage(`Patient ${patient.name}`)
  }

  // Filter patients for directory search
  const filteredPatients = allPatients.filter(p =>
    p.name.toLowerCase().includes(patientSearchQuery.toLowerCase()) ||
    p.patient_uid.toLowerCase().includes(patientSearchQuery.toLowerCase())
  )

  const getRiskColor = (score) => {
    if (score < 30) return 'var(--accent-emerald)'
    if (score < 60) return 'var(--accent-amber)'
    return 'var(--accent-rose)'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      {/* Top Banner: Real-time MySQL Database Status */}
      <div className="card" style={{ padding: '0.85rem 1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid var(--accent-cyan)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            background: 'rgba(8, 145, 178, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--accent-cyan)'
          }}>
            <Database style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Real-Time MySQL Database</span>
              <span style={{
                fontSize: '0.7rem',
                padding: '0.15rem 0.5rem',
                borderRadius: '999px',
                background: dbStatus?.status === 'connected' ? 'rgba(5, 150, 105, 0.15)' : 'rgba(225, 29, 72, 0.15)',
                color: dbStatus?.status === 'connected' ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontWeight: 600
              }}>
                {dbStatus?.status === 'connected' ? '● Connected (v8.0.41)' : '○ Reconnecting'}
              </span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              Host: <code style={{ color: 'var(--accent-cyan)' }}>{dbStatus?.host || 'localhost:3306'}</code> | Schema: <code style={{ color: 'var(--accent-cyan)' }}>{dbStatus?.database || 'aegis_amr_db'}</code> | Patients Registered: <strong>{dbStatus?.patient_count || allPatients.length}</strong>
            </div>
          </div>
        </div>

        {/* Active Patient Pill Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          {activePatient ? (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'rgba(5, 150, 105, 0.1)',
              border: '1px solid rgba(5, 150, 105, 0.3)',
              padding: '0.4rem 0.85rem',
              borderRadius: '8px'
            }}>
              <UserCheck style={{ width: 16, height: 16, color: 'var(--accent-emerald)' }} />
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>ACTIVE EHR PATIENT</div>
                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                  {activePatient.name} <span style={{ color: 'var(--accent-cyan)', fontSize: '0.8rem' }}>({activePatient.patient_uid})</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              background: 'var(--bg-tertiary)',
              padding: '0.4rem 0.85rem',
              borderRadius: '8px',
              fontSize: '0.82rem',
              color: 'var(--text-muted)'
            }}>
              <Search style={{ width: 14, height: 14 }} />
              Awaiting Patient Identification
            </div>
          )}

          <button
            onClick={handleResetChat}
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.75rem', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            title="Reset Chat Session"
          >
            <RefreshCw style={{ width: 14, height: 14 }} /> Reset Session
          </button>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 5fr', gap: '1.5rem', alignItems: 'start' }}>
        
        {/* Left Column: Conversational AI Chatbot */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: '720px', padding: 0, overflow: 'hidden' }}>
          
          {/* Chat Header */}
          <div style={{
            padding: '1rem 1.25rem',
            background: 'var(--bg-secondary)',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                background: 'var(--gradient-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: '0 2px 8px rgba(8, 145, 178, 0.3)'
              }}>
                <Bot style={{ width: 20, height: 20 }} />
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Dr. Aegis AMR AI
                  <Sparkles style={{ width: 14, height: 14, color: 'var(--accent-purple)' }} />
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent-emerald)', display: 'inline-block' }}></span>
                  Real-time EHR Assistant • Connected to MySQL
                </span>
              </div>
            </div>

            {/* Quick action chips */}
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button
                onClick={() => handleSendMessage("Patient Eleanor Vance")}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.25rem 0.5rem',
                  background: 'rgba(8, 145, 178, 0.08)',
                  color: 'var(--accent-cyan)',
                  border: '1px solid rgba(8, 145, 178, 0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Test Returning
              </button>
              <button
                onClick={() => handleSendMessage("New patient Bruce Wayne")}
                style={{
                  fontSize: '0.72rem',
                  padding: '0.25rem 0.5rem',
                  background: 'rgba(124, 58, 237, 0.08)',
                  color: 'var(--accent-purple)',
                  border: '1px solid rgba(124, 58, 237, 0.2)',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                Test New
              </button>
            </div>
          </div>

          {/* Messages Stream */}
          <div style={{
            flex: 1,
            padding: '1.25rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
            background: 'rgba(248, 250, 252, 0.5)'
          }}>
            {messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '100%'
                }}
              >
                <div style={{
                  display: 'flex',
                  gap: '0.6rem',
                  maxWidth: msg.sender === 'user' ? '80%' : '92%',
                  flexDirection: msg.sender === 'user' ? 'row-reverse' : 'row'
                }}>
                  {/* Sender Avatar */}
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: msg.sender === 'user' ? 'var(--accent-cyan)' : 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: msg.sender === 'user' ? '#fff' : 'var(--accent-purple)',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>
                    {msg.sender === 'user' ? <Stethoscope style={{ width: 14, height: 14 }} /> : <Bot style={{ width: 16, height: 16 }} />}
                  </div>

                  {/* Message Bubble */}
                  <div style={{
                    padding: '0.85rem 1.15rem',
                    borderRadius: msg.sender === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                    background: msg.sender === 'user' ? 'var(--gradient-primary)' : 'var(--bg-secondary)',
                    color: msg.sender === 'user' ? '#fff' : 'var(--text-primary)',
                    boxShadow: 'var(--shadow-sm)',
                    border: msg.sender === 'user' ? 'none' : '1px solid var(--border-color)',
                    fontSize: '0.88rem',
                    lineHeight: 1.55,
                    whiteSpace: 'pre-wrap'
                  }}>
                    {/* Render message with bold and code styling */}
                    {msg.text.split('\n').map((line, idx) => {
                      if (line.startsWith('> ⚠️') || line.startsWith('> ℹ️')) {
                        return (
                          <div key={idx} style={{
                            margin: '0.5rem 0',
                            padding: '0.5rem 0.75rem',
                            background: line.includes('CRITICAL') ? 'rgba(225, 29, 72, 0.1)' : 'rgba(217, 119, 6, 0.1)',
                            borderLeft: `3px solid ${line.includes('CRITICAL') ? 'var(--accent-rose)' : 'var(--accent-amber)'}`,
                            borderRadius: '4px',
                            fontWeight: 500,
                            fontSize: '0.84rem'
                          }}>
                            {line.replace(/^>\s*/, '')}
                          </div>
                        )
                      }
                      return <p key={idx} style={{ margin: line ? '0.2rem 0' : '0.4rem 0' }}>{line}</p>
                    })}

                    {/* Render Interactive AMR Prediction Widget if available */}
                    {msg.prediction && (
                      <div style={{
                        marginTop: '1rem',
                        padding: '1rem',
                        background: 'var(--bg-primary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--accent-cyan)' }}>
                            Machine Learning AMR Risk Assessment
                          </span>
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '0.2rem 0.5rem',
                            borderRadius: '999px',
                            background: getRiskColor(msg.prediction.ml.hai_risk_score),
                            color: '#fff'
                          }}>
                            HAI Risk: {msg.prediction.ml.hai_risk_score}%
                          </span>
                        </div>

                        {/* Resistance probabilities bars */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                          {Object.entries(msg.prediction.ml.resistance_probabilities).map(([drug, prob]) => (
                            <div key={drug} style={{ background: 'var(--bg-secondary)', padding: '0.5rem', borderRadius: '6px' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                <span style={{ textTransform: 'capitalize' }}>{drug}</span>
                                <strong style={{ color: prob > 40 ? 'var(--accent-rose)' : 'var(--accent-emerald)' }}>{prob}%</strong>
                              </div>
                              <div style={{ height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(prob, 100)}%`,
                                  background: prob > 40 ? 'var(--accent-rose)' : prob > 20 ? 'var(--accent-amber)' : 'var(--accent-emerald)'
                                }} />
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Recommended Drug Box */}
                        <div style={{
                          marginTop: '0.75rem',
                          padding: '0.65rem 0.85rem',
                          background: 'rgba(8, 145, 178, 0.08)',
                          border: '1px solid rgba(8, 145, 178, 0.25)',
                          borderRadius: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem'
                        }}>
                          <Pill style={{ width: 18, height: 18, color: 'var(--accent-cyan)', flexShrink: 0 }} />
                          <div style={{ fontSize: '0.82rem' }}>
                            <div style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>Recommended Empiric Therapy</div>
                            <strong style={{ color: 'var(--accent-cyan)' }}>
                              {msg.prediction.ml.empiric_recommendation?.recommended_antibiotic}
                            </strong>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Quick Reply Chips */}
                {msg.quickReplies && msg.quickReplies.length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '0.4rem',
                    marginTop: '0.5rem',
                    marginLeft: '2.5rem'
                  }}>
                    {msg.quickReplies.map((reply, rIdx) => (
                      <button
                        key={rIdx}
                        onClick={() => handleSendMessage(reply)}
                        style={{
                          background: 'var(--bg-secondary)',
                          border: '1px solid rgba(8, 145, 178, 0.35)',
                          color: 'var(--accent-cyan)',
                          padding: '0.35rem 0.75rem',
                          borderRadius: '999px',
                          fontSize: '0.78rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          boxShadow: 'var(--shadow-sm)',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(8, 145, 178, 0.1)'
                          e.currentTarget.style.borderColor = 'var(--accent-cyan)'
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                          e.currentTarget.style.borderColor = 'rgba(8, 145, 178, 0.35)'
                        }}
                      >
                        {reply}
                      </button>
                    ))}
                  </div>
                )}

                <span style={{
                  fontSize: '0.7rem',
                  color: 'var(--text-muted)',
                  marginTop: '0.25rem',
                  paddingLeft: msg.sender === 'bot' ? '2.5rem' : 0,
                  paddingRight: msg.sender === 'user' ? '2.5rem' : 0
                }}>
                  {msg.timestamp}
                </span>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                <div style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--accent-purple)'
                }}>
                  <Bot style={{ width: 16, height: 16 }} />
                </div>
                <div style={{
                  padding: '0.75rem 1rem',
                  borderRadius: '14px',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  fontSize: '0.85rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}>
                  <div className="pulse-dot" />
                  Querying MySQL EHR database & executing ML model...
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            style={{
              padding: '0.85rem 1.25rem',
              background: 'var(--bg-secondary)',
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: '0.75rem',
              alignItems: 'center'
            }}
          >
            <input
              type="text"
              className="form-input"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder={
                activePatient
                  ? `Describe symptoms, infection focus, GFR, or hospital days for ${activePatient.name}...`
                  : "Type patient name (e.g. 'Patient Eleanor Vance' or 'New patient David')..."
              }
              style={{ flex: 1, padding: '0.75rem 1rem', fontSize: '0.9rem' }}
            />
            <button
              type="submit"
              disabled={loading || !inputMessage.trim()}
              className="btn btn-primary"
              style={{
                padding: '0.75rem 1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: loading || !inputMessage.trim() ? 0.6 : 1
              }}
            >
              <Send style={{ width: 16, height: 16 }} />
              <span>Send</span>
            </button>
          </form>
        </div>

        {/* Right Column: Real-time MySQL EHR Database Inspector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '720px', overflowY: 'auto' }}>
          
          {/* Active Patient Details Card */}
          {activePatient && (
            <div className="card" style={{ padding: '1.2rem', borderTop: '3px solid var(--accent-emerald)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <UserCheck style={{ width: 18, height: 18, color: 'var(--accent-emerald)' }} />
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Active Verified Patient</h3>
                </div>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  background: 'rgba(5, 150, 105, 0.12)',
                  color: 'var(--accent-emerald)',
                  fontWeight: 600
                }}>
                  {activePatient.patient_uid}
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Full Name:</span>
                  <div style={{ fontWeight: 600 }}>{activePatient.name}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Age / Gender:</span>
                  <div style={{ fontWeight: 600 }}>{activePatient.age} yrs • {activePatient.gender}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Registered Date:</span>
                  <div style={{ fontWeight: 500, fontSize: '0.8rem' }}>{activePatient.created_at || 'Just now'}</div>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>Prior EHR Consultations:</span>
                  <div style={{ fontWeight: 600, color: 'var(--accent-cyan)' }}>{patientHistory.length} recorded</div>
                </div>
              </div>

              {/* Latest Past History Snippet */}
              {patientHistory.length > 0 && (
                <div style={{
                  marginTop: '0.85rem',
                  padding: '0.6rem 0.8rem',
                  background: 'var(--bg-tertiary)',
                  borderRadius: '6px',
                  fontSize: '0.78rem'
                }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                    Most Recent Consultation ({patientHistory[0].created_at})
                  </div>
                  <div>Pathogen: <strong>{patientHistory[0].suspected_pathogen}</strong> | Regimen: <strong>{patientHistory[0].recommended_drug}</strong></div>
                </div>
              )}
            </div>
          )}

          {/* Real-time SQL Query Execution Feed */}
          <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Terminal style={{ width: 16, height: 16, color: 'var(--accent-cyan)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>Real-Time MySQL Query Stream</h3>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-cyan)', background: 'rgba(8, 145, 178, 0.1)', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>
                LIVE FEED
              </span>
            </div>

            <div style={{
              background: '#090d16',
              borderRadius: '8px',
              padding: '0.75rem',
              maxHeight: '220px',
              overflowY: 'auto',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
              fontSize: '0.76rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              {sqlLogs.length === 0 ? (
                <div style={{ color: '#64748b', fontStyle: 'italic' }}>Waiting for database query events...</div>
              ) : (
                sqlLogs.slice(0, 8).map(log => (
                  <div key={log.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <span style={{
                        padding: '0.1rem 0.35rem',
                        borderRadius: '3px',
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: log.query_type === 'SELECT' ? '#0284c7' : log.query_type === 'INSERT' ? '#059669' : '#d97706',
                        color: '#fff'
                      }}>
                        {log.query_type}
                      </span>
                      <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                        {log.duration_ms}ms • {log.executed_at?.split(' ')[1] || ''}
                      </span>
                    </div>
                    <div style={{ color: '#38bdf8', wordBreak: 'break-all' }}>
                      {log.sql_text}
                    </div>
                  </div>
                ))
              )}
              <div ref={sqlEndRef} />
            </div>
          </div>

          {/* MySQL EHR Patient Directory */}
          <div className="card" style={{ padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText style={{ width: 16, height: 16, color: 'var(--accent-purple)' }} />
                <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>EHR Patient Directory</h3>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {allPatients.length} records
              </span>
            </div>

            {/* Quick Search */}
            <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
              <Search style={{ width: 14, height: 14, position: 'absolute', left: '10px', top: '9px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by name or ID..."
                value={patientSearchQuery}
                onChange={(e) => setPatientSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.45rem 0.5rem 0.45rem 2rem',
                  fontSize: '0.8rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  background: 'var(--bg-primary)'
                }}
              />
            </div>

            {/* Patient Table */}
            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '0.45rem 0.6rem' }}>ID</th>
                    <th style={{ padding: '0.45rem 0.6rem' }}>Name</th>
                    <th style={{ padding: '0.45rem 0.6rem' }}>Age</th>
                    <th style={{ padding: '0.45rem 0.6rem' }}>Visits</th>
                    <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPatients.map(p => (
                    <tr
                      key={p.id}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: activePatient?.patient_uid === p.patient_uid ? 'rgba(8, 145, 178, 0.08)' : 'transparent'
                      }}
                    >
                      <td style={{ padding: '0.45rem 0.6rem', fontWeight: 600, color: 'var(--accent-cyan)' }}>
                        {p.patient_uid}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', fontWeight: 500 }}>
                        {p.name}
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', color: 'var(--text-secondary)' }}>
                        {p.age}y
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem' }}>
                        <span style={{
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          background: p.consultation_count > 0 ? 'rgba(5, 150, 105, 0.1)' : 'var(--bg-tertiary)',
                          color: p.consultation_count > 0 ? 'var(--accent-emerald)' : 'var(--text-muted)',
                          fontSize: '0.72rem',
                          fontWeight: 600
                        }}>
                          {p.consultation_count || 0}
                        </span>
                      </td>
                      <td style={{ padding: '0.45rem 0.6rem', textAlign: 'right' }}>
                        <button
                          onClick={() => selectPatientFromTable(p)}
                          style={{
                            padding: '0.2rem 0.5rem',
                            fontSize: '0.72rem',
                            borderRadius: '4px',
                            background: 'var(--accent-cyan)',
                            color: '#fff',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 500
                          }}
                        >
                          Consult
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </div>

    </div>
  )
}
