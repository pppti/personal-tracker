import { useAuthStore } from '../stores/auth'

const BASE_URL = '/api'

async function request(method, path, body = null) {
  const auth = useAuthStore()
  const headers = { 'Content-Type': 'application/json' }
  if (auth.token) {
    headers['Authorization'] = `Bearer ${auth.token}`
  }

  const opts = { method, headers }
  if (body && method !== 'GET') {
    opts.body = JSON.stringify(body)
  }

  const res = await fetch(`${BASE_URL}${path}`, opts)
  if (res.status === 204) {
    return { data: null, error: null }
  }
  if (res.status === 401) {
    auth.logout()
    return { data: null, error: 'Unauthorized' }
  }
  const json = await res.json()
  if (!res.ok) {
    return { data: null, error: json.detail || 'Request failed' }
  }
  return { data: json, error: null }
}

export function useApi() {
  return {
    get: (path) => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put: (path, body) => request('PUT', path, body),
    delete: (path) => request('DELETE', path),
  }
}
