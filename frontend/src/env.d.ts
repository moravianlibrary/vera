/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_API_MODE: "mock" | "live";
  readonly VITE_API_PROXY_TARGET: string;
  readonly VITE_DEFAULT_LOCALE: string;
  readonly VITE_MOCK_USER: "admin" | "curator" | "digitization" | "staff" | "reader" | "no-access";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
