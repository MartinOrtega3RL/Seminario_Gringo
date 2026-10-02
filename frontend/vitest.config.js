import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['pruebas/**/*.prueba.js'],
    environment: 'node',
  },
})
