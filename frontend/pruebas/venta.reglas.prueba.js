import { describe, it, expect } from 'vitest'
import { aPesos, listaDelCliente } from '../src/modulos/ventas/ganchos/useVenta.js'

// El gancho es de React, pero las reglas que exporta son puras y se prueban
// sin montar nada.

describe('formato de dinero', () => {
  it('usa el formato argentino, con punto de miles y coma decimal', () => {
    expect(aPesos(2_700_000)).toBe('27.000,00')
    expect(aPesos(500)).toBe('5,00')
  })

  it('siempre muestra dos decimales', () => {
    expect(aPesos(100)).toBe('1,00')
    expect(aPesos(0)).toBe('0,00')
  })
})

describe('RF16.5 - lista de precios en la pantalla de venta', () => {
  it('el cliente mayorista cambia la lista de toda la venta', () => {
    expect(listaDelCliente({ tipoCliente: { listaPrecioAplicable: 'MAYORISTA' } })).toBe('MAYORISTA')
  })

  it('la venta de mostrador va por la minorista', () => {
    expect(listaDelCliente(null)).toBe('MINORISTA')
    expect(listaDelCliente(undefined)).toBe('MINORISTA')
  })
})
