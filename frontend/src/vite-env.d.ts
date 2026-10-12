/// <reference types="vite/client" />

/**
 * Variables de entorno del frontend.
 *
 * VITE_API_BASE apunta al backend en desarrollo. En produccion queda
 * vacio y el frontend usa rutas relativas: mismo origen, sin CORS.
 */

interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
