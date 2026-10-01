/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin, e.g. https://api.yourdomain.com. Leave empty in dev (Vite proxies /api). */
  readonly VITE_API_URL?: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
