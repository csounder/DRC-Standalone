/// <reference types="vite/client" />

import type { DrcAPI } from '../preload/index'

declare global {
  interface Window {
    api: DrcAPI
  }
}
