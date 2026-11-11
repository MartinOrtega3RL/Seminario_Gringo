import { sequelize } from '../../config/base-de-datos.js'
import { OrdenServicio, EstadoOrden, OrdenEstadoHistorial } from '../../modelos/index.js'
import { leerParametro } from '../../modelos/sistema.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { admite, transicionPermitida } from './servicio.reglas.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'

// Lo que comparten todas las operaciones sobre una orden. Esta aca y no repetido
// en cada una porque son las dos reglas que no pueden diferir entre operaciones:
// que dos personas no pisen la misma orden a la vez, y que el estado cambie
// siempre por el mismo camino.

/**
 * Ejecuta una operacion sobre una orden con la fila BLOQUEADA.
 *
 * InnoDB trabaja en REPEATABLE READ: sin el bloqueo, dos operaciones sobre la
 * misma orden (el tecnico pasandola a REPARADO mientras la recepcion la anula)
 * leen el mismo estado, las dos lo ven valido y las dos escriben. El
 * SELECT ... FOR UPDATE las serializa: la segunda espera, lee el estado ya
 * cambiado y la regla de transicion la rechaza con un mensaje claro.
 */
export const operar = (idOrden, operacion) =>
  sequelize.transaction(async (transaction) => {
    const orden = await OrdenServicio.findByPk(idOrden, { transaction, lock: transaction.LOCK.UPDATE })
    if (!orden) throw new NoEncontrado('La orden de servicio')

    const estado = await EstadoOrden.findByPk(orden.idEstadoActual, { transaction })
    return operacion({ orden, estado, transaction })
  })

/** Rechaza la operacion si no corresponde en el estado actual, y dice por que. */
export const exigir = (operacion, estado, accion) => {
  if (!admite(operacion, estado.codigo)) {
    throw new DatosInvalidos(`No se puede ${accion} una orden en estado "${estado.nombre}".`)
  }
}

// Los once estados son datos de arranque que no cambian mientras el proceso
// vive: leerlos una vez evita un viaje a la base por cada accion.
let cacheEstados = null

export const estadosPorCodigo = async () => {
  if (!cacheEstados) {
    const filas = await EstadoOrden.findAll({ order: [['ordenSecuencia', 'ASC']] })
    cacheEstados = new Map(filas.map((fila) => [fila.codigo, fila.get({ plain: true })]))
  }
  return cacheEstados
}

export const estadoPorCodigo = async (codigo) => {
  const estado = (await estadosPorCodigo()).get(codigo)
  if (!estado) {
    // Faltan datos de arranque: es un defecto de instalacion, no del usuario.
    throw new Error(`Falta el estado ${codigo} en estado_orden. Se carga con gestion_comercial_datos.sql.`)
  }
  return estado
}

/**
 * EL camino por el que cambia el estado de una orden (RF22.6). Valida la
 * transicion contra las reglas, actualiza la orden y deja el renglon del
 * historial, todo dentro de la transaccion de quien llama.
 *
 * `cambios` son los demas campos que la transicion escribe (el monto del
 * presupuesto, la fecha de notificacion): van en el mismo UPDATE para que el
 * estado y su dato nunca queden desparejos.
 */
export const pasarA = async (orden, estadoActual, codigoDestino, contexto, transaction) => {
  const { idUsuario, observacion = null, medio = null, cambios = {} } = contexto

  if (!transicionPermitida(estadoActual.codigo, codigoDestino)) {
    const destino = await estadoPorCodigo(codigoDestino)
    throw new DatosInvalidos(`Una orden "${estadoActual.nombre}" no puede pasar a "${destino.nombre}".`)
  }

  const destino = await estadoPorCodigo(codigoDestino)

  await orden.update({ ...cambios, idEstadoActual: destino.idEstado }, { transaction })
  await anotar(orden.idOrden, destino.idEstado, { idUsuario, observacion, medio }, transaction)

  await registrarEnBitacora({
    entidad: 'orden_servicio',
    idRegistro: orden.idOrden,
    accion: 'MODIFICACION',
    antes: { estado: estadoActual.codigo },
    despues: {
      estado: destino.codigo,
      ...(cambios.montoTotal !== undefined ? { montoTotal: cambios.montoTotal } : {}),
      ...(cambios.recargoAplicado !== undefined ? { recargoAplicado: cambios.recargoAplicado } : {}),
    },
    detalle: `${estadoActual.codigo} -> ${destino.codigo}`,
  }, transaction)

  return destino
}

/** Un renglon del historial sin cambiar de estado (una nueva notificacion). */
export const anotar = (idOrden, idEstado, { idUsuario, observacion = null, medio = null }, transaction) =>
  OrdenEstadoHistorial.create({
    idOrden,
    idEstado,
    idUsuario,
    // Fecha de la aplicacion y no del DEFAULT de la base: asi todas las
    // marcas de tiempo del modulo se generan en el mismo lugar.
    fechaHora: new Date(),
    medioNotificacion: medio,
    observacion: observacion?.slice(0, 300) ?? null,
  }, { transaction })

/** RF22 — el tecnico asignado es quien toma la orden; mientras nadie, queda nulo. */
export const tecnicoSiFalta = (orden, idUsuario) =>
  orden.idUsuarioTecnico ? {} : { idUsuarioTecnico: idUsuario }

/**
 * Los plazos y porcentajes de H07 y H08 no se escriben en el codigo: son
 * parametros del comercio. Si falta uno es un defecto de instalacion y el
 * servidor lo dice con todas las letras, en vez de cobrar un recargo inventado.
 */
export const parametroNumerico = async (codigo) => {
  const valor = await leerParametro(codigo)
  const numero = Number(valor)

  if (valor === null || valor === undefined || !Number.isFinite(numero)) {
    throw new Error(`Falta el parametro ${codigo} en parametro_sistema. Se carga con gestion_comercial_datos.sql.`)
  }
  return numero
}

export const reglasDeNegocio = async () => {
  const [garantiaDias, plazoRetiroDias, recargoPct] = await Promise.all([
    parametroNumerico('GARANTIA_DIAS'),
    parametroNumerico('RETIRO_PLAZO_DIAS'),
    parametroNumerico('RECARGO_DEMORA_PCT'),
  ])
  return { garantiaDias, plazoRetiroDias, recargoPct }
}
