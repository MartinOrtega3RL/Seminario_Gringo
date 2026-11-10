import { describe, it, expect } from 'vitest'
import {
  siguientesEstadosPedido,
  transicionPedidoPermitida,
  esEstadoFinalPedido,
  evaluarCambioEstadoPedido,
  identificacionValida,
  formatearPedido,
} from '../src/modulos/pedidos/pedidos.reglas.js'

describe('RF19.2 - transiciones de pedidos pendientes', () => {
  it('PENDIENTE pasa a DISPONIBLE o CANCELADO', () => {
    expect(siguientesEstadosPedido('PENDIENTE')).toEqual(['DISPONIBLE', 'CANCELADO'])
    expect(transicionPedidoPermitida('PENDIENTE', 'DISPONIBLE')).toBe(true)
    expect(transicionPedidoPermitida('PENDIENTE', 'CANCELADO')).toBe(true)
    expect(transicionPedidoPermitida('PENDIENTE', 'ENTREGADO')).toBe(false)
  })

  it('DISPONIBLE pasa a ENTREGADO o CANCELADO', () => {
    expect(siguientesEstadosPedido('DISPONIBLE')).toEqual(['ENTREGADO', 'CANCELADO'])
    expect(transicionPedidoPermitida('DISPONIBLE', 'ENTREGADO')).toBe(true)
    expect(transicionPedidoPermitida('DISPONIBLE', 'CANCELADO')).toBe(true)
    expect(transicionPedidoPermitida('DISPONIBLE', 'PENDIENTE')).toBe(false)
  })

  it('ENTREGADO y CANCELADO son estados finales', () => {
    expect(esEstadoFinalPedido('ENTREGADO')).toBe(true)
    expect(esEstadoFinalPedido('CANCELADO')).toBe(true)
    expect(esEstadoFinalPedido('PENDIENTE')).toBe(false)
    expect(esEstadoFinalPedido('DISPONIBLE')).toBe(false)
    expect(siguientesEstadosPedido('ENTREGADO')).toEqual([])
    expect(siguientesEstadosPedido('CANCELADO')).toEqual([])
  })

  it('completa fecha_resolucion solo al llegar a un estado final', () => {
    const ahora = new Date('2026-11-10T20:00:00.000Z')

    const disponible = evaluarCambioEstadoPedido('PENDIENTE', 'DISPONIBLE', ahora)
    expect(disponible.admite).toBe(true)
    expect(disponible.fechaResolucion).toBeNull()

    const entregado = evaluarCambioEstadoPedido('DISPONIBLE', 'ENTREGADO', ahora)
    expect(entregado.admite).toBe(true)
    expect(entregado.fechaResolucion).toBe(ahora)

    const cancelado = evaluarCambioEstadoPedido('PENDIENTE', 'CANCELADO', ahora)
    expect(cancelado.admite).toBe(true)
    expect(cancelado.fechaResolucion).toBe(ahora)

    const invalido = evaluarCambioEstadoPedido('ENTREGADO', 'CANCELADO', ahora)
    expect(invalido.admite).toBe(false)
  })
})

describe('RF19.1 - identificacion del pedido (ck_pedido_identificacion)', () => {
  it('acepta producto del catalogo o descripcion libre', () => {
    expect(identificacionValida({ idProducto: 10 })).toBe(true)
    expect(identificacionValida({ descripcionPedido: 'Funda iPhone 16 Pro' })).toBe(true)
    expect(identificacionValida({ idProducto: 10, descripcionPedido: 'Color negro' })).toBe(true)
  })

  it('rechaza si faltan ambos', () => {
    expect(identificacionValida({})).toBe(false)
    expect(identificacionValida({ idProducto: null, descripcionPedido: '   ' })).toBe(false)
  })
})

describe('RF19.3 - formateo del pedido', () => {
  it('incluye cliente con whatsapp, producto y transiciones disponibles', () => {
    const plano = formatearPedido({
      idPedido: 3,
      idCliente: 5,
      cliente: { idCliente: 5, persona: { apellidoNombre: 'Gomez Lucas', telefonoWhatsapp: '3704556677' } },
      idProducto: 8,
      producto: { idProducto: 8, codigoInterno: 'EGC-000008', denominacion: 'Vidrio 9H', stockActual: 0 },
      descripcionPedido: null,
      cantidad: 2,
      fechaSolicitud: '2026-11-01T14:00:00.000Z',
      fechaResolucion: null,
      estado: 'DISPONIBLE',
      observacion: 'Avisar a la tarde',
      usuario: { idUsuario: 1, nombreUsuario: 'admin' },
    })

    expect(plano.siguientesEstados).toEqual(['ENTREGADO', 'CANCELADO'])
    expect(plano.esFinal).toBe(false)
    expect(plano.cliente.telefonoWhatsapp).toBe('3704556677')
    expect(plano.producto.denominacion).toBe('Vidrio 9H')
  })
})

