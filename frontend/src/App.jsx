import { useEffect, useState } from 'react'
import { api } from './api'

const TOWNS = ['Haroonabad', 'Bahawalnagar', 'Chishtian', 'Fortabbas', 'Minchinabad']

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function App() {
  const [sessionValid, setSessionValid] = useState(null)
  const [username, setUsername] = useState('District.bahawalnagar')
  const [password, setPassword] = useState('SPA@1139')
  const [loginError, setLoginError] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('spa_token')
    if (!token) {
      setSessionValid(false)
      return
    }
    api.checkSession()
      .then((d) => {
        if (d.logged_in) setSessionValid(true)
        else {
          localStorage.removeItem('spa_token')
          localStorage.removeItem('spa_user')
          setSessionValid(false)
        }
      })
      .catch(() => {
        localStorage.removeItem('spa_token')
        localStorage.removeItem('spa_user')
        setSessionValid(false)
      })
  }, [])

  async function handleLogin(e) {
    e.preventDefault()
    setLoginError('')
    setLoginLoading(true)
    try {
      const data = await api.login(username, password)
      setSessionValid(true)
    } catch (err) {
      setLoginError(err.message)
    } finally {
      setLoginLoading(false)
    }
  }

  async function handleLogout() {
    await api.logout().catch(() => {})
    setSessionValid(false)
  }

  if (sessionValid === null) {
    return (
      <div className="loader-wrap">
        <div className="loader"></div>
        <span className="loader-text">Loading…</span>
      </div>
    )
  }

  if (!sessionValid) {
    if (loginLoading) {
      return (
        <div className="login-wrap">
          <div className="login-card">
            <div className="loader-wrap" style={{minHeight: 200}}>
              <div className="loader"></div>
              <span className="loader-text">Signing in…</span>
            </div>
          </div>
        </div>
      )
    }
    return (
      <div className="login-wrap">
        <div className="login-card">
          <div className="login-brand">
            <div className="brand-badge">SPA</div>
            <h1>Complaint Portal</h1>
            <p>Sign in to view complaints</p>
          </div>
          {loginError && <div className="alert alert-danger">{loginError}</div>}
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label htmlFor="username">Username</label>
              <input
                id="username"
                type="text"
                value={username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                autoComplete="current-password"
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn-primary" disabled={loginLoading}>
              {loginLoading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return <Complaints onLogout={handleLogout} />
}

function Complaints({ onLogout }) {
  const [state, setState] = useState({ loading: true, error: null, data: null })
  const [search, setSearch] = useState('')
  const [town, setTown] = useState('Haroonabad')
  const [startDate, setStartDate] = useState(today())
  const [endDate, setEndDate] = useState(today())
  const [page, setPage] = useState(1)
  const pageSize = 50

  async function load() {
    setState({ loading: true, error: null, data: null })
    try {
      const data = await api.complaints({ start: startDate, end: endDate })
      setState({ loading: false, error: null, data })
      setPage(1)
    } catch (err) {
      setState({ loading: false, error: err.message, data: null })
    }
  }

  useEffect(() => {
    load()
  }, [])

  if (state.loading) {
    return (
      <div className="page">
        <header className="topbar">
          <div className="topbar-brand">SPA Complaints</div>
<button className="Btn" onClick={onLogout} title="Logout" aria-label="Logout">
              <div className="sign">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <div className="text">Logout</div>
            </button>
        </header>
        <main className="content">
          <div className="loader-wrap content-loader">
            <div className="complaints-loader"></div>
            <span className="loader-text">Fetching complaints…</span>
          </div>
        </main>
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="page">
        <div className="alert alert-danger">{state.error}</div>
        <button className="btn-secondary" onClick={load}>Retry</button>
      </div>
    )
  }

  const { data } = state
  const allRows = data?.rows || []
  const rows = town === 'All' ? allRows : allRows.filter((r) => r.townName === town)
  const filtered = rows.filter((row) =>
    search
      ? Object.values(row).some((v) =>
          String(v).toLowerCase().includes(search.toLowerCase()),
        )
      : true,
  )

  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice((page - 1) * pageSize, page * pageSize)
  const headers = rows.length > 0 ? Object.keys(rows[0]) : []

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-brand">SPA Complaints</div>
        <button className="Btn" onClick={onLogout} title="Logout" aria-label="Logout">
              <div className="sign">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
              </div>
              <div className="text">Logout</div>
            </button>
      </header>

      <main className="content">
        <div className="filters-card">
          <div className="filters-row">
            <div className="filter-group">
              <label>City / Town</label>
              <select value={town} onChange={(e) => { setTown(e.target.value); setPage(1) }}>
                <option value="All">All Cities</option>
                {TOWNS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="filter-group">
              <label>End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className="filter-group search-group">
              <label>Search</label>
              <input
                className="search-input"
                placeholder="Filter rows…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button className="btn-secondary btn-icon" onClick={load} title="Refresh">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10"></polyline>
                <polyline points="1 20 1 14 7 14"></polyline>
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
              </svg>
            </button>
          </div>
          <div className="stats-row">
            <span className="stat">{filtered.length} of {rows.length} records</span>
            <span className="stat">Page {page} of {totalPages || 1}</span>
          </div>
        </div>

        <div className="table-card">
          {filtered.length === 0 ? (
            <div className="empty">No complaint rows found.</div>
          ) : (
            <>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                <tr>
                  <th>Sr</th>
                  {headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
                  </thead>
                  <tbody>
                    {paginated.map((row, i) => (
                      <tr key={i}>
                        <td>{(page - 1) * pageSize + i + 1}</td>
                        {headers.map((h) => (
                          <td key={h}>{row[h] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="pagination">
                <button
                  className="btn-secondary"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ← Prev
                </button>
                <span className="page-info">Page {page} of {totalPages || 1}</span>
                <button
                  className="btn-secondary"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  )
}