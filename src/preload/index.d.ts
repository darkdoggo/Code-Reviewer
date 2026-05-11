import { ElectronAPI } from '@electron-toolkit/preload'
import type { ElectronAPI as AppAPI } from '@shared/types'

declare global {
  interface Window {
    electron: ElectronAPI
    api: AppAPI
  }
}
