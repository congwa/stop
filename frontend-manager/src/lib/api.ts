import axios from 'axios'

const BASE = '/admin/api'

let token = localStorage.getItem('admin_jwt') || ''

export function setToken(t: string) {
  token = t
  localStorage.setItem('admin_jwt', t)
}

export function getToken() {
  return token
}

export async function loginWithPrivateKey(privateKey: string): Promise<string> {
  const r = await axios.post('/admin/auth/login', { private_key: privateKey })
  const jwt: string = r.data.token
  setToken(jwt)
  return jwt
}

const client = axios.create({ baseURL: BASE })

client.interceptors.request.use((config) => {
  if (token) config.headers['Authorization'] = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('admin_token')
      token = ''
      window.location.reload()
    }
    return Promise.reject(err)
  }
)

export interface KeyItem {
  id: number
  key_hash: string
  key_type: string
  expiry_date: string
  machine_id: string | null
  activated_at: string | null
  is_revoked: boolean
  note: string | null
  created_at: string
  status: 'activated' | 'unactivated' | 'revoked' | 'expired'
}

export interface KeyListResponse {
  total: number
  page: number
  page_size: number
  items: KeyItem[]
}

export interface Stats {
  total: number
  activated: number
  revoked: number
  expired: number
  today_activated: number
  expiring_soon: number
}

export const api = {
  async getStats(): Promise<Stats> {
    const r = await client.get('/stats')
    return r.data
  },
  async listKeys(params: { page?: number; page_size?: number; status?: string }): Promise<KeyListResponse> {
    const r = await client.get('/keys', { params })
    return r.data
  },
  async generateKeys(body: { key_type: string; count: number; note?: string }): Promise<{ generated: number; keys: string[] }> {
    const r = await client.post('/keys/generate', body)
    return r.data
  },
  async revokeKey(id: number): Promise<void> {
    await client.put(`/keys/${id}/revoke`)
  },
  async deleteKey(id: number): Promise<void> {
    await client.delete(`/keys/${id}`)
  },
}
