import { describe, it, expect } from 'vitest'
import { nombreVisible, listaDelCliente, normalizarContacto, documentoCompleto }
  from '../src/modulos/clientes/clientes.reglas.js'

describe('RF16.5 - lista segun la clasificacion del cliente', () => {
  it('el mayorista toma la lista mayorista', () => {
    expect(listaDelCliente({ tipoCliente: { listaPrecioAplicable: 'MAYORISTA' } })).toBe('MAYORISTA')
  })

  it('sin cliente asociado rige la minorista', () => {
    expect(listaDelCliente(null)).toBe('MINORISTA')
    expect(listaDelCliente({})).toBe('MINORISTA')
  })
})

describe('nombre para mostrar', () => {
  it('sale de persona, que es donde vive la identidad', () => {
    expect(nombreVisible({ persona: { apellidoNombre: 'Britez Juan' } })).toBe('Britez Juan')
  })

  it('no deja la pantalla en blanco cuando falta', () => {
    expect(nombreVisible({ persona: { apellidoNombre: '   ' } })).toBe('Sin nombre')
    expect(nombreVisible(null)).toBe('Sin nombre')
  })
})

describe('H11 - contacto de WhatsApp', () => {
  it('deja solo digitos y el mas', () => {
    expect(normalizarContacto('(370) 415-2233')).toBe('3704152233')
    expect(normalizarContacto('+54 9 370 4152233')).toBe('+5493704152233')
  })

  it('devuelve null cuando no queda nada', () => {
    expect(normalizarContacto('   ')).toBeNull()
    expect(normalizarContacto(null)).toBeNull()
  })
})

describe('documento', () => {
  it('acepta que no haya documento', () => {
    expect(documentoCompleto({})).toBe(true)
  })

  it('acepta el par completo', () => {
    expect(documentoCompleto({ tipoDocumento: 'DNI', numeroDocumento: '30123456' })).toBe(true)
  })

  it('rechaza la mitad: la base tiene UNIQUE sobre el par', () => {
    expect(documentoCompleto({ numeroDocumento: '30123456' })).toBe(false)
    expect(documentoCompleto({ tipoDocumento: 'DNI' })).toBe(false)
  })
})
