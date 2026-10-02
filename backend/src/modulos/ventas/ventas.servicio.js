import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Venta, DetalleVenta, PagoVenta, Producto, Cliente, TipoCliente, Persona, MedioPago, Usuario } from '../../modelos/index.js'
import { descontarPorVenta, restituirPorAnulacion } from '../existencias/existencias.servicio.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import {
  resolverLista, precioSegunLista, calcularTotal, aPesos,
  cuotasCoherentes, entregaCoherente, formatearComprobante, admiteAnulacion,
} from './ventas.reglas.js'

const log = registroDe('ventas')

const buscarCliente = async (idCliente, transaction) => {
  if (!idCliente) return null

  const cliente = await Cliente.findByPk(idCliente, {
    include: [
      { model: TipoCliente, as: 'tipoCliente' },
      { model: Persona, as: 'persona', attributes: ['apellidoNombre', 'numeroDocumento'] },
    ],
    transaction,
  })
  if (!cliente || !cliente.activo) throw new NoEncontrado('El cliente')
  return cliente
}

// Congela precio y costo al momento de la operacion: un cambio de precio
// posterior no altera una venta ya registrada.
const armarLineas = async (items, lista, transaction) => Promise.all(
  items.map(async ({ idProducto, cantidad }) => {
    const producto = await Producto.findByPk(idProducto, { transaction })
    if (!producto || !producto.activo) throw new NoEncontrado(`El producto ${idProducto}`)

    return {
      idProducto,
      cantidad,
      precioUnitario: precioSegunLista(producto, lista),
      costoUnitario: producto.precioCosto,
      denominacion: producto.denominacion,
    }
  }),
)

const verificarCoherencia = (datos) => {
  if (!cuotasCoherentes(datos)) {
    throw new DatosInvalidos('Una venta al contado no lleva cuotas, y una financiada necesita al menos una.')
  }
  if (!entregaCoherente(datos)) {
    throw new DatosInvalidos('El envio a domicilio necesita que informes la direccion de entrega.')
  }
}

const registrarPago = async ({ idVenta, idMedioPago, importe, referencia }, transaction) => {
  const medio = await MedioPago.findByPk(idMedioPago, { transaction })
  if (!medio || !medio.activo) throw new NoEncontrado('El medio de pago')

  return PagoVenta.create({ idVenta, idMedioPago, importe, referencia }, { transaction })
}

/**
 * RF16.7 — confirma la venta. Todo ocurre dentro de una unica transaccion:
 * la venta, sus lineas, el descuento de existencias y el pago se registran
 * juntos o no se registra ninguno (RNF14).
 *
 * @param {object} orden datos validados de la operacion
 * @param {number} idUsuario responsable, tomado del token y nunca del cuerpo
 */
export const confirmarVenta = async (orden, idUsuario) => {
  verificarCoherencia(orden)

  const { idCliente, lineas: items, modalidadPago, cantidadCuotas, recargoFinanciacion = 0,
    modalidadEntrega, domicilioEntrega, idMedioPago, referenciaPago } = orden

  return sequelize.transaction(async (transaction) => {
    const cliente = await buscarCliente(idCliente, transaction)
    const lista = resolverLista(cliente)
    const lineas = await armarLineas(items, lista, transaction)
    const total = aPesos(calcularTotal(lineas))

    // Provisorio unico: el numero definitivo se deriva del identificador que
    // asigna la base, que no puede colisionar. Las dos escrituras van en la
    // misma transaccion, asi que nadie ve nunca el provisorio.
    const venta = await Venta.create({
      idCliente: idCliente ?? null,
      idUsuario,
      numeroComprobante: `TMP-${randomUUID().slice(0, 16)}`,
      listaPrecioAplicada: lista,
      montoTotal: total,
      modalidadPago,
      cantidadCuotas: cantidadCuotas ?? null,
      recargoFinanciacion,
      modalidadEntrega,
      domicilioEntrega: domicilioEntrega ?? null,
      estado: 'CONFIRMADA',
    }, { transaction })

    await venta.update({ numeroComprobante: formatearComprobante(venta.idVenta) }, { transaction })

    for (const linea of lineas) {
      // Existencias es duena de la guarda: si no alcanza, lanza y todo se revierte.
      await descontarPorVenta({
        idProducto: linea.idProducto,
        cantidad: linea.cantidad,
        idUsuario,
        idVenta: venta.idVenta,
      }, transaction)

      await DetalleVenta.create({
        idVenta: venta.idVenta,
        idProducto: linea.idProducto,
        cantidad: linea.cantidad,
        precioUnitario: linea.precioUnitario,
        costoUnitario: linea.costoUnitario,
      }, { transaction })
    }

    await registrarPago({
      idVenta: venta.idVenta,
      idMedioPago,
      importe: aPesos(calcularTotal(lineas) + Math.round(Number(recargoFinanciacion) * 100)),
      referencia: referenciaPago ?? null,
    }, transaction)

    return { venta, lineas, cliente }
  })
}

