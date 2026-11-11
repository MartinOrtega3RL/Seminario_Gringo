// Reglas de presentacion de la ficha del cliente.

/**
 * RF14 / RF04.1 — cada pestaña se muestra solo si el perfil tiene lectura
 * en ese modulo: el Vendedor no ve reparaciones y el Tecnico no ve compras.
 */
export const pestanasFichaCliente = ({ idCliente, verCompras, verReparaciones }) => {
  const items = []
  if (verCompras) {
    items.push({ clave: 'compras', a: `/clientes/${idCliente}/compras`, texto: 'Compras' })
  }
  if (verReparaciones) {
    items.push({ clave: 'reparaciones', a: `/clientes/${idCliente}/reparaciones`, texto: 'Reparaciones' })
  }
  return items
}

export const destinoInicialFicha = ({ verCompras, verReparaciones }) => {
  if (verCompras) return 'compras'
  if (verReparaciones) return 'reparaciones'
  return null
}

/** "Apple iPhone 13", o lo que haya si falta la marca. */
export const nombreEquipoHistorial = (equipo) =>
  [equipo?.marca, equipo?.modelo].filter(Boolean).join(' ') || 'Equipo sin identificar'

