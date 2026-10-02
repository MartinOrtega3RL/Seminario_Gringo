import { api, consulta } from '../../api/cliente.js'

// En ninguna de estas llamadas viaja el id del usuario: el responsable de todo
// movimiento sale del token de sesion. Si se aceptara del cuerpo, cualquiera
// podria registrar un ajuste a nombre de otro.

/** RF12.4 — historial de movimientos, por producto o general. */
export const listarMovimientos = ({ idProducto, tipo, pagina = 1, tamano = 25 } = {}) =>
  api.obtener(`/existencias/movimientos${consulta({ idProducto, tipo, pagina, tamano })}`)

/**
 * RF11.1 — ingreso de mercaderia. Incrementa las existencias y deja el
 * movimiento con su origen.
 * @param {{lineas: {idProducto:number, cantidad:number, costoUnitario?:number}[], observaciones?:string}} datos
 */
export const registrarIngreso = (datos) => api.enviar('/existencias/ingreso', datos)

/**
 * RF11.5 — ajuste manual. El motivo es OBLIGATORIO: la base lo verifica con un
 * CHECK, porque un ajuste sin explicacion es un descuadre sin responsable.
 * @param {{idProducto:number, cantidad:number, motivo:string}} datos
 */
export const registrarAjuste = (datos) => api.enviar('/existencias/ajuste', datos)

/**
 * RF11.3 — consumo de repuestos en una reparacion. Reemplaza la planilla en
 * papel que el comercio usa hoy (H29).
 *
 * No exige orden de servicio tecnico: ese modulo esta diferido y el movimiento
 * se registra igual, con su motivo y su responsable.
 * @param {{idProducto:number, cantidad:number, motivo:string}} datos
 */
export const registrarConsumoReparacion = (datos) =>
  api.enviar('/existencias/consumo-reparacion', datos)
