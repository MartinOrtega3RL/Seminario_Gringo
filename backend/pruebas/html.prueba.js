import { describe, it, expect } from 'vitest'
import { escapar, soloFecha } from '../src/http/html.js'

// Estas pruebas no levantan base ni servidor: son funciones puras.

describe('escapar', () => {
  it('neutraliza el HTML que viene de un nombre o de una falla declarada', () => {
    expect(escapar('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;')
  })

  it('escapa el ampersand primero, para no escapar dos veces lo ya escapado', () => {
    expect(escapar('Perez & Hijos <SRL>')).toBe('Perez &amp; Hijos &lt;SRL&gt;')
  })

  it('escapa las comillas: un nombre no puede cerrar un atributo', () => {
    expect(escapar('"><img src=x onerror=alert(1)>')).toBe('&quot;&gt;&lt;img src=x onerror=alert(1)&gt;')
  })

  it('un valor ausente sale como texto vacio, no como "null" ni "undefined"', () => {
    expect(escapar(null)).toBe('')
    expect(escapar(undefined)).toBe('')
  })

  it('deja pasar los acentos y la enie: son letras, no HTML', () => {
    expect(escapar('Muñoz, José')).toBe('Muñoz, José')
  })
})

describe('soloFecha', () => {
  it('una fecha sin hora no se corre un dia por el huso horario', () => {
    // `new Date("2026-11-01")` es medianoche UTC: en Formosa (UTC-3) daria el 31/10.
    expect(soloFecha('2026-11-01')).toBe('01/11/2026')
    expect(soloFecha('2026-01-01')).toBe('01/01/2026')
  })

  it('una fecha con hora se muestra en hora local', () => {
    const local = new Date(2026, 9, 23, 22, 30)
    expect(soloFecha(local)).toBe('23/10/2026')
  })
})
