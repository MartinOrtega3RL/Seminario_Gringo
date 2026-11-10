import { describe, it, expect } from 'vitest'
import { mesEnCurso, etiquetaPeriodo } from '../src/modulos/reportes/reportes.reglas.js'

describe('RF26 - selector de periodo predeterminado', () => {
  it('toma el mes en curso desde el dia 1 hasta hoy en hora local', () => {
    const hoy = new Date(2026, 10, 10, 23, 15)
    expect(mesEnCurso(hoy)).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-10',
    })
  })

  it('arma la etiqueta legible del periodo para imprimir', () => {
    expect(etiquetaPeriodo('2026-11-01', '2026-11-10')).toBe('Del 01/11/2026 al 10/11/2026')
    expect(etiquetaPeriodo('', '')).toBe('Todo el período')
  })
})

