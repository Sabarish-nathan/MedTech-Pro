import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { Play, ShieldCheck, ShieldAlert, Sparkles, Sliders, Activity } from 'lucide-react'

export default function OutbreakSimulator() {
  const [params, setParams] = useState({
    ward_type: 'icu',
    hand_hygiene_compliance: 80.0,
    isolation_speed: 2.0,
    cleaning_frequency: 2,
    staff_ratio: 0.5,
    simulation_days: 30
  })

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  const handleInputChange = (name, val) => {
    setParams(prev => ({
      ...prev,
      [name]: val
    }))
  }

  const runSimulation = () => {
    setLoading(true)
    setError(null)

    fetch('/api/simulate/ward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params)
    })
      .then(res => {
        if (!res.ok) throw new Error("Simulation endpoint error")
        return res.json()
      })
      .then(data => {
        setResults(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Simulation run failed:", err)
        setError("Failed to connect to simulation engine on the server.")
        setLoading(false)
      })
  }

  // Auto-run simulation on mount
  useEffect(() => {
    runSimulation()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: '4.5fr 7.5fr', gap: '1.5rem' }}>
        
        {/* Controls Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sliders style={{ color: 'var(--accent-cyan)', width: 20, height: 20 }} />
            Ward Environment Controls
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div className="form-group">
              <label className="form-label">Active Ward Unit</label>
              <select
                value={params.ward_type}
                onChange={(e) => handleInputChange('ward_type', e.target.value)}
                className="form-select"
              >
                <option value="icu">Intensive Care Unit (ICU) - 20 Bed Cap</option>
                <option value="surgery">Surgical Ward - 30 Bed Cap</option>
                <option value="general_medicine">General Medicine Ward - 50 Bed Cap</option>
              </select>
            </div>

            {/* Hand Hygiene */}
            <div className="slider-group">
              <div className="slider-header">
                <label className="form-label">Hand Hygiene Compliance</label>
                <span className="slider-val">{params.hand_hygiene_compliance}%</span>
              </div>
              <input
                type="range"
                min="10"
                max="100"
                value={params.hand_hygiene_compliance}
                onChange={(e) => handleInputChange('hand_hygiene_compliance', parseFloat(e.target.value))}
                className="slider-input"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                CDC standard: &gt;90% optimal compliance
              </span>
            </div>

            {/* Isolation Speed */}
            <div className="slider-group">
              <div className="slider-header">
                <label className="form-label">Mean Patient Isolation Speed</label>
                <span className="slider-val">{params.isolation_speed} days</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="7.0"
                step="0.5"
                value={params.isolation_speed}
                onChange={(e) => handleInputChange('isolation_speed', parseFloat(e.target.value))}
                className="slider-input"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Average days to isolate asymptomatic colonizers.
              </span>
            </div>

            {/* Cleaning Frequency */}
            <div className="slider-group">
              <div className="slider-header">
                <label className="form-label">Environmental Cleaning Frequency</label>
                <span className="slider-val">{params.cleaning_frequency}x / Day</span>
              </div>
              <input
                type="range"
                min="1"
                max="4"
                value={params.cleaning_frequency}
                onChange={(e) => handleInputChange('cleaning_frequency', parseInt(e.target.value))}
                className="slider-input"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Rounds of room-wide sanitization.
              </span>
            </div>

            {/* Staff to Patient Ratio */}
            <div className="slider-group">
              <div className="slider-header">
                <label className="form-label">Staff-to-Patient Ratio</label>
                <span className="slider-val">1 : {Math.round(1 / params.staff_ratio)} patients</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={params.staff_ratio}
                onChange={(e) => handleInputChange('staff_ratio', parseFloat(e.target.value))}
                className="slider-input"
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Lower ratio causes workload fatigue & drops compliance metrics.
              </span>
            </div>

            <button
              onClick={runSimulation}
              className="btn-primary"
              style={{ width: '100%', marginTop: '0.5rem' }}
              disabled={loading}
            >
              {loading ? (
                <span>Simulating...</span>
              ) : (
                <>
                  <Play style={{ width: 16, height: 16 }} />
                  Run Scenario Simulation
                </>
              )}
            </button>
          </div>
        </div>

        {/* Visualisation Chart Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '520px' }}>
          
          {error && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--accent-rose)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldAlert style={{ width: 48, height: 48 }} />
              <h3>Simulation Connection Issue</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{error}</p>
            </div>
          )}

          {!results && !error && (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span>Loading Compartmental Simulation Engine...</span>
            </div>
          )}

          {results && !error && (
            <>
              {/* Simulation Header Stat Badges */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>Infection Spread Modeling (30 Days)</h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    SCIR Differential Model: Susceptible, Colonized, Infected, Isolated
                  </p>
                </div>
                
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: '600' }}>OUTBREAK STATUS</span>
                    {results.active_outbreak_warning ? (
                      <span style={{ color: 'var(--accent-rose)', fontWeight: '800', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldAlert style={{ width: 14, height: 14 }} /> OUTBREAK ALARM
                      </span>
                    ) : (
                      <span style={{ color: 'var(--accent-emerald)', fontWeight: '800', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <ShieldCheck style={{ width: 14, height: 14 }} /> SAFE WARD
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chart Plot */}
              <div style={{ width: '100%', height: '320px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '1rem 0.5rem 0.5rem 0' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={results.daily_history}
                    margin={{ top: 5, right: 20, left: -10, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={11} />
                    <YAxis stroke="var(--text-muted)" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderColor: 'var(--border-color)',
                        borderRadius: '8px',
                        color: 'var(--text-primary)',
                        fontSize: '0.85rem'
                      }}
                    />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8rem' }} />
                    <Line type="monotone" dataKey="susceptible" stroke="var(--accent-blue)" strokeWidth={2} name="Susceptible" dot={false} />
                    <Line type="monotone" dataKey="colonized" stroke="var(--accent-purple)" strokeWidth={2} name="Colonized (Asymptomatic)" dot={false} />
                    <Line type="monotone" dataKey="infected" stroke="var(--accent-rose)" strokeWidth={2} name="Infected (Symptomatic)" dot={false} />
                    <Line type="monotone" dataKey="isolated_recovered" stroke="var(--accent-emerald)" strokeWidth={2} name="Isolated / Recovered" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Bottom statistics summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Peak Active Infections</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: results.peak_infection_count > 3 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                    {results.peak_infection_count} patients
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total New Infections</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--accent-cyan)' }}>
                    {results.total_new_infections} cases
                  </div>
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', padding: '0.75rem', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Policy Compliance Alert</span>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: params.hand_hygiene_compliance > 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)' }}>
                    {params.hand_hygiene_compliance > 80 ? 'Satisfied' : 'Low Compliance'}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'rgba(6, 182, 212, 0.03)', border: '1px dashed var(--border-glow)', padding: '0.75rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles style={{ color: 'var(--accent-cyan)', width: 16, height: 16 }} />
                <span>
                  <strong>Stewardship Insight:</strong> Raising hand hygiene compliance to 90% and maintaining room sanitization at 3x daily projected to reduce peak active infections by <strong>45%</strong>.
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
