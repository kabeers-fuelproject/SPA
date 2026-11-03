import { useEffect, useState } from 'react'
import { api, getUser } from '../api'
import Complaints from './Complaints'
import PageViewer from './PageViewer'

const NAV = [
  { id: 'welcome', label: 'Welcome', path: 'Welcome.aspx' },
  { id: 'complaints', label: 'Complaint List', path: 'MembersArea/Complaints/ComplaintList.aspx' },
  { id: 'viewer', label: 'Page Viewer', path: null },
]

export default function Dashboard({ onLogout, onSessionExpired }) {
  const [user] = useState(() => getUser() || 'SPA User')
  const [active, setActive] = useState('welcome')
  const [sessionOk, setSessionOk] = useState(null)
  const [pageHtml, setPageHtml] = useState(null)
  const [loadingPage, setLoadingPage] = useState(false)

  useEffect(() => {
    api
      .checkSession()
      .then((d) => setSessionOk(!!d.logged_in))
      .catch(() => {
        setSessionOk(false)
        onSessionExpired()
      })
  }, [onSessionExpired])

  const current = NAV.find((n) => n.id === active)

  useEffect(() => {
    if (!current?.path) return
    let cancelled = false
    setLoadingPage(true)
    fetch(`/api/pages/${current.path}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load page'))))
      .then((d) => {
        if (!cancelled) setPageHtml(d.html)
      })
      .catch(() => !cancelled && setPageHtml(null))
      .finally(() => !cancelled && setLoadingPage(false))
    return () => {
      cancelled = true
    }
  }, [active, current.path])

  return (
    <div className="dash">
      <aside className="sidebar">
        <div className="sidebar-brand">SPA</div>
        <nav>
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${active === n.id ? 'active' : ''}`}
              onClick={() => setActive(n.id)}
            >
              {n.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="dash-main">
        <header className="topbar">
          <h1 className="page-title">{current.label}</h1>
          <div className="topbar-right">
            <span className="session-badge">
              {sessionOk === null ? 'Checking…' : sessionOk ? 'Session OK' : 'Session lost'}
            </span>
            <span className="user-chip">{user}</span>
            <button className="btn-secondary" onClick={onLogout}>
              Logout
            </button>
          </div>
        </header>

        {active === 'complaints' && <Complaints />}
        {active === 'viewer' && <PageViewer />}
        {active === 'welcome' && current.path && (
          <div className="panel">
            {loadingPage && <p className="muted">Loading…</p>}
            {pageHtml ? (
              <iframe
                title="SPA page"
                srcDoc={pageHtml}
                className="page-frame"
                sandbox="allow-same-origin"
              />
            ) : (
              !loadingPage && <p className="muted">No page content.</p>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
