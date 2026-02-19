import { create } from 'zustand'
import { invoke } from '@tauri-apps/api/core'

export interface LicenseStatus {
  valid: boolean
  expiry_date: string | null
  message: string
  is_cached: boolean
}

interface LicenseState {
  status: LicenseStatus | null
  machineId: string
  loading: boolean
  activating: boolean
  error: string
  // actions
  loadMachineId: () => Promise<void>
  verifyLicense: () => Promise<void>
  activateLicense: (key: string) => Promise<void>
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: null,
  machineId: '',
  loading: true,
  activating: false,
  error: '',

  loadMachineId: async () => {
    try {
      const id = await invoke<string>('get_machine_id')
      set({ machineId: id })
    } catch {
      set({ machineId: '' })
    }
  },

  verifyLicense: async () => {
    set({ loading: true, error: '' })
    try {
      const status = await invoke<LicenseStatus>('verify_license')
      set({ status, loading: false })
    } catch (e) {
      set({
        status: { valid: false, expiry_date: null, message: String(e), is_cached: false },
        loading: false,
        error: String(e),
      })
    }
  },

  activateLicense: async (key: string) => {
    set({ activating: true, error: '' })
    try {
      const status = await invoke<LicenseStatus>('activate_license', { key })
      set({ status, activating: false, error: '' })
    } catch (e) {
      set({ activating: false, error: String(e) })
    }
  },
}))
