import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,

    /*
     * El frontend pide a rutas relativas (/api/properties), igual que
     * en produccion. Este proxy hace que en desarrollo terminen en el
     * backend sin que el navegador las vea como cross-origin.
     *
     * Asi el codigo del cliente es el mismo en los dos entornos: no
     * hay una URL hardcodeada que funciona en local y se rompe al
     * desplegar, ni CORS que se pruebe solo en un entorno.
     *
     * El destino se lee de VITE_API_URL para no repetir el puerto del
     * backend en dos archivos.
     */
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL ?? 'http://127.0.0.1:8001',
        changeOrigin: true,
      },
    },
  },
});