/**
 * RF18.1 — historial con filtros por periodo y por cliente.
 *
 * El listado va por el ORM, que es lo que hace bien: filas con sus relaciones.
 * El total del periodo va en SQL crudo aparte, porque es una agregacion sobre
 * el conjunto filtrado y no sobre la pagina que se devuelve: sumarlo en
 * JavaScript daria el total de los veinticinco renglones visibles, no el del
 * periodo, que es el numero que el titular va a mirar.
 */
export const listarVentas = async ({ desde, hasta, idCliente, estado, limit, offset }) => {
  const filtro = {}
  if (idCliente) filtro.idCliente = idCliente
  if (estado) filtro.estado = estado
  if (desde || hasta) {
    filtro.fechaHora = {
      ...(desde ? { [Op.gte]: `${desde} 00:00:00` } : {}),
      ...(hasta ? { [Op.lte]: `${hasta} 23:59:59` } : {}),
    }
  }

  const resultado = await Venta.findAndCountAll({
    where: filtro,
    include: [
      { model: Cliente, as: 'cliente', include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre'] }] },
      { model: Usuario, as: 'vendedor', attributes: ['idUsuario', 'nombreUsuario'] },
      { model: PagoVenta, as: 'pago', include: [{ model: MedioPago, as: 'medioPago', attributes: ['nombre'] }] },
      // El detalle viaja con el listado: un historial que dice cuanto salio
      // pero no que se vendio obliga a abrir cada venta para saber algo.
      {
        model: DetalleVenta,
        as: 'detalle',
        attributes: ['idDetalle', 'cantidad'],
        include: [{ model: Producto, as: 'producto', attributes: ['idProducto', 'denominacion'] }],
      },
    ],
    order: [['fechaHora', 'DESC'], ['idVenta', 'DESC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

  const [[resumen]] = await sequelize.query(`
    SELECT COUNT(*)                                        AS cantidad,
           COALESCE(SUM(monto_total + recargo_financiacion), 0) AS total
      FROM venta
     WHERE estado = 'CONFIRMADA'
       AND (:desde     IS NULL OR fecha_hora >= CONCAT(:desde, ' 00:00:00'))
       AND (:hasta     IS NULL OR fecha_hora <= CONCAT(:hasta, ' 23:59:59'))
       AND (:idCliente IS NULL OR id_cliente = :idCliente)
  `, { replacements: { desde: desde ?? null, hasta: hasta ?? null, idCliente: idCliente ?? null } })

  return { ...resultado, resumen }
}

/**
 * RF18.2 — anulacion.
 *
 * No borra: marca la venta como anulada y restituye las existencias (RF11.4).
 * Las tres columnas de anulacion se escriben juntas porque ck_venta_anulacion
 * las exige juntas; escribir solo el estado haria fallar la restriccion.
 */
export const anularVenta = async (idVenta, motivo, idUsuario) => {
  if (!motivo?.trim()) throw new DatosInvalidos('La anulación necesita un motivo.')

  await sequelize.transaction(async (transaction) => {
    const venta = await Venta.findByPk(idVenta, {
      include: [{ model: DetalleVenta, as: 'detalle' }],
      transaction,
    })

    const { admite, motivo: impedimento } = admiteAnulacion(venta)
    if (!admite) throw new DatosInvalidos(impedimento)

    for (const linea of venta.detalle) {
      await restituirPorAnulacion({
        idProducto: linea.idProducto,
        cantidad: linea.cantidad,
        idUsuario,
        idVenta,
      }, transaction)
    }

    await venta.update({
      estado: 'ANULADA',
      idUsuarioAnulacion: idUsuario,
      fechaAnulacion: new Date(),
      motivoAnulacion: motivo.trim(),
    }, { transaction })
  })

  log.info({ idVenta, usuario: idUsuario }, 'venta anulada')
  return buscarVenta(idVenta)
}

/** RF16.6 — medios de pago habilitados. Vienen precargados (H17). */
export const listarMediosPago = async () => MedioPago.findAll({
  where: { activo: true },
  attributes: ['idMedioPago', 'nombre'],
  order: [['idMedioPago', 'ASC']],
})

/** Consulta de una venta con todo su agregado, para el comprobante y RF18.1. */
export const buscarVenta = async (idVenta) => {
  const venta = await Venta.findByPk(idVenta, {
    include: [
      { model: DetalleVenta, as: 'detalle', include: [{ model: Producto, as: 'producto', attributes: ['denominacion', 'codigoInterno'] }] },
      { model: PagoVenta, as: 'pago', include: [{ model: MedioPago, as: 'medioPago' }] },
      { model: Cliente, as: 'cliente', include: [{ model: Persona, as: 'persona' }] },
      // El comprobante consigna quien atendio (RF16.7 / RNF18).
      { model: Usuario, as: 'vendedor', attributes: ['idUsuario', 'nombreUsuario'] },
    ],
  })
  if (!venta) throw new NoEncontrado('La venta')
  return venta
}
