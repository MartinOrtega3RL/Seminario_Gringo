import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Cuota, Venta, Cliente, Persona, MedioPago, Usuario } from '../../modelos/index.js'
import { fechaIso } from '../servicio/servicio.reglas.js'
import { estadoCuota, diasAtrasoCuota } from './cuotas.reglas.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'
import { DatosInvalidos, NoEncontrado } from '../../errores.js'
import { registroDe } from '../../registro.js'

const log = registroDe('cuotas')

/**
 * RF20.2 — registra el cobro de una cuota dentro de una transaccion con
 * bloqueo FOR UPDATE.
 */
export const cobrarCuota = async (idCuota, { idMedioPago }, idUsuario) => {
  await sequelize.transaction(async (transaction) => {
    const cuota = await Cuota.findByPk(idCuota, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    })
    if (!cuota) throw new NoEncontrado('La cuota')

    if (cuota.fechaCobro) {
      throw new DatosInvalidos('Esa cuota ya fue cobrada.')
    }

    const venta = await Venta.findByPk(cuota.idVenta, { transaction })
    if (!venta || venta.estado === 'ANULADA') {
      throw new DatosInvalidos('No se puede cobrar una cuota de una venta anulada.')
    }

    const medio = await MedioPago.findOne({ where: { idMedioPago, activo: true }, transaction })
    if (!medio) throw new NoEncontrado('El medio de pago')

    const ahora = new Date()
    await cuota.update({
      fechaCobro: ahora,
      idMedioPago,
      idUsuarioCobro: idUsuario,
    }, { transaction })

    await registrarEnBitacora({
      entidad: 'cuota',
      idRegistro: cuota.idCuota,
      accion: 'MODIFICACION',
      antes: { estado: 'PENDIENTE' },
      despues: { estado: 'COBRADA', idMedioPago, importe: Number(cuota.importe) },
      detalle: `Cuota ${cuota.numeroCuota} de ${venta.numeroComprobante}`,
    }, transaction)
  })

  log.info({ idCuota, idMedioPago, usuario: idUsuario }, 'cuota cobrada')
  return buscarCuota(idCuota)
}

const buscarCuota = async (idCuota) => {
  const hoy = fechaIso(new Date())
  const cuota = await Cuota.findByPk(idCuota, {
    include: [
      {
        model: Venta,
        as: 'venta',
        attributes: ['idVenta', 'numeroComprobante', 'cantidadCuotas', 'fechaHora', 'estado'],
        include: [{
          model: Cliente,
          as: 'cliente',
          attributes: ['idCliente'],
          include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre', 'telefonoWhatsapp'] }],
        }],
      },
      { model: MedioPago, as: 'medioPago', attributes: ['idMedioPago', 'nombre'] },
      { model: Usuario, as: 'cobradoPor', attributes: ['idUsuario', 'nombreUsuario'] },
    ],
  })
  if (!cuota) throw new NoEncontrado('La cuota')
  return formatearCuota(cuota.get({ plain: true }), hoy)
}

const formatearCuota = (cuota, hoy) => ({
  idCuota: cuota.idCuota,
  numeroCuota: Number(cuota.numeroCuota),
  importe: Number(cuota.importe),
  fechaVencimiento: cuota.fechaVencimiento,
  fechaCobro: cuota.fechaCobro ?? null,
  estado: estadoCuota(cuota, hoy),
  diasAtraso: diasAtrasoCuota(cuota, hoy),
  medioPago: cuota.medioPago?.nombre ?? null,
  cobradoPor: cuota.cobradoPor?.nombreUsuario ?? null,
  venta: cuota.venta
    ? {
        idVenta: cuota.venta.idVenta,
        numeroComprobante: cuota.venta.numeroComprobante,
        cantidadCuotas: Number(cuota.venta.cantidadCuotas),
        fechaHora: cuota.venta.fechaHora,
      }
    : null,
  cliente: cuota.venta?.cliente
    ? {
        idCliente: cuota.venta.cliente.idCliente,
        apellidoNombre: cuota.venta.cliente.persona?.apellidoNombre ?? 'Sin nombre',
        telefonoWhatsapp: cuota.venta.cliente.persona?.telefonoWhatsapp ?? null,
      }
    : null,
})

