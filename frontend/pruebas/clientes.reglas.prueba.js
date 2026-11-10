import { describe, it, expect } from 'vitest'
import {
  pestanasFichaCliente,
  destinoInicialFicha,
  nombreEquipoHistorial,
} from '../src/modulos/clientes/clientes.reglas.js'

describe('RF14 / RF04.1 - pestanas de la ficha del cliente segun permisos', () => {
  it('el administrador ve las dos pestanas', () => {
    const items = pestanasFichaCliente({ idCliente: 5, verCompras: true, verReparaciones: true })
    expect(items.map((i) => i.clave)).toEqual(['compras', 'reparaciones'])
    expect(items[0].a).toBe('/clientes/5/compras')
    expect(items[1].a).toBe('/clientes/5/reparaciones')
    expect(destinoInicialFicha({ verCompras: true, verReparaciones: true })).toBe('compras')
  })

  it('el vendedor ve solo compras', () => {
    const items = pestanasFichaCliente({ idCliente: 5, verCompras: true, verReparaciones: false })
    expect(items.map((i) => i.clave)).toEqual(['compras'])
    expect(destinoInicialFicha({ verCompras: true, verReparaciones: false })).toBe('compras')
  })

  it('el tecnico ve solo reparaciones', () => {
    const items = pestanasFichaCliente({ idCliente: 5, verCompras: false, verReparaciones: true })
    expect(items.map((i) => i.clave)).toEqual(['reparaciones'])
    expect(destinoInicialFicha({ verCompras: false, verReparaciones: true })).toBe('reparaciones')
  })

  it('sin permisos en ningun modulo no ofrece pestanas ni destino', () => {
    expect(pestanasFichaCliente({ idCliente: 5, verCompras: false, verReparaciones: false })).toEqual([])
    expect(destinoInicialFicha({ verCompras: false, verReparaciones: false })).toBeNull()
  })
})

describe('RF14.2 - nombre del equipo en el historial', () => {
  it('une marca y modelo', () => {
    expect(nombreEquipoHistorial({ marca: 'Samsung', modelo: 'Galaxy A54' })).toBe('Samsung Galaxy A54')
  })

  it('resuelve cuando falta la marca o el equipo', () => {
    expect(nombreEquipoHistorial({ modelo: 'Moto G54' })).toBe('Moto G54')
    expect(nombreEquipoHistorial(null)).toBe('Equipo sin identificar')
  })
})

