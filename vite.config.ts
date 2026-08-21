import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  plugins: [react()],
  // GitHub Pages sirve el sitio en https://<usuario>.github.io/LotesD/, no
  // en la raíz del dominio, así que el build de producción necesita ese
  // prefijo para que index.html referencie sus assets correctamente. En
  // desarrollo local (`npm run dev`) se mantiene '/' de siempre.
  base: command === 'build' ? '/LotesD/' : '/',
}))
