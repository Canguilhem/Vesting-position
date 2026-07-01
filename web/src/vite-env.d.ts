/// <reference types="vite/client" />

import type { Buffer as BufferType } from "buffer";

declare global {
  // eslint-disable-next-line no-var
  var Buffer: typeof BufferType;
}
