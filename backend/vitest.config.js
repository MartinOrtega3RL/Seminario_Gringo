import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Los archivos de prueba se llaman *.prueba.js, en castellano como el
    // resto del codigo. Vitest busca *.test.js por omision, asi que se le dice.
    include: ['pruebas/**/*.prueba.js'],
    environment: 'node',
  },
})
