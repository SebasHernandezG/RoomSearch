import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    /*
     * Las pruebas viven junto al codigo que prueban, igual que en el
     * backend: src/Properties/Tests/Feature al lado del modulo.
     *
     * No entran al build de produccion porque Vite solo sigue el
     * grafo de imports desde index.html, y las pruebas no se importan
     * desde ahi. Por eso no hace falta ni excluirlas del bundle.
     */
    include: ['src/**/*.test.{ts,tsx}'],

    /*
     * Los .tsx van con la prueba. React necesita el plugin para
     * transformarlos, y sin esto ccesibilidad.test.tsx falla al
     * importar el componente que dice estar probando.
     */

    /*
     * jsdom, no node puro: varias de las funciones tocadas leen
     * `window`. Y leaflet necesita un DOM con medidas.
     */
    environment: 'jsdom',

    /*
     * Matchers de `testing-library` y limpieza del DOM entre pruebas.
     *
     * `setupFiles` y no imports sueltos en cada archivo: `toBeInTheDocument`
     * no existe en Vitest, y una prueba que lo use sin el import no
     * falla en la asercion --falla como "is not a function", que no
     * seÃ±ala el archivo.
     */
    setupFiles: ['./src/test/setup.ts'],

    /*
     * Sin esto, un `expect` mal escrito o sin usar pasa en verde:
     * `expect(true).toBe(true)` que nadie escribio, o una prueba que
     * no afirma nada. Con `globals: false` hay que importar, y una
     * asercion olvidada se ve en la cuenta de pruebas.
     */
    globals: false,

    /*
     * `threads` y no el pool por defecto (`forks`).
     *
     * Con `forks`, el worker nunca levanta y la corrida muere con
     * "Timeout waiting for worker to respond". Passa cuando el repo
     * esta dentro de OneDrive: el proceso hijo no logra arrancar desde
     * una ruta sincronizada.
     *
     * No es un problema de las pruebas, es del pool. `threads` corre
     * en el mismo proceso y no depende de eso. En Linux (CI) los dos
     * funcionan; este es el que funciona en la maquina de desarrollo.
     */
    pool: 'threads',
  },
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
