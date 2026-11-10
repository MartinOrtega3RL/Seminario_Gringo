import { describe, it, expect } from 'vitest'
import {
  rangoMesEnCurso,
  rangoValido,
  instanteUtc,
  resumirVentasPeriodo,
  valorizacionVisible,
  resumirServicioPeriodo,
} from '../src/modulos/reportes/reportes.reglas.js'

describe('RF26 - rango del periodo', () => {
  it('toma desde el primer dia del mes en curso hasta hoy en hora local', () => {
    const fecha = new Date(2026, 10, 10, 22, 30) // 10 nov 2026 22:30 local
    expect(rangoMesEnCurso(fecha)).toEqual({
      desde: '2026-11-01',
      hasta: '2026-11-10',
    })
  })

  it('rechaza un rango invertido o incompleto', () => {
    expect(rangoValido({ desde: '2026-11-10', hasta: '2026-11-01' }).valido).toBe(false)
    expect(rangoValido({ desde: '', hasta: '2026-11-01' }).valido).toBe(false)
    expect(rangoValido({ desde: '2026-11-01', hasta: '2026-11-10' }).valido).toBe(true)
  })
})

describe('RF26.1 y RF26.2 - reporte comercial', () => {
  it('resume confirmadas, ticket promedio, anuladas aparte y desgloses', () => {
    const reporte = resumirVentasPeriodo({
      totalesPorEstado: [
        { estado: 'CONFIRMADA', operaciones: '3', importe: '45000.30' },
        { estado: 'ANULADA', operaciones: '1', importe: '12000.00' },
      ],
      porDia: [
        { fecha: '2026-11-01', operaciones: '2', importe: '30000.30' },
        { fecha: '2026-11-02', operaciones: '1', importe: '15000.00' },
      ],
      porMedioPago: [
        { idMedioPago: 1, medioPago: 'Efectivo', operaciones: '2', importe: '25000.30' },
        { idMedioPago: 2, medioPago: 'Mercado Pago', operaciones: '1', importe: '20000.00' },
      ],
    })

    expect(reporte.operaciones).toBe(3)
    expect(reporte.totalVendido).toBe(45000.3)
    expect(reporte.ticketPromedio).toBe(15000.1)
    expect(reporte.anuladas).toEqual({ cantidad: 1, importe: 12000 })
    expect(reporte.porDia).toHaveLength(2)
    expect(reporte.porMedioPago[0]).toEqual({
      idMedioPago: 1,
      medioPago: 'Efectivo',
      operaciones: 2,
      importe: 25000.3,
    })
  })

  it('devuelve ceros sin dividir por cero cuando no hay ventas confirmadas', () => {
    const reporte = resumirVentasPeriodo({
      totalesPorEstado: [{ estado: 'ANULADA', operaciones: '2', importe: '5000.00' }],
      porDia: [],
      porMedioPago: [],
    })

    expect(reporte.operaciones).toBe(0)
    expect(reporte.totalVendido).toBe(0)
    expect(reporte.ticketPromedio).toBe(0)
    expect(reporte.anuladas).toEqual({ cantidad: 2, importe: 5000 })
  })
})

describe('RF27.2 y RF04.2 - valorizacion del inventario', () => {
  const filas = [
    { categoria: 'Fundas', articulos: '5', unidades: '40', valorCosto: '120000.50', valorVenta: '250000.25' },
    { categoria: 'Cargadores', articulos: '3', unidades: '15', valorCosto: '80000.25', valorVenta: '150000.75' },
  ]

  it('el administrador ve valor a costo y a venta, con fila de total', () => {
    const resultado = valorizacionVisible(filas, 'Administrador')

    expect(resultado.incluyeCosto).toBe(true)
    expect(resultado.categorias[0].valorCosto).toBe(120000.5)
    expect(resultado.total).toEqual({
      articulos: 8,
      unidades: 55,
      valorCosto: 200000.75,
      valorVenta: 400001,
    })
  })

  it('cualquier otro perfil no recibe valor_costo ni en filas ni en total', () => {
    const resultado = valorizacionVisible(filas, 'Vendedor')

    expect(resultado.incluyeCosto).toBe(false)
    expect(resultado.categorias[0]).not.toHaveProperty('valorCosto')
    expect(resultado.total).not.toHaveProperty('valorCosto')
    expect(resultado.total).toEqual({
      articulos: 8,
      unidades: 55,
      valorVenta: 400001,
    })
  })
})

describe('RF28 - reporte de servicio tecnico', () => {
  it('resume estados, totales y ordenes no retiradas', () => {
    const resultado = resumirServicioPeriodo({
      porEstado: [
        { codigo: 'RECIBIDO', nombre: 'Recibido', esFinal: 0, cantidad: '2', monto: '0.00' },
        { codigo: 'ENTREGADO', nombre: 'Entregado', esFinal: 1, cantidad: '3', monto: '92000.00' },
      ],
      totales: {
        ingresadas: '5',
        entregadas: '3',
        recargosCobrados: '6000.00',
        montoTotal: '92000.00',
      },
      noRetiradas: [
        {
          idOrden: 4,
          numeroOrden: 'OS-000004',
          cliente: 'Perez Ana',
          telefonoWhatsapp: '3704111222',
          fechaNotificacion: '2026-10-20T15:00:00.000Z',
          diasDesdeNotificacion: '14',
          montoTotal: '30000.00',
          recargoSugerido: '4500.00',
        },
      ],
    })

    expect(resultado.totales).toEqual({
      ingresadas: 5,
      entregadas: 3,
      noRetiradas: 1,
      recargosCobrados: 6000,
      montoTotal: 92000,
    })
    expect(resultado.porEstado[1].esFinal).toBe(true)
    expect(resultado.noRetiradas[0].recargoSugerido).toBe(4500)
  })
})


describe('RF26 / RF28 - limites del periodo en UTC', () => {
  it('el inicio del dia local llega a MySQL como su instante UTC', () => {
    const inicio = new Date(Date.UTC(2026, 9, 1, 3, 0, 0)) // 1 oct 00:00 en UTC-3
    expect(instanteUtc(inicio)).toBe('2026-10-01 03:00:00')
  })
})
