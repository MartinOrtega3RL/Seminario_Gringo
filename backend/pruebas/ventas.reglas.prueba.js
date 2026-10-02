import { describe, it, expect } from 'vitest'
import {
  aCentavos, aPesos, resolverLista, precioSegunLista, calcularTotal,
  admiteAnulacion, cuotasCoherentes, entregaCoherente, formatearComprobante,
} from '../src/modulos/ventas/ventas.reglas.js'

// Estas pruebas no levantan base ni servidor: las reglas son funciones puras.

describe('dinero', () => {
  it('convierte a centavos sin arrastrar error de punto flotante', () => {
    expect(aCentavos('1234.56')).toBe(123456)
    expect(aCentavos(0.1) + aCentavos(0.2)).toBe(30)
  })

  it('formatea siempre con dos decimales', () => {
    expect(aPesos(123456)).toBe('1234.56')
    expect(aPesos(500)).toBe('5.00')
  })
})

describe('RF16.5 - lista de precios segun el cliente', () => {
  const producto = { precioMinorista: '1000.00', precioMayorista: '800.00' }

  it('aplica la mayorista cuando el cliente es mayorista', () => {
    const cliente = { tipoCliente: { listaPrecioAplicable: 'MAYORISTA' } }
    expect(precioSegunLista(producto, resolverLista(cliente))).toBe('800.00')
  })

  it('aplica la minorista cuando el cliente es minorista', () => {
    const cliente = { tipoCliente: { listaPrecioAplicable: 'MINORISTA' } }
    expect(precioSegunLista(producto, resolverLista(cliente))).toBe('1000.00')
  })

  it('aplica la minorista en la venta de mostrador, sin cliente asociado', () => {
    expect(resolverLista(null)).toBe('MINORISTA')
    expect(precioSegunLista(producto, resolverLista(undefined))).toBe('1000.00')
  })
})

describe('total de la venta', () => {
  it('suma cantidades y precios distintos', () => {
    const lineas = [
      { cantidad: 2, precioUnitario: '1500.50' },
      { cantidad: 3, precioUnitario: '200.00' },
    ]
    expect(aPesos(calcularTotal(lineas))).toBe('3601.00')
  })

  it('resuelve la venta de una sola linea', () => {
    expect(aPesos(calcularTotal([{ cantidad: 1, precioUnitario: '999.99' }]))).toBe('999.99')
  })

  it('devuelve cero si no hay lineas', () => {
    expect(calcularTotal([])).toBe(0)
  })
})

describe('RF18.2 - anulacion', () => {
  it('admite anular una venta confirmada', () => {
    expect(admiteAnulacion({ estado: 'CONFIRMADA' }).admite).toBe(true)
  })

  it('no admite anular dos veces la misma venta', () => {
    const resultado = admiteAnulacion({ estado: 'ANULADA' })
    expect(resultado.admite).toBe(false)
    expect(resultado.motivo).toMatch(/ya fue anulada/i)
  })
})

describe('RF16.8 - coherencia de cuotas', () => {
  it('el contado no lleva cuotas', () => {
    expect(cuotasCoherentes({ modalidadPago: 'CONTADO', cantidadCuotas: null })).toBe(true)
    expect(cuotasCoherentes({ modalidadPago: 'CONTADO', cantidadCuotas: 3 })).toBe(false)
  })

  it('la financiacion necesita al menos una cuota', () => {
    expect(cuotasCoherentes({ modalidadPago: 'GO_CUOTAS', cantidadCuotas: 6 })).toBe(true)
    expect(cuotasCoherentes({ modalidadPago: 'GO_CUOTAS', cantidadCuotas: null })).toBe(false)
  })
})

describe('RF17.3 - coherencia de la entrega', () => {
  it('el retiro en el local no necesita domicilio', () => {
    expect(entregaCoherente({ modalidadEntrega: 'RETIRO_LOCAL' })).toBe(true)
  })

  it('el envio a domicilio si lo necesita', () => {
    expect(entregaCoherente({ modalidadEntrega: 'ENVIO_DOMICILIO', domicilioEntrega: '  ' })).toBe(false)
    expect(entregaCoherente({ modalidadEntrega: 'ENVIO_DOMICILIO', domicilioEntrega: 'Av. 25 de Mayo 100' })).toBe(true)
  })
})

describe('numero de comprobante', () => {
  it('se deriva del identificador, con relleno a ocho digitos', () => {
    expect(formatearComprobante(42)).toBe('0001-00000042')
    expect(formatearComprobante(1)).toBe('0001-00000001')
  })

  it('entra en los 20 caracteres que admite la columna', () => {
    expect(formatearComprobante(99_999_999).length).toBeLessThanOrEqual(20)
  })
})
