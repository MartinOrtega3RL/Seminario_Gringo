import { describe, it, expect } from 'vitest'
import { puedeVerCosto, productoVisible, catalogoVisible, prepararBusqueda }
  from '../src/modulos/catalogo/catalogo.reglas.js'

const PRODUCTO = {
  idProducto: 1,
  denominacion: 'Funda silicona iPhone 13',
  precioCosto: '4000.00',
  precioMinorista: '9000.00',
  precioMayorista: '7200.00',
  stockActual: 12,
}

describe('RF04.2 - visibilidad del precio de costo', () => {
  it('el Administrador ve el costo', () => {
    expect(puedeVerCosto('Administrador')).toBe(true)
    expect(productoVisible(PRODUCTO, 'Administrador').precioCosto).toBe('4000.00')
  })

  it('el Vendedor no recibe el costo en la respuesta', () => {
    const visible = productoVisible(PRODUCTO, 'Vendedor')
    expect(visible).not.toHaveProperty('precioCosto')
    expect(visible.precioMinorista).toBe('9000.00')
  })

  it('el Tecnico tampoco', () => {
    expect(productoVisible(PRODUCTO, 'Tecnico')).not.toHaveProperty('precioCosto')
  })

  it('un perfil desconocido no ve el costo: se niega por omision', () => {
    expect(puedeVerCosto('CualquierCosa')).toBe(false)
    expect(productoVisible(PRODUCTO, undefined)).not.toHaveProperty('precioCosto')
  })

  it('no modifica el producto original al ocultar el costo', () => {
    productoVisible(PRODUCTO, 'Vendedor')
    expect(PRODUCTO.precioCosto).toBe('4000.00')
  })

  it('filtra el catalogo completo, no solo un producto', () => {
    const listado = catalogoVisible([PRODUCTO, { ...PRODUCTO, idProducto: 2 }], 'Vendedor')
    expect(listado).toHaveLength(2)
    expect(listado.every((item) => !('precioCosto' in item))).toBe(true)
  })
})

describe('RF06.5 - preparacion de la busqueda', () => {
  it('agrega el comodin para la busqueda predictiva', () => {
    expect(prepararBusqueda('funda')).toBe('+funda*')
  })

  it('exige todas las palabras cuando hay varias', () => {
    expect(prepararBusqueda('funda iphone')).toBe('+funda* +iphone*')
  })

  it('neutraliza los operadores de modo booleano', () => {
    // Sin limpiar, el "-azul" excluiria resultados y el ">" seria un error de sintaxis.
    expect(prepararBusqueda('funda -azul >100')).toBe('+funda* +azul* +100*')
  })

  it('devuelve null cuando no queda nada que buscar', () => {
    expect(prepararBusqueda('   ')).toBeNull()
    expect(prepararBusqueda('+++')).toBeNull()
    expect(prepararBusqueda(null)).toBeNull()
  })
})
