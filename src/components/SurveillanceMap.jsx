import React, { useState, useEffect } from 'react'
import { Map, Info, AlertTriangle, TrendingUp } from 'lucide-react'

// Stylized premium country node coordinate grid resembling Europe geography
const COUNTRY_NODES = [
  { id: 'SE', name: 'Sweden', x: 260, y: 40, points: "245,30 275,30 280,110 250,110" },
  { id: 'PL', name: 'Poland', x: 300, y: 150, points: "270,120 330,120 340,175 280,175" },
  { id: 'DE', name: 'Germany', x: 220, y: 160, points: "205,125 260,125 270,195 210,195" },
  { id: 'FR', name: 'France', x: 130, y: 200, points: "115,160 185,160 195,230 125,230" },
  { id: 'ES', name: 'Spain', x: 50, y: 280, points: "45,245 110,245 105,310 40,310" },
  { id: 'IT', name: 'Italy', x: 220, y: 280, points: "200,245 220,245 250,335 225,335" },
  { id: 'RO', name: 'Romania', x: 380, y: 220, points: "350,190 410,190 420,245 360,245" },
  { id: 'GR', name: 'Greece', x: 380, y: 310, points: "355,275 395,275 390,325 350,325" }
]

export default function SurveillanceMap() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState('IT') // Default selected
  const [metric, setMetric] = useState('mrsa') // 'mrsa', 'cre_coli', 'cr_kp', 'abx_consumption'

  useEffect(() => {
    fetch('/api/surveillance/data')
      .then(res => res.json())
      .then(fetchedData => {
        setData(fetchedData)
        setLoading(false)
      })
      .catch(err => {
        console.error("Error loading surveillance data:", err)
        // Static fallback
        setData({
          "SE": { "name": "Sweden", "mrsa": 1.5, "cre_coli": 4.2, "cr_kp": 0.5, "fq_coli": 10.2, "abx_consumption": 10.8, "ipc_score": 92.0 },
          "DE": { "name": "Germany", "mrsa": 7.8, "cre_coli": 8.5, "cr_kp": 1.8, "fq_coli": 15.6, "abx_consumption": 14.2, "ipc_score": 85.5 },
          "FR": { "name": "France", "mrsa": 10.2, "cre_coli": 11.1, "cr_kp": 2.5, "fq_coli": 18.2, "abx_consumption": 18.5, "ipc_score": 83.0 },
          "IT": { "name": "Italy", "mrsa": 29.8, "cre_coli": 15.4, "cr_kp": 26.7, "fq_coli": 28.5, "abx_consumption": 21.4, "ipc_score": 74.0 },
          "GR": { "name": "Greece", "mrsa": 38.2, "cre_coli": 20.1, "cr_kp": 64.7, "fq_coli": 32.4, "abx_consumption": 24.8, "ipc_score": 68.0 },
          "ES": { "name": "Spain", "mrsa": 18.4, "cre_coli": 12.3, "cr_kp": 6.8, "fq_coli": 22.1, "abx_consumption": 19.1, "ipc_score": 81.0 },
          "PL": { "name": "Poland", "mrsa": 15.6, "cre_coli": 10.8, "cr_kp": 18.9, "fq_coli": 24.3, "abx_consumption": 22.1, "ipc_score": 76.5 },
          "RO": { "name": "Romania", "mrsa": 46.5, "cre_coli": 18.5, "cr_kp": 48.2, "fq_coli": 31.0, "abx_consumption": 26.2, "ipc_score": 62.0 }
        })
        setLoading(false)
      })
  }, [])

  const getHeatmapColor = (countryId) => {
    if (!data || !data[countryId]) return 'var(--bg-tertiary)'
    const val = data[countryId][metric]
    
    // Scale colors based on metric range
    let ratio = 0
    if (metric === 'mrsa') ratio = val / 50.0
    else if (metric === 'cre_coli') ratio = val / 25.0
    else if (metric === 'cr_kp') ratio = val / 70.0
    else if (metric === 'abx_consumption') ratio = val / 30.0
    
    ratio = Math.min(1.0, Math.max(0.1, ratio))
    
    // Return a glowing HSL value (Red/Rose for high risk, teal/cyan for low risk)
    return `hsla(${340 - ratio * 160}, 85%, ${40 + ratio * 15}%, 0.7)`
  }

  const getMetricLabel = () => {
    if (metric === 'mrsa') return 'MRSA Resistance Rate (%)'
    if (metric === 'cre_coli') return 'CRE E. coli Resistance Rate (%)'
    if (metric === 'cr_kp') return 'Carbapenem-Resistant K. pneumoniae (%)'
    if (metric === 'abx_consumption') return 'Antibiotic Consumption Index (DDD)'
    return ''
  }

  const activeCountryData = data ? data[selectedId] : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metric selection buttons */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <button
          className={`nav-btn ${metric === 'mrsa' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
          onClick={() => setMetric('mrsa')}
        >
          MRSA resistance
        </button>
        <button
          className={`nav-btn ${metric === 'cre_coli' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
          onClick={() => setMetric('cre_coli')}
        >
          Cephalosporin-Res. E. coli (CRE)
        </button>
        <button
          className={`nav-btn ${metric === 'cr_kp' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
          onClick={() => setMetric('cr_kp')}
        >
          Carbapenem-Res. K. pneumoniae
        </button>
        <button
          className={`nav-btn ${metric === 'abx_consumption' ? 'active' : ''}`}
          style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '0.85rem' }}
          onClick={() => setMetric('abx_consumption')}
        >
          Antibiotic Consumption
        </button>
      </div>

      <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: '7.5fr 4.5fr', gap: '1.5rem' }}>
        
        {/* SVG Map Card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '520px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Map style={{ color: 'var(--accent-cyan)', width: 20, height: 20 }} />
              Regional Epidemiological Grid Map
            </h2>
            <span style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)', fontWeight: '600' }}>
              Viewing: {getMetricLabel()}
            </span>
          </div>

          <div className="map-container">
            <svg viewBox="0 0 500 380" className="svg-map">
              {/* Grid Connection Network lines in the background */}
              <line x1="260" y1="70" x2="235" y2="160" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="235" y1="160" x2="150" y2="195" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="235" y1="160" x2="305" y2="147" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="150" y1="195" x2="75" y2="277" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="235" y1="160" x2="225" y2="290" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="305" y1="147" x2="385" y2="217" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="385" y1="217" x2="372" y2="300" stroke="var(--border-color)" strokeWidth={1} />
              <line x1="225" y1="290" x2="372" y2="300" stroke="var(--border-color)" strokeWidth={1} />

              {/* Country Polygons */}
              {COUNTRY_NODES.map((node) => (
                <g key={node.id}>
                  <polygon
                    points={node.points}
                    className={`map-country ${selectedId === node.id ? 'active' : ''}`}
                    style={{ fill: getHeatmapColor(node.id) }}
                    onClick={() => setSelectedId(node.id)}
                  />
                  {/* Text node label */}
                  <text
                    x={node.x}
                    y={node.y}
                    fill="var(--text-primary)"
                    fontSize={11}
                    fontWeight="700"
                    textAnchor="middle"
                    pointerEvents="none"
                    style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.8))' }}
                  >
                    {node.id}
                  </text>
                </g>
              ))}
            </svg>

            {/* Gradient Legend */}
            <div style={{
              position: 'absolute',
              bottom: '15px',
              right: '15px',
              background: 'var(--bg-secondary)',
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.25rem',
              fontSize: '0.75rem',
              boxShadow: 'var(--shadow-md)'
            }}>
              <span style={{ color: 'var(--text-secondary)', fontWeight: '600' }}>Resistance rate</span>
              <div style={{
                width: '120px',
                height: '8px',
                background: 'linear-gradient(to right, hsla(180, 85%, 45%, 0.7), hsla(100, 85%, 45%, 0.7), hsla(30, 85%, 45%, 0.7), hsla(340, 85%, 45%, 0.7))',
                borderRadius: '4px'
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                <span>&lt; 5% (Low)</span>
                <span>&gt; 50% (High)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Stats Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {loading || !activeCountryData ? (
            <div style={{ margin: 'auto', textAlign: 'center', color: 'var(--text-muted)' }}>
              <span>Loading country surveillance details...</span>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1.35rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🛡️ {activeCountryData.name} Profile
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  ECDC Surveillance Node ID: {selectedId}
                </span>
              </div>

              {/* Metric progress bars list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
                
                {/* MRSA */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '500' }}>MRSA Resistance Rate</span>
                    <span style={{ fontWeight: '700', color: activeCountryData.mrsa > 20 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                      {activeCountryData.mrsa}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${activeCountryData.mrsa}%`,
                      height: '100%',
                      background: activeCountryData.mrsa > 20 ? 'var(--accent-rose)' : 'var(--accent-cyan)'
                    }} />
                  </div>
                </div>

                {/* CRE E. Coli */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '500' }}>Cephalosporin-Res. E. Coli</span>
                    <span style={{ fontWeight: '700', color: activeCountryData.cre_coli > 15 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                      {activeCountryData.cre_coli}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${activeCountryData.cre_coli * 2}%`, // scale for visual representation
                      height: '100%',
                      background: activeCountryData.cre_coli > 15 ? 'var(--accent-rose)' : 'var(--accent-cyan)'
                    }} />
                  </div>
                </div>

                {/* Carbapenem K. Pneumoniae */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '500' }}>Carbapenem-Res. K. pneumoniae</span>
                    <span style={{ fontWeight: '700', color: activeCountryData.cr_kp > 20 ? 'var(--accent-rose)' : 'var(--text-primary)' }}>
                      {activeCountryData.cr_kp}%
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${activeCountryData.cr_kp}%`,
                      height: '100%',
                      background: activeCountryData.cr_kp > 20 ? 'var(--accent-rose)' : 'var(--accent-cyan)'
                    }} />
                  </div>
                </div>

                {/* Antibiotic consumption */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ fontWeight: '500' }}>Antibiotic Consumption</span>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                      {activeCountryData.abx_consumption} DDD
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${(activeCountryData.abx_consumption / 30) * 100}%`,
                      height: '100%',
                      background: 'var(--accent-purple)'
                    }} />
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Defined Daily Doses per 1,000 inhabitants per day.
                  </span>
                </div>
              </div>

              {/* IPC Score Circle */}
              <div style={{
                marginTop: 'auto',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                padding: '1rem',
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: '600' }}>IPC Implementation Score</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>CDC Core practices alignment index</span>
                </div>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: `2px solid ${activeCountryData.ipc_score > 75 ? 'var(--accent-emerald)' : 'var(--accent-amber)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.85rem',
                  fontWeight: '800',
                  color: activeCountryData.ipc_score > 75 ? 'var(--accent-emerald)' : 'var(--accent-amber)'
                }}>
                  {activeCountryData.ipc_score}%
                </div>
              </div>

              {/* Action warnings if high resistance */}
              {activeCountryData.cr_kp > 15 && (
                <div style={{
                  background: 'var(--gradient-alert)',
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  padding: '0.75rem 1rem',
                  borderRadius: '8px',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'flex-start'
                }}>
                  <AlertTriangle style={{ color: 'var(--accent-rose)', width: 22, height: 22, flexShrink: 0 }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-rose)' }}>CRITICAL CRKP SPIKE</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      Infection prevention protocols must mandate strict contact precautions and patient isolation procedures for all transfers.
                    </span>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
