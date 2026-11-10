import { describe, it, expect } from 'vitest'
import {
  nombrePedido,
  enlaceWhatsapp,
  mensajePedidoDisponible,
  tonoEstadoPedido,
} from '../src/modulos/pedidos/pedidos.reglas.js'

describe('RF19 / H11 - enlace de WhatsApp y presentacion de pedidos', () => {
  it('arma el enlace wa.me con solo digitos', () => {
    expect(enlaceWhatsapp('+54 9 370 415-2233')).toBe('https://wa.me/5493704152233')
    expect(enlaceWhatsapp('3704152233', 'Hola!')).toBe('https://wa.me/3704152233?text=Hola!')
  })

  it('devuelve null si no hay numero valido', () => {
    expect(enlaceWhatsapp(null)).toBeNull()
    expect(enlaceWhatsapp('   ')).toBeNull()
  })

  it('toma el nombre del producto o la descripcion libre', () => {
    expect(nombrePedido({ producto: { denominacion: 'Funda silicona' } })).toBe('Funda silicona')
    expect(nombrePedido({ descripcionPedido: 'Cargador MagSafe' })).toBe('Cargador MagSafe')
  })

  it('arma el mensaje de pedido disponible con cliente y articulo', () => {
    const texto = mensajePedidoDisponible({
      cliente: { apellidoNombre: 'Perez Juan' },
      producto: { denominacion: 'Vidrio templado 9H' },
    })
    expect(texto).toContain('Perez Juan')
    expect(texto).toContain('Vidrio templado 9H')
  })

  it('destaca los disponibles y alerta los cancelados', () => {
    expect(tonoEstadoPedido('DISPONIBLE')).toBe('destacado')
    expect(tonoEstadoPedido('CANCELADO')).toBe('alerta')
    expect(tonoEstadoPedido('PENDIENTE')).toBe('neutro')
  })
})

