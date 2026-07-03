/// <reference types="vite/client" />

import type { Buffer as BufferType } from "buffer";

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof BufferType;
}