/**
 * RF20.3 — consulta paginada de cuotas por cobrar, vencidas o cobradas,
 * con resumen calculado en SQL sobre el mismo conjunto filtrado.
 */
export const listarCuotas = async ({ estado = 'POR_COBRAR', idCliente, desde, hasta, limit, offset }) => {
  const hoy = fechaIso(new Date())

  const dondeCuota = {}
  if (estado === 'POR_COBRAR') {
    dondeCuota.fechaCobro = null
  } else if (estado === 'PENDIENTE') {
    dondeCuota.fechaCobro = null
    dondeCuota.fechaVencimiento = { [Op.gte]: hoy }
  } else if (estado === 'VENCIDA') {
    dondeCuota.fechaCobro = null
    dondeCuota.fechaVencimiento = { [Op.lt]: hoy }
  } else if (estado === 'COBRADA') {
    dondeCuota.fechaCobro = { [Op.ne]: null }
  }

  if (desde || hasta) {
    dondeCuota.fechaVencimiento = {
      ...(dondeCuota.fechaVencimiento ?? {}),
      ...(desde ? { [Op.gte]: desde } : {}),
      ...(hasta ? { [Op.lte]: hasta } : {}),
    }
  }

  const dondeVenta = { estado: 'CONFIRMADA' }
  if (idCliente) dondeVenta.idCliente = idCliente

  const resultado = await Cuota.findAndCountAll({
    where: dondeCuota,
    include: [
      {
        model: Venta,
        as: 'venta',
        where: dondeVenta,
        attributes: ['idVenta', 'numeroComprobante', 'cantidadCuotas', 'fechaHora'],
        include: [{
          model: Cliente,
          as: 'cliente',
          attributes: ['idCliente'],
          include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre', 'telefonoWhatsapp'] }],
        }],
      },
      { model: MedioPago, as: 'medioPago', attributes: ['idMedioPago', 'nombre'] },
      { model: Usuario, as: 'cobradoPor', attributes: ['idUsuario', 'nombreUsuario'] },
    ],
    order: [['fechaVencimiento', 'ASC'], ['idVenta', 'ASC'], ['numeroCuota', 'ASC']],
    limit,
    offset,
  })

  const filtroSqlEstado = {
    POR_COBRAR: 'c.fecha_cobro IS NULL',
    PENDIENTE: 'c.fecha_cobro IS NULL AND c.fecha_vencimiento >= :hoy',
    VENCIDA: 'c.fecha_cobro IS NULL AND c.fecha_vencimiento < :hoy',
    COBRADA: 'c.fecha_cobro IS NOT NULL',
    TODAS: '1=1',
  }[estado] ?? 'c.fecha_cobro IS NULL'

  const [[resumen]] = await sequelize.query(`
    SELECT COALESCE(SUM(CASE WHEN c.fecha_cobro IS NULL THEN c.importe ELSE 0 END), 0) AS saldoAdeudado,
           COALESCE(SUM(CASE WHEN c.fecha_cobro IS NULL AND c.fecha_vencimiento < :hoy THEN c.importe ELSE 0 END), 0) AS saldoVencido,
           COUNT(DISTINCT CASE WHEN c.fecha_cobro IS NULL THEN v.id_cliente END) AS clientesConDeuda
      FROM cuota c
      JOIN venta v ON v.id_venta = c.id_venta
     WHERE v.estado = 'CONFIRMADA'
       AND ${filtroSqlEstado}
       AND (:idCliente IS NULL OR v.id_cliente = :idCliente)
       AND (:desde IS NULL OR c.fecha_vencimiento >= :desde)
       AND (:hasta IS NULL OR c.fecha_vencimiento <= :hasta)
  `, {
    replacements: {
      hoy,
      idCliente: idCliente ?? null,
      desde: desde ?? null,
      hasta: hasta ?? null,
    },
  })

  return {
    count: resultado.count,
    rows: resultado.rows.map((c) => formatearCuota(c.get({ plain: true }), hoy)),
    resumen: {
      saldoAdeudado: Number(resumen?.saldoAdeudado ?? 0),
      saldoVencido: Number(resumen?.saldoVencido ?? 0),
      clientesConDeuda: Number(resumen?.clientesConDeuda ?? 0),
    },
  }
}

