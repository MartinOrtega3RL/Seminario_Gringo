import { describe, it, expect } from 'vitest'
import {
  resumirProductosVenta,
  formatearCompraHistorial,
  formatearReparacionHistorial,
} from '../src/modulos/clientes/clientes.reglas.js'

describe('RF14.1 - historial de compras del cliente', () => {
  it('resume una venta de un solo producto o de varios', () => {
    expect(resumirProductosVenta([])).toBeNull()
    expect(resumirProductosVenta([
      { cantidad: 2, producto: { denominacion: 'Funda silicona' } },
    ])).toBe('2 u. · Funda silicona')
    expect(resumirProductosVenta([
      { cantidad: 1, producto: { denominacion: 'Vidrio templado' } },
      { cantidad: 3, producto: { denominacion: 'Cable USB-C' } },
    ])).toBe('4 u. · Vidrio templado y 1 más')
  })

  it('calcula el total sumando recargo en centavos sin error de redondeo', () => {
    const fila = formatearCompraHistorial({
      idVenta: 12,
      fechaHora: '2026-10-20T22:15:00.000Z',
      numeroComprobante: '0001-00000012',
      montoTotal: '15000.10',
      recargoFinanciacion: '2250.20',
      estado: 'CONFIRMADA',
      modalidadPago: 'FINANCIACION_PROPIA',
      cantidadCuotas: 3,
      listaPrecioAplicada: 'MINORISTA',
      pago: { medioPago: { nombre: 'Efectivo' } },
      detalle: [{ cantidad: 1, producto: { denominacion: 'Cargador 20W' } }],
    })

    expect(fila).toEqual({
      idVenta: 12,
      fechaHora: '2026-10-20T22:15:00.000Z',
      numeroComprobante: '0001-00000012',
      total: 17250.3,
      estado: 'CONFIRMADA',
      modalidadPago: 'FINANCIACION_PROPIA',
      cantidadCuotas: 3,
      listaPrecioAplicada: 'MINORISTA',
      medioPago: 'Efectivo',
      resumenProductos: '1 u. · Cargador 20W',
    })
  })

  it('tolera ventas sin pago ni detalle', () => {
    const fila = formatearCompraHistorial({
      idVenta: 1,
      fechaHora: '2026-10-01T10:00:00.000Z',
      numeroComprobante: '0001-00000001',
      montoTotal: '5000.00',
      estado: 'ANULADA',
      modalidadPago: 'CONTADO',
      listaPrecioAplicada: 'MAYORISTA',
    })

    expect(fila.total).toBe(5000)
    expect(fila.medioPago).toBeNull()
    expect(fila.resumenProductos).toBeNull()
  })
})

describe('RF14.2 - historial de reparaciones del cliente', () => {
  it('aplana equipo, estado, total y vencimiento de garantia', () => {
    const fila = formatearReparacionHistorial({
      idOrden: 7,
      numeroOrden: 'OS-000007',
      fechaIngreso: '2026-10-15T14:30:00.000Z',
      fallaDeclarada: 'No carga la bateria',
      montoPresupuestado: '45000.00',
      montoTotal: '51750.00',
      fechaVencGarantia: '2026-11-20',
      fechaEntrega: '2026-10-21T18:00:00.000Z',
      idOrdenAnterior: null,
      dispositivo: {
        imeiSerie: '356789012345678',
        modelo: { denominacion: 'iPhone 13', marca: { nombre: 'Apple' } },
      },
      estado: { codigo: 'ENTREGADO', nombre: 'Entregado', esFinal: 1 },
    })

    expect(fila).toEqual({
      idOrden: 7,
      numeroOrden: 'OS-000007',
      fechaIngreso: '2026-10-15T14:30:00.000Z',
      fallaDeclarada: 'No carga la bateria',
      equipo: {
        marca: 'Apple',
        modelo: 'iPhone 13',
        imeiSerie: '356789012345678',
      },
      estado: {
        codigo: 'ENTREGADO',
        nombre: 'Entregado',
        esFinal: true,
      },
      total: 51750,
      montoPresupuestado: 45000,
      fechaVencGarantia: '2026-11-20',
      fechaEntrega: '2026-10-21T18:00:00.000Z',
      idOrdenAnterior: null,
    })
  })

  it('tolera equipo sin IMEI y orden aun sin entregar', () => {
    const fila = formatearReparacionHistorial({
      idOrden: 8,
      numeroOrden: 'OS-000008',
      fechaIngreso: '2026-10-22T12:00:00.000Z',
      fallaDeclarada: 'Pantalla rota',
      montoPresupuestado: null,
      montoTotal: '0.00',
      fechaVencGarantia: null,
      fechaEntrega: null,
      idOrdenAnterior: 3,
      dispositivo: { imeiSerie: null, modelo: { denominacion: 'Moto G54', marca: { nombre: 'Motorola' } } },
      estado: { codigo: 'RECIBIDO', nombre: 'Recibido', esFinal: 0 },
    })

    expect(fila.equipo.imeiSerie).toBeNull()
    expect(fila.total).toBe(0)
    expect(fila.fechaVencGarantia).toBeNull()
    expect(fila.estado.esFinal).toBe(false)
    expect(fila.idOrdenAnterior).toBe(3)
  })
})

