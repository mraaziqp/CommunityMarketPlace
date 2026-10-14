/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Comma-separated emails that are given the ADMIN role when they sign up or
   * sign in. Read at build time and shipped in the public bundle.
   */
  readonly VITE_ADMIN_EMAILS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
