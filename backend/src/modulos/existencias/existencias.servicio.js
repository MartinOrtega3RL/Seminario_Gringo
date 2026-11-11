import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Producto, MovimientoStock, Usuario } from '../../modelos/index.js'
import { StockInsuficiente, NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { inicioDeDia, finDeDia } from '../../http/fechas.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'

const log = registroDe('existencias')

// Existencias es duena de la regla "el saldo no puede quedar negativo".
// Ningun otro modulo escribe producto.stock_actual por su cuenta.

// InnoDB opera en REPEATABLE READ: leer el saldo y despues restarlo deja una
// ventana en la que dos operaciones simultaneas sobre el mismo producto pasan
// las dos. La guarda va DENTRO de la sentencia, sin lectura previa. Si afecta
// 0 filas, no habia existencias y la transaccion completa se revierte.
const SQL_RESTAR = `
  UPDATE producto
     SET stock_actual = stock_actual - :cantidad
   WHERE id_producto = :idProducto
     AND activo = 1
     AND stock_actual >= :cantidad
`

const SQL_SUMAR = `
  UPDATE producto
     SET stock_actual = stock_actual + :cantidad
   WHERE id_producto = :idProducto
     AND activo = 1
`

const filasAfectadas = (resultado) => resultado?.[0]?.affectedRows ?? 0

const leerProducto = async (idProducto, transaction) => {
  const producto = await Producto.findByPk(idProducto, {
    attributes: ['idProducto', 'denominacion', 'stockActual', 'activo'],
    transaction,
  })
  if (!producto || !producto.activo) throw new NoEncontrado('El producto')
  return producto
}

/**
 * Aplica una variacion de existencias y deja su movimiento. Es el unico camino
 * por el que cambia producto.stock_actual en todo el sistema.
 *
 * INVARIANTE: el saldo y el movimiento se escriben juntos o no se escribe
 * ninguno. Por eso `transaction` es obligatorio y no opcional.
 *
 * @param {{idProducto:number, delta:number, tipo:string, idUsuario:number,
 *          motivo?:string, idVenta?:number, idRecepcion?:number, idOrden?:number}} orden
 */
const aplicarMovimiento = async (orden, transaction) => {
  const { idProducto, delta, tipo, idUsuario, motivo = null, idVenta = null,
    idRecepcion = null, idOrden = null } = orden

  if (!Number.isInteger(delta) || delta === 0) {
    throw new DatosInvalidos('La cantidad del movimiento tiene que ser un entero distinto de cero.')
  }

  if (delta < 0) {
    const resultado = await sequelize.query(SQL_RESTAR, {
      replacements: { idProducto, cantidad: -delta },
      transaction,
    })
    if (filasAfectadas(resultado) === 0) {
      const producto = await leerProducto(idProducto, transaction)
      throw new StockInsuficiente(producto.denominacion, producto.stockActual)
    }
  } else {
    const resultado = await sequelize.query(SQL_SUMAR, {
      replacements: { idProducto, cantidad: delta },
      transaction,
    })
    if (filasAfectadas(resultado) === 0) throw new NoEncontrado('El producto')
  }

  // Dentro de la transaccion, la lectura ve nuestra propia escritura.
  const producto = await leerProducto(idProducto, transaction)

  const movimiento = await MovimientoStock.create({
    idProducto,
    idUsuario,
    tipoMovimiento: tipo,
    cantidad: delta,
    stockResultante: producto.stockActual,
    motivo,
    idVenta,
    idRecepcion,
    idOrden,
  }, { transaction })

  return { saldo: producto.stockActual, idMovimiento: movimiento.idMovimiento }
}

const ejecutarMovimiento = async (datos, transaction) =>
  (await aplicarMovimiento(datos, transaction)).saldo

/** RF11.2 — descuento por venta. Lo invoca el modulo de ventas, en su transaccion. */
export const descontarPorVenta = ({ idProducto, cantidad, idUsuario, idVenta }, transaction) =>
  ejecutarMovimiento({ idProducto, delta: -cantidad, tipo: 'VENTA', idUsuario, idVenta }, transaction)

/** RF11.4 — restitucion por anulacion de venta. Sumar nunca deja el saldo negativo. */
export const restituirPorAnulacion = ({ idProducto, cantidad, idUsuario, idVenta }, transaction) =>
  ejecutarMovimiento({ idProducto, delta: cantidad, tipo: 'DEVOLUCION', idUsuario, idVenta }, transaction)

/**
 * RF22.4 / RF11.3 — repuesto usado en una orden de servicio. Lo invoca el modulo
 * de servicio tecnico dentro de la transaccion de la orden: el descuento y el
 * renglon de repuesto_utilizado se escriben juntos o no se escribe ninguno.
 */
export const descontarPorReparacion = ({ idProducto, cantidad, idUsuario, idOrden, motivo }, transaction) =>
  ejecutarMovimiento({ idProducto, delta: -cantidad, tipo: 'REPARACION', idUsuario, motivo, idOrden }, transaction)

/** Quitar un repuesto de una orden devuelve la unidad al stock y deja el movimiento. */
export const restituirPorReparacion = ({ idProducto, cantidad, idUsuario, idOrden, motivo }, transaction) =>
  ejecutarMovimiento({ idProducto, delta: cantidad, tipo: 'DEVOLUCION', idUsuario, motivo, idOrden }, transaction)

/**
 * RF11.1 / RF10.3 — ingreso de mercaderia, varias lineas en una sola operacion.
 * Se invoca internamente al confirmar una recepcion de mercaderia (o en su
 * propia transaccion si se llama sin una abierta).
 */
export const registrarIngreso = async ({ lineas, observaciones, idRecepcion = null }, idUsuario, transactionExterna = null) => {
  if (!lineas?.length) throw new DatosInvalidos('El ingreso necesita al menos un producto.')

  const ejecutar = async (transaction) => {
    const saldos = []
    for (const { idProducto, cantidad } of lineas) {
      const { saldo, idMovimiento } = await aplicarMovimiento({
        idProducto, delta: cantidad, tipo: 'INGRESO', idUsuario, motivo: observaciones, idRecepcion,
      }, transaction)
      await registrarEnBitacora({
        entidad: 'movimiento_stock',
        idRegistro: idMovimiento,
        accion: 'ALTA',
        despues: { idProducto, cantidad, stockResultante: saldo, tipoMovimiento: 'INGRESO', idRecepcion },
        detalle: observaciones ?? null,
      }, transaction)
      saldos.push({ idProducto, cantidad, saldo, idMovimiento })
    }
    return saldos
  }

  const resultado = transactionExterna
    ? await ejecutar(transactionExterna)
    : await sequelize.transaction(ejecutar)

  log.info({ usuario: idUsuario, idRecepcion, lineas: resultado.length }, 'ingreso de mercaderia registrado')
  return resultado
}

/**
 * RF11.5 — ajuste manual. El motivo es OBLIGATORIO y la base lo verifica con
 * un CHECK: un ajuste sin explicacion es un descuadre sin responsable.
 */
export const registrarAjuste = async ({ idProducto, cantidad, motivo }, idUsuario) => {
  if (!motivo?.trim()) throw new DatosInvalidos('El ajuste necesita un motivo.')

  const saldo = await sequelize.transaction(async (transaction) => {
    const { saldo: nuevoSaldo, idMovimiento } = await aplicarMovimiento({
      idProducto, delta: cantidad, tipo: 'AJUSTE', idUsuario, motivo: motivo.trim(),
    }, transaction)
    await registrarEnBitacora({
      entidad: 'movimiento_stock',
      idRegistro: idMovimiento,
      accion: 'AJUSTE',
      despues: { idProducto, cantidad, stockResultante: nuevoSaldo, tipoMovimiento: 'AJUSTE' },
      detalle: motivo.trim(),
    }, transaction)
    return nuevoSaldo
  })

  log.info({ idProducto, cantidad, saldo, usuario: idUsuario }, 'ajuste manual registrado')
  return { idProducto, saldo }
}

/**
 * RF11.3 — consumo de repuestos en una reparacion.
 *
 * Reemplaza la planilla en papel que el comercio usa hoy: "se descuentan y
 * anotan en una planilla cada vez que se utiliza uno" (H29).
 *
 * Este camino NO exige una orden de servicio tecnico: es para el repuesto que se
 * usa sin que haya una orden abierta. El esquema lo admite porque
 * ck_movstock_origen_unico pide "como maximo uno", no "exactamente uno".
 * Cuando hay orden, el repuesto se carga desde ella (descontarPorReparacion) y
 * el movimiento queda atado a su orden.
 */
export const registrarConsumoReparacion = async ({ idProducto, cantidad, motivo, idOrden = null }, idUsuario) => {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new DatosInvalidos('Indicá cuántas unidades se usaron en la reparación.')
  }
  if (!motivo?.trim()) {
    throw new DatosInvalidos('Indicá para qué reparación se usó el repuesto.')
  }

  const saldo = await sequelize.transaction(async (transaction) => {
    const { saldo: nuevoSaldo, idMovimiento } = await aplicarMovimiento({
      idProducto, delta: -cantidad, tipo: 'REPARACION', idUsuario, motivo: motivo.trim(), idOrden,
    }, transaction)
    await registrarEnBitacora({
      entidad: 'movimiento_stock',
      idRegistro: idMovimiento,
      accion: 'AJUSTE',
      despues: { idProducto, cantidad: -cantidad, stockResultante: nuevoSaldo, tipoMovimiento: 'REPARACION', idOrden },
      detalle: motivo.trim(),
    }, transaction)
    return nuevoSaldo
  })

  log.info({ idProducto, cantidad, saldo, usuario: idUsuario }, 'consumo por reparacion registrado')
  return { idProducto, saldo }
}

/** RF12.4 — historial de movimientos, por producto o general. */
export const listarMovimientos = async ({ idProducto, tipo, desde, hasta, limit, offset }) => {
  const filtro = {}
  if (idProducto) filtro.idProducto = idProducto
  if (tipo) filtro.tipoMovimiento = tipo
  if (desde || hasta) {
    filtro.fechaHora = {
      ...(desde ? { [Op.gte]: inicioDeDia(desde) } : {}),
      ...(hasta ? { [Op.lte]: finDeDia(hasta) } : {}),
    }
  }

  return MovimientoStock.findAndCountAll({
    where: filtro,
    include: [
      { model: Producto, as: 'producto', attributes: ['idProducto', 'denominacion', 'codigoInterno'] },
      { model: Usuario, as: 'usuario', attributes: ['idUsuario', 'nombreUsuario'] },
    ],
    order: [['fechaHora', 'DESC'], ['idMovimiento', 'DESC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })
}
