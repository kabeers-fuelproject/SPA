const TOKEN_KEY = 'spa_token'
const USER_KEY = 'spa_user'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function getUser() {
  return localStorage.getItem(USER_KEY)
}

export function saveSession(token, username) {
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(USER_KEY, username)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) }
  if (options.body) headers['Content-Type'] = 'application/json'

  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(path, { ...options, headers })
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    if (res.status === 401 && getToken()) {
      // session expired server-side: drop it
      clearSession()
    }
    const detail =
      data?.detail || data?.message || `Request failed (${res.status})`
    throw new Error(detail)
  }
  return data
}

export const api = {
  login: async (username, password) => {
    const data = await request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    saveSession(data.token, data.username)
    return data
  },

  checkSession: () => request('/api/session/check'),
  cookies: () => request('/api/session/cookies'),
  logout: async () => {
    try {
      await request('/api/logout', { method: 'POST' })
    } finally {
      clearSession()
    }
  },
  fetchPage: (path) => request(`/api/pages/${path.replace(/^\//, '')}`),
  complaints: (params = {}) => {
    const query = new URLSearchParams()
    if (params.start) {
      const [y, m, d] = params.start.split('-')
      query.set('start', `${m}/${d}/${y}`)
    }
    if (params.end) {
      const [y, m, d] = params.end.split('-')
      query.set('end', `${m}/${d}/${y}`)
    }
    if (params.town) query.set('town', params.town)
    if (params.zone) query.set('zone', params.zone)
    if (params.status) query.set('status', params.status)
    if (params.category) query.set('category', params.category)
    return request(`/api/complaints-data?${query.toString()}`)
  },
}
