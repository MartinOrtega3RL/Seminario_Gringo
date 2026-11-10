import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { PedidoPendiente, Cliente, Persona, Producto, Usuario } from '../../modelos/index.js'
import { DatosInvalidos, NoEncontrado } from '../../errores.js'
import { registroDe } from '../../registro.js'
import {
  ESTADOS_NO_FINALES,
  evaluarCambioEstadoPedido,
  identificacionValida,
  formatearPedido,
} from './pedidos.reglas.js'

const log = registroDe('pedidos')

const RELACIONES = [
  {
    model: Cliente,
    as: 'cliente',
    attributes: ['idCliente'],
    include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre', 'telefonoWhatsapp'] }],
  },
  {
    model: Producto,
    as: 'producto',
    attributes: ['idProducto', 'codigoInterno', 'denominacion', 'stockActual'],
  },
  {
    model: Usuario,
    as: 'usuario',
    attributes: ['idUsuario', 'nombreUsuario'],
  },
]

const buscarPedido = async (idPedido) => {
  const pedido = await PedidoPendiente.findByPk(idPedido, { include: RELACIONES })
  if (!pedido) throw new NoEncontrado('El pedido pendiente')
  return formatearPedido(pedido.get({ plain: true }))
}

/**
 * RF19.1 — registrar un pedido pendiente ante falta de existencias.
 */
export const registrarPedido = async (datos, idUsuario) => {
  const { idCliente, idProducto, descripcionPedido, cantidad, observacion } = datos

  if (!identificacionValida({ idProducto, descripcionPedido })) {
    throw new DatosInvalidos('Indicá un producto del catálogo o escribí qué pidió el cliente.')
  }

  const cliente = await Cliente.findOne({ where: { idCliente, activo: true } })
  if (!cliente) throw new NoEncontrado('El cliente')

  if (idProducto) {
    const producto = await Producto.findOne({ where: { idProducto, activo: true } })
    if (!producto) throw new NoEncontrado('El producto')
  }

  const pedido = await PedidoPendiente.create({
    idCliente,
    idProducto: idProducto ?? null,
    descripcionPedido: descripcionPedido?.trim() || null,
    idUsuario,
    cantidad,
    fechaSolicitud: new Date(),
    estado: 'PENDIENTE',
    observacion: observacion?.trim() || null,
  })

  log.info({ idPedido: pedido.idPedido, idCliente, idProducto: idProducto ?? null, usuario: idUsuario }, 'pedido registrado')
  return buscarPedido(pedido.idPedido)
}

/**
 * RF19.2 — actualizar el estado de un pedido pendiente hasta su resolucion.
 */
export const actualizarEstadoPedido = async (idPedido, { estado, observacion }, idUsuario) => {
  await sequelize.transaction(async (transaction) => {
    const pedido = await PedidoPendiente.findByPk(idPedido, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    })
    if (!pedido) throw new NoEncontrado('El pedido pendiente')

    const evaluacion = evaluarCambioEstadoPedido(pedido.estado, estado)
    if (!evaluacion.admite) throw new DatosInvalidos(evaluacion.motivo)

    const cambios = {
      estado,
      ...(evaluacion.fechaResolucion ? { fechaResolucion: evaluacion.fechaResolucion } : {}),
    }
    if (observacion !== undefined) {
      cambios.observacion = observacion?.trim() || null
    }

    await pedido.update(cambios, { transaction })
  })

  log.info({ idPedido, estado, usuario: idUsuario }, 'estado de pedido actualizado')
  return buscarPedido(idPedido)
}

/**
 * RF19.3 — consultar pedidos pendientes paginados.
 * De forma predeterminada filtra los no finales y ordena los mas antiguos primero.
 */
export const listarPedidos = async ({ estado, idCliente, limit, offset }) => {
  const donde = {}

  if (estado === 'TODOS') {
    // Sin filtro de estado: muestra todo el historial de pedidos.
  } else if (estado) {
    donde.estado = estado
  } else {
    donde.estado = { [Op.in]: ESTADOS_NO_FINALES }
  }

  if (idCliente) donde.idCliente = idCliente

  const resultado = await PedidoPendiente.findAndCountAll({
    where: donde,
    include: RELACIONES,
    order: [['fechaSolicitud', 'ASC'], ['idPedido', 'ASC']],
    limit,
    offset,
  })

  return {
    count: resultado.count,
    rows: resultado.rows.map((pedido) => formatearPedido(pedido.get({ plain: true }))),
  }
}

