import { useEffect, useState } from 'react'
import { api } from '../api'

const TOWNS = ['Haroonabad', 'Bahawalnagar', 'Chishtian', 'Fortabbas', 'Minchinabad']

function today() {
  return new Date().toISOString().slice(0, 10)
}

export default function Complaints() {
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

  if (state.loading) return <div className="panel loading">Loading complaint list…</div>

  if (state.error) {
    return (
      <div className="panel">
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
    <div className="panel">
      <div className="panel-head">
        <h2>Complaint List</h2>
        <span className="badge">{rows.length} records</span>
      </div>

      <div className="filters">
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
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Search</label>
          <input
            className="search-input"
            placeholder="Filter rows…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button className="btn-secondary" onClick={load}>Apply Filters</button>
      </div>

      {filtered.length === 0 ? (
        <p className="muted">No complaint rows found.</p>
      ) : (
        <>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  {headers.map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paginated.map((row, i) => (
                  <tr key={i}>
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
              Prev
            </button>
            <span>Page {page} of {totalPages}</span>
            <button
              className="btn-secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}