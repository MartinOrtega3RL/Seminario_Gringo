import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { OrdenServicio, EstadoOrden, FotoOrden, RepuestoUtilizado, TareaRealizada, Producto, Cliente, TipoCliente } from '../../modelos/index.js'
import { descontarPorReparacion, restituirPorReparacion } from '../existencias/existencias.servicio.js'
import { resolverLista, precioSegunLista } from '../ventas/ventas.reglas.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { operar, exigir, tecnicoSiFalta } from './ordenes.nucleo.js'
import { CARPETA_FOTOS } from './fotos.js'

const log = registroDe('servicio')

// Lo que el tecnico hace con las manos mientras repara: gastar repuestos,
// anotar lo hecho y fotografiar. Ninguna de estas operaciones cambia el estado
// de la orden; por eso viven aparte del ciclo de vida.

const asignarTecnico = async (orden, idUsuario, transaction) => {
  const cambios = tecnicoSiFalta(orden, idUsuario)
  if (Object.keys(cambios).length > 0) await orden.update(cambios, { transaction })
}

/**
 * RF22.4 — repuesto usado en la reparacion, afectando las existencias.
 *
 * El descuento del stock y el renglon de la orden se escriben en la MISMA
 * transaccion: si el repuesto no alcanza, nada queda a medias. Es la guarda
 * atomica de existencias la que decide (RNF14), no una lectura previa de este
 * modulo: dos tecnicos tomando el ultimo repuesto a la vez no pasan los dos.
 */
export const registrarRepuesto = (idOrden, { idProducto, cantidad }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('repuestos', estado, 'cargar repuestos en')

    const producto = await Producto.findByPk(idProducto, { transaction })
    if (!producto || !producto.activo) throw new NoEncontrado('El repuesto')

    // El precio sale de la misma lista que en una venta: la que corresponde al
    // cliente de la orden (RF16.5). Se congela, igual que el costo.
    const cliente = await Cliente.findByPk(orden.idCliente, {
      include: [{ model: TipoCliente, as: 'tipoCliente' }],
      transaction,
    })

    await descontarPorReparacion({
      idProducto, cantidad, idUsuario, idOrden, motivo: `Orden ${orden.numeroOrden}`,
    }, transaction)

    await RepuestoUtilizado.create({
      idOrden,
      idProducto,
      cantidad,
      precioUnitario: precioSegunLista(producto, resolverLista(cliente)),
      costoUnitario: producto.precioCosto,
    }, { transaction })

    await asignarTecnico(orden, idUsuario, transaction)
    log.info({ idOrden, idProducto, cantidad, usuario: idUsuario }, 'repuesto cargado en la orden')
  })

/** Quitar un repuesto cargado por error: la unidad vuelve al stock y queda el movimiento. */
export const quitarRepuesto = (idOrden, idRepuesto, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('repuestos', estado, 'modificar los repuestos de')

    const repuesto = await RepuestoUtilizado.findOne({
      where: { idRepuestoUtilizado: idRepuesto, idOrden },
      transaction,
    })
    if (!repuesto) throw new NoEncontrado('El repuesto de la orden')

    await restituirPorReparacion({
      idProducto: repuesto.idProducto,
      cantidad: repuesto.cantidad,
      idUsuario,
      idOrden,
      motivo: `Repuesto quitado de la orden ${orden.numeroOrden}`,
    }, transaction)

    await repuesto.destroy({ transaction })
    log.info({ idOrden, idRepuesto, usuario: idUsuario }, 'repuesto quitado de la orden')
  })

/** RF22.5 — lo efectivamente realizado: es lo que delimita la garantia (H07). */
export const registrarTarea = (idOrden, { descripcion }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('tareas', estado, 'registrar tareas en')

    await TareaRealizada.create({
      idOrden, idUsuario, descripcion, fechaHora: new Date(),
    }, { transaction })

    await asignarTecnico(orden, idUsuario, transaction)
    log.info({ idOrden, usuario: idUsuario }, 'tarea registrada')
  })

// --- Fotografias (RF21.7) --------------------------------------------------------

/**
 * Si la orden no existe o no admite fotos, el archivo ya esta en disco: multer
 * lo escribio antes de que se supiera. Se lo borra para no dejar huerfanos que
 * nadie va a limpiar nunca.
 */
export const registrarFoto = async (idOrden, { archivo, momento, descripcion }) => {
  try {
    const orden = await OrdenServicio.findByPk(idOrden, { include: [{ model: EstadoOrden, as: 'estado' }] })
    if (!orden) throw new NoEncontrado('La orden de servicio')
    if (orden.estado.codigo === 'ANULADA') throw new DatosInvalidos('La orden está anulada: ya no admite fotos.')

    return await FotoOrden.create({
      idOrden,
      imagenRuta: archivo.filename,
      momentoCaptura: momento,
      fechaHora: new Date(),
      descripcion: descripcion ?? null,
    })
  } catch (error) {
    await unlink(archivo.path).catch(() => {})
    throw error
  }
}

/** Ruta en disco de una foto de la orden. El nombre sale de la base, no del pedido. */
export const rutaDeFoto = async (idOrden, idFoto) => {
  const foto = await FotoOrden.findOne({ where: { idFoto, idOrden } })
  if (!foto) throw new NoEncontrado('La foto')
  return join(CARPETA_FOTOS, foto.imagenRuta)
}
