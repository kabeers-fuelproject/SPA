import { useState } from 'react'

export default function PageViewer() {
  const [path, setPath] = useState('Welcome.aspx')
  const [state, setState] = useState({ loading: false, error: null, page: null })

  async function load(p) {
    setState({ loading: true, error: null, page: null })
    try {
      const res = await fetch(`/api/pages/${p.replace(/^\//, '')}`)
      if (res.status === 401) throw new Error('Session expired. Please log in again.')
      const data = await res.json()
      if (!res.ok) throw new Error(data.detail || `Request failed (${res.status})`)
      setState({ loading: false, error: null, page: data })
    } catch (err) {
      setState({ loading: false, error: err.message, page: null })
    }
  }

  const { loading, error, page } = state

  return (
    <div className="panel">
      <h2>Page Viewer</h2>
      <p className="muted">
        Fetch any authenticated SPA page through the backend, e.g.{' '}
        <code>Welcome.aspx</code>.
      </p>
      <form
        className="page-form"
        onSubmit={(e) => {
          e.preventDefault()
          load(path)
        }}
      >
        <input
          value={path}
          onChange={(e) => setPath(e.target.value)}
          placeholder="Welcome.aspx"
        />
        <button className="btn-primary" type="submit" disabled={loading}>
          {loading ? 'Loading…' : 'Fetch'}
        </button>
      </form>

      {error && <div className="alert alert-danger">{error}</div>}

      {page && (
        <div className="page-result">
          <p>
            <strong>{page.title}</strong>
          </p>
          <p className="muted">{page.url}</p>
          {page.tables.map((t, i) =>
            t.rows.length > 0 ? (
              <table key={i} className="data-table">
                <thead>
                  <tr>
                    {t.headers.map((h) => (
                      <th key={h}>{h || '—'}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {t.rows.map((row, j) => (
                    <tr key={j}>
                      {t.headers.map((h) => (
                        <td key={h}>{row[h] ?? ''}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null,
          )}
          <details open>
            <summary>Page text</summary>
            <pre className="page-text">{page.content_text}</pre>
          </details>
        </div>
      )}
    </div>
  )
}
