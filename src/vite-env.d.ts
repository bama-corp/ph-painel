/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL da API PH (vazio em local → proxy /api). */
  readonly VITE_PH_API_URL?: string;
  /** Bearer opcional (= PH_API_KEY no servidor). */
  readonly VITE_PH_API_KEY?: string;
  /** Base URL da API Plural (ex.: http://localhost:3001). */
  readonly VITE_PLURAL_API_URL?: string;
  /** Bearer = PH_API_KEY definido no Plural. Visível no browser — só chave de leitura. */
  readonly VITE_PLURAL_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
