/// <reference types="vite/client" />

import type { ElectronAPI as AppAPI } from '@shared/types'

declare global {
  interface Window {
    api: AppAPI
  }
}
