import React, { useState } from 'react'
import { LayoutDashboard, HeartPulse, Activity, Globe, ClipboardList, Shield } from 'lucide-react'
import Dashboard from './components/Dashboard'
import ClinicalAdvisor from './components/ClinicalAdvisor'
import OutbreakSimulator from './components/OutbreakSimulator'
import SurveillanceMap from './components/SurveillanceMap'
import GuidelineHub from './components/GuidelineHub'

export default function App() {
  const [activeTab, setActiveTab] = useState('advisor')

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard setActiveTab={setActiveTab} />
      case 'advisor':
        return <ClinicalAdvisor />
      case 'simulator':
        return <OutbreakSimulator />
      case 'map':
        return <SurveillanceMap />
      case 'guidelines':
        return <GuidelineHub />
      default:
        return <Dashboard setActiveTab={setActiveTab} />
    }
  }

  const getHeaderTitleAndSubtitle = () => {
    switch (activeTab) {
      case 'dashboard':
        return {
          title: "Executive Surveillance Dashboard",
          subtitle: "Hospital-wide clinical indicators, infection rates, and risk compliance scoring."
        }
      case 'advisor':
        return {
          title: "AI Clinical Decision Chatbot & Real-Time EHR Database",
          subtitle: "Conversational CDSS integrated with real-time MySQL patient records, ID verification, and ML resistance forecasting."
        }
      case 'simulator':
        return {
          title: "Epidemic Outbreak Simulator",
          subtitle: "Real-time compartmental S-C-I-R models forecasting ward infection scenarios."
        }
      case 'map':
        return {
          title: "Geographical AMR surveillance Map",
          subtitle: "ECDC and WHO GLASS datasets illustrating national antibiotic resistance trends."
        }
      case 'guidelines':
        return {
          title: "Infection Prevention & Control Hub",
          subtitle: "WHO and CDC Core Practices compliance checklists and guideline directory."
        }
      default:
        return {
          title: "AegisAMR Control Center",
          subtitle: "AI-driven epidemiological support engine."
        }
    }
  }

  const header = getHeaderTitleAndSubtitle()

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="brand">
          <span className="brand-logo">🛡️</span>
          <span className="brand-name">AegisAMR</span>
        </div>

        <ul className="nav-links">
          <li className="nav-item">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`nav-btn ${activeTab === 'dashboard' ? 'active' : ''}`}
            >
              <LayoutDashboard className="nav-icon" />
              <span>Dashboard</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              onClick={() => setActiveTab('advisor')}
              className={`nav-btn ${activeTab === 'advisor' ? 'active' : ''}`}
            >
              <HeartPulse className="nav-icon" />
              <span>AI Clinical Chatbot</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              onClick={() => setActiveTab('simulator')}
              className={`nav-btn ${activeTab === 'simulator' ? 'active' : ''}`}
            >
              <Activity className="nav-icon" />
              <span>Ward Simulator</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              onClick={() => setActiveTab('map')}
              className={`nav-btn ${activeTab === 'map' ? 'active' : ''}`}
            >
              <Globe className="nav-icon" />
              <span>AMR Hotspot Map</span>
            </button>
          </li>
          <li className="nav-item">
            <button
              onClick={() => setActiveTab('guidelines')}
              className={`nav-btn ${activeTab === 'guidelines' ? 'active' : ''}`}
            >
              <ClipboardList className="nav-icon" />
              <span>Guidelines Hub</span>
            </button>
          </li>
        </ul>

        <div className="sidebar-footer">
          <span>AegisAMR v1.0.0</span>
          <span>Final Year Project</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.5rem', color: 'var(--accent-cyan)' }}>
            <Shield style={{ width: 12, height: 12 }} /> Safe Environment
          </span>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Header bar */}
        <header className="header-panel">
          <div className="header-title">
            <h1>{header.title}</h1>
            <p>{header.subtitle}</p>
          </div>
          
          <div className="header-badge">
            <div className="pulse-dot" />
            <span>Surveillance Engine Online</span>
          </div>
        </header>

        {/* Viewport component */}
        {renderActiveComponent()}
      </main>
    </div>
  )
}
