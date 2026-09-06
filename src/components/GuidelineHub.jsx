import React, { useState } from 'react'
import { Check, ClipboardList, BookOpen, Search, Sparkles } from 'lucide-react'

const GUIDELINE_CATEGORIES = [
  { id: 'standard', name: 'Standard Precautions' },
  { id: 'transmission', name: 'Transmission-Based isolation' },
  { id: 'stewardship', name: 'Antibiotic Stewardship' }
]

const INITIAL_CHECKLIST = [
  { id: 1, category: 'standard', title: 'Hand Hygiene Compliance', desc: 'Perform hand rub with alcohol-based agent before patient contact, and wash with soap and water after blood/body fluid exposure.', checked: false },
  { id: 2, category: 'standard', title: 'Personal Protective Equipment (PPE)', desc: 'Select gloves, gowns, and face shields based on potential fluid splash exposure. Don before entry, doff before exit.', checked: false },
  { id: 3, category: 'standard', title: 'Safe Injection Practices', desc: 'Use aseptic techniques for preparation, single-use syringes/needles, and discard immediately in puncture-proof sharps boxes.', checked: false },
  { id: 4, category: 'transmission', title: 'Contact Precautions Posting', desc: 'For confirmed MRSA or Carbapenem-resistant infections, place sign on door, wear gowns/gloves for all room entries.', checked: false },
  { id: 5, category: 'transmission', title: 'Cohort Isolation & Equipment Dedicated', desc: 'Use single room or cohort patients with same organism. Dedicate non-critical equipment (e.g. stethoscopes) to room.', checked: false },
  { id: 6, category: 'stewardship', title: 'Empiric Therapy Review (48h/72h)', desc: 'Re-assess antibiotics upon culture availability. De-escalate to narrower-spectrum agents when susceptibility is confirmed.', checked: false },
  { id: 7, category: 'stewardship', title: 'Renal Dose Adjustments Check', desc: 'Calculate patient glomerular filtration rate (GFR) prior to aminoglycoside, glycopeptide, or beta-lactam prescribing.', checked: false },
  { id: 8, category: 'stewardship', title: 'Device-Associated Prevention Bundle', desc: 'Assert daily checklist compliance for Central Line-Associated Bloodstream Infection (CLABSI) and Urinary Catheter maintenance.', checked: false }
]

export default function GuidelineHub() {
  const [activeCat, setActiveCat] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [checklist, setChecklist] = useState(INITIAL_CHECKLIST)

  const toggleCheck = (id) => {
    setChecklist(prev => prev.map(item =>
      item.id === id ? { ...item, checked: !item.checked } : item
    ))
  }

  const getFilteredItems = () => {
    return checklist.filter(item => {
      const matchCat = activeCat === 'all' || item.category === activeCat
      const matchSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          item.desc.toLowerCase().includes(searchQuery.toLowerCase())
      return matchCat && matchSearch
    })
  }

  const getCompliancePercentage = () => {
    const checkedCount = checklist.filter(item => item.checked).length
    return Math.round((checkedCount / checklist.length) * 100)
  }

  const compliance = getCompliancePercentage()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Search and Category bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            className={`nav-btn ${activeCat === 'all' ? 'active' : ''}`}
            style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            onClick={() => setActiveCat('all')}
          >
            All Areas
          </button>
          {GUIDELINE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              className={`nav-btn ${activeCat === cat.id ? 'active' : ''}`}
              style={{ width: 'auto', padding: '0.5rem 1rem', fontSize: '0.85rem' }}
              onClick={() => setActiveCat(cat.id)}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div style={{ position: 'relative', width: '280px' }}>
          <input
            type="text"
            placeholder="Search guidelines..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="form-input"
            style={{ width: '100%', paddingLeft: '2.5rem' }}
          />
          <Search style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, color: 'var(--text-muted)' }} />
        </div>
      </div>

      {/* Grid: Checklist on left, Score Card on right */}
      <div className="grid-container" style={{ display: 'grid', gridTemplateColumns: '7.5fr 4.5fr', gap: '1.5rem' }}>
        
        {/* Checklist Card */}
        <div className="card">
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ClipboardList style={{ color: 'var(--accent-cyan)', width: 20, height: 20 }} />
            Safety & Infection Prevention Checklists
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {getFilteredItems().length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                No guidelines found matching your filter criteria.
              </div>
            ) : (
              getFilteredItems().map(item => (
                <div
                  key={item.id}
                  onClick={() => toggleCheck(item.id)}
                  className={`checklist-item ${item.checked ? 'checked' : ''}`}
                >
                  {/* Custom Checkbox circle */}
                  <div style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    border: `2px solid ${item.checked ? 'var(--accent-emerald)' : 'var(--border-color)'}`,
                    background: item.checked ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'var(--transition-smooth)'
                  }}>
                    {item.checked && <Check style={{ width: 14, height: 14, color: 'var(--accent-emerald)', strokeWidth: 3 }} />}
                  </div>

                  <div className="checklist-content">
                    <span className={`checklist-title ${item.checked ? 'checked' : ''}`}>
                      {item.title}
                    </span>
                    <span className="checklist-desc">{item.desc}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Score & WHO/CDC Hub Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', justifyContent: 'space-between' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <h3 style={{ fontSize: '1.2rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen style={{ color: 'var(--accent-cyan)', width: 20, height: 20 }} />
              Safety Compliance Score
            </h3>
            
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Evaluate shift compliance by checking the active clinical protocols completed by ward staff.
            </p>

            <div className="progress-ring-container">
              {/* Radial Score Gauge */}
              <div style={{
                position: 'relative',
                width: '130px',
                height: '130px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '50%',
                background: 'var(--bg-tertiary)',
                border: '2px solid var(--border-color)',
                boxShadow: 'inset 0 0 10px rgba(0,0,0,0.06)'
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <span style={{
                    fontSize: '2.5rem',
                    fontFamily: 'var(--font-display)',
                    fontWeight: '800',
                    color: compliance === 100 ? 'var(--accent-emerald)' : (compliance > 60 ? 'var(--accent-cyan)' : 'var(--accent-rose)')
                  }}>
                    {compliance}%
                  </span>
                  <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase' }}>
                    Compliance
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{
            background: 'rgba(6, 182, 212, 0.03)',
            border: '1px solid rgba(6, 182, 212, 0.15)',
            padding: '1rem',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--accent-cyan)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Sparkles style={{ width: 14, height: 14 }} /> CDC CORE PRACTICE ALIGNMENT
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {compliance === 100 
                ? "Perfect alignment achieved. Current ward policies fully meet standard and transmission isolation practices."
                : `Complete ${checklist.filter(i => !i.checked).length} more safety task(s) to hit target compliance levels.`
              }
            </span>
          </div>

          <div style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            padding: '1rem',
            borderRadius: '12px',
            fontSize: '0.8rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem'
          }}>
            <span style={{ fontWeight: '600' }}>Reference Resource Directory</span>
            <a href="https://www.who.int/initiatives/glass" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              &rarr; WHO GLASS Initiative
            </a>
            <a href="https://www.cdc.gov/healthcare-associated-infections/php/data/index.html" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              &rarr; CDC Healthcare-Associated Infections Portal
            </a>
            <a href="https://www.ecdc.europa.eu/en/publications-data/directory-guidance-prevention-and-control/core-requirements-healthcare-settings" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>
              &rarr; ECDC Core Requirements Directory
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
