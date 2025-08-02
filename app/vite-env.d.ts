/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REOWN_PROJECT_ID: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID: string;
  readonly ONEINCH_API_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
