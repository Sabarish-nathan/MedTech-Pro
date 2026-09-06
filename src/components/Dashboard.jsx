import React, { useState, useEffect } from 'react'
import { Activity, ShieldAlert, Heart, ClipboardCheck, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react'

export default function Dashboard({ setActiveTab }) {
  const [wardData, setWardData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/ward/metrics')
      .then(res => res.json())
      .then(data => {
        setWardData(data)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error fetching ward metrics:", err)
        // Static fallback if API is not fully up yet
        setWardData({
          "icu": { "active_patients": 18, "beds_capacity": 20, "hand_hygiene_compliance": 82.5, "clabsi_rate": 1.2, "cdiff_cases_last_month": 3, "antibiotic_usage_index": 780 },
          "general_medicine": { "active_patients": 42, "beds_capacity": 45, "hand_hygiene_compliance": 75.0, "clabsi_rate": 0.4, "cdiff_cases_last_month": 5, "antibiotic_usage_index": 420 },
          "surgery": { "active_patients": 26, "beds_capacity": 30, "hand_hygiene_compliance": 88.0, "clabsi_rate": 0.8, "cdiff_cases_last_month": 2, "antibiotic_usage_index": 590 }
        })
        setLoading(false)
      })
  }, [])

  const getTotalPatients = () => {
    if (!wardData) return 0
    return Object.values(wardData).reduce((sum, w) => sum + w.active_patients, 0)
  }

  const getAvgHygiene = () => {
    if (!wardData) return 0
    const vals = Object.values(wardData).map(w => w.hand_hygiene_compliance)
    return (vals.reduce((sum, v) => sum + v, 0) / vals.length).toFixed(1)
  }

  const getTotalCdiff = () => {
    if (!wardData) return 0
    return Object.values(wardData).reduce((sum, w) => sum + w.cdiff_cases_last_month, 0)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      {/* KPI Cards Row */}
      <div className="dashboard-kpis">
        <div className="card kpi-card card-glowing">
          <div className="kpi-icon-container" style={{ color: 'var(--accent-cyan)' }}>
            <Activity className="nav-icon" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Active Surveillance</span>
            <span className="kpi-value">{loading ? '...' : getTotalPatients()} patients</span>
            <span className="kpi-trend trend-down">
              <TrendingUp className="nav-icon" style={{ transform: 'rotate(180deg)', width: 14, height: 14 }} /> -2% from last week
            </span>
          </div>
        </div>

        <div className="card kpi-card card-glowing">
          <div className="kpi-icon-container" style={{ color: 'var(--accent-purple)' }}>
            <ShieldAlert className="nav-icon" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">Critical Outbreaks</span>
            <span className="kpi-value">0 Active</span>
            <span className="kpi-trend trend-down" style={{ color: 'var(--accent-emerald)' }}>
              Normal threshold
            </span>
          </div>
        </div>

        <div className="card kpi-card card-glowing">
          <div className="kpi-icon-container" style={{ color: 'var(--accent-emerald)' }}>
            <ClipboardCheck className="nav-icon" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">IPC Safety Index</span>
            <span className="kpi-value">{loading ? '...' : getAvgHygiene()}%</span>
            <span className="kpi-trend trend-up" style={{ color: 'var(--accent-emerald)' }}>
              +1.5% compliance
            </span>
          </div>
        </div>

        <div className="card kpi-card card-glowing">
          <div className="kpi-icon-container" style={{ color: 'var(--accent-rose)' }}>
            <Heart className="nav-icon" />
          </div>
          <div className="kpi-info">
            <span className="kpi-label">HAIs (C. diff / Month)</span>
            <span className="kpi-value">{loading ? '...' : getTotalCdiff()} cases</span>
            <span className="kpi-trend trend-up">
              +1 case rise
            </span>
          </div>
        </div>
      </div>

      {/* Main Grid Section */}
      <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: '1.5rem' }}>
        {/* Ward Surveillance List */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity style={{ color: 'var(--accent-cyan)', width: 20, height: 20 }} />
            Ward-Level Clinical Surveillance Metrics
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Active monitors of hospital units, evaluating antibiotic load, patient density, and key Infection Prevention and Control (IPC) parameters.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Ward name</th>
                  <th>Occupancy</th>
                  <th>Hygiene compliance</th>
                  <th>CLABSI rate</th>
                  <th>Abx index (DDD)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '2rem' }}>Loading surveillance metrics...</td>
                  </tr>
                ) : (
                  Object.entries(wardData).map(([key, ward]) => (
                    <tr key={key}>
                      <td style={{ fontWeight: '600', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span>{ward.active_patients} / {ward.beds_capacity} Beds</span>
                          <div style={{ width: '100px', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${(ward.active_patients / ward.beds_capacity) * 100}%`,
                              height: '100%',
                              background: 'var(--gradient-primary)'
                            }} />
                          </div>
                        </div>
                      </td>
                      <td style={{
                        color: ward.hand_hygiene_compliance >= 80 ? 'var(--accent-emerald)' : 'var(--accent-amber)',
                        fontWeight: '600'
                      }}>
                        {ward.hand_hygiene_compliance}%
                      </td>
                      <td>{ward.clabsi_rate} / 1K days</td>
                      <td style={{ fontWeight: '500' }}>{ward.antibiotic_usage_index}</td>
                      <td>
                        <button
                          className="nav-btn"
                          style={{
                            padding: '0.4rem 0.8rem',
                            fontSize: '0.8rem',
                            border: '1px solid var(--border-color)',
                            backgroundColor: 'rgba(255,255,255,0.02)',
                            width: 'auto'
                          }}
                          onClick={() => setActiveTab('simulator')}
                        >
                          Simulate
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Alerts and Insights */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle style={{ color: 'var(--accent-rose)', width: 20, height: 20 }} />
            Active Warning Stream
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{
              background: 'var(--gradient-alert)',
              borderLeft: '4px solid var(--accent-rose)',
              padding: '0.75rem 1rem',
              borderRadius: '0 12px 12px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-rose)', fontWeight: '700' }}>CRITICAL SURVEILLANCE ALERT</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Carbapenem-Resistant Klebsiella spikes detected in Southern EU (ECDC surveillance node IT/GR).</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>10 minutes ago</span>
            </div>

            <div style={{
              background: 'rgba(245, 158, 11, 0.05)',
              borderLeft: '4px solid var(--accent-amber)',
              padding: '0.75rem 1rem',
              borderRadius: '0 12px 12px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-amber)', fontWeight: '700' }}>WARD HYGIENE DEVIATION</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>General Medicine hygiene compliance dropped below 75% threshold. Outbreak risk elevated.</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>2 hours ago</span>
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.05)',
              borderLeft: '4px solid var(--accent-emerald)',
              padding: '0.75rem 1rem',
              borderRadius: '0 12px 12px 0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem'
            }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent-emerald)', fontWeight: '700' }}>STEWARDSHIP PROGRAM</span>
              <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>Surgical unit achieved 88% compliance on surgical site infection checklists.</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Yesterday</span>
            </div>
          </div>

          <div style={{
            marginTop: 'auto',
            background: 'rgba(6, 182, 212, 0.05)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
            padding: '1rem',
            borderRadius: '12px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            alignItems: 'center'
          }}>
            <Sparkles style={{ color: 'var(--accent-cyan)', width: 24, height: 24 }} />
            <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>AI Decision Recommendation</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Run the Ward Simulator to test isolation protocol impact on the general medicine ward.
            </span>
            <button
              className="btn-primary"
              style={{ padding: '0.4rem 1rem', fontSize: '0.8rem', width: '100%', marginTop: '0.25rem' }}
              onClick={() => setActiveTab('simulator')}
            >
              Configure simulation
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
