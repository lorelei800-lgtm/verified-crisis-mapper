/**
 * Re:Earth CMS connection config.
 * Values are read from VITE_* env vars (baked in at build time by Vite).
 * To run locally: copy .env.example → .env and fill in your values.
 */
export const CMS = {
  baseUrl: import.meta.env.VITE_CMS_BASE_URL as string | undefined,
  project: import.meta.env.VITE_CMS_PROJECT as string | undefined,
  model:   import.meta.env.VITE_CMS_MODEL   as string | undefined,
  token:   import.meta.env.VITE_CMS_TOKEN   as string | undefined,

  /** True only when all three required read-path vars are present */
  get enabled() {
    return !!(this.baseUrl && this.project && this.model)
  },

  /** True when a write token is also provided */
  get writable() {
    return this.enabled && !!this.token
  },
} as const
