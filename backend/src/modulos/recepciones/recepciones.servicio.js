import { access, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import {
  RecepcionMercaderia,
  OcrExtraccion,
  DetalleRecepcion,
  Proveedor,
  Persona,
  Producto,
  Usuario,
} from '../../modelos/index.js'
import { registrarIngreso } from '../existencias/existencias.servicio.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'
import { inicioDeDia, finDeDia } from '../../http/fechas.js'
import { DatosInvalidos, NoEncontrado } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { CARPETA_COMPROBANTES } from './comprobantes.js'
import { procesarImagenOcr } from './ocr.js'
import {
  extraerLineas,
  calcularTotalRecepcion,
  consultaSugerenciaProducto,
  productoSugerible,
} from './recepciones.reglas.js'

const log = registroDe('recepciones')

const CONFIANZA_MINIMA_SUGERENCIA = 40

const RELACIONES_RECEPCION = [
  {
    model: Proveedor,
    as: 'proveedor',
    attributes: ['idProveedor'],
    include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre', 'numeroDocumento'] }],
  },
  { model: Usuario, as: 'usuario', attributes: ['idUsuario', 'nombreUsuario'] },
  {
    model: OcrExtraccion,
    as: 'extraccion',
    attributes: [
      'idExtraccion',
      'fechaProcesamiento',
      'motorOcr',
      'textoExtraido',
      'confianzaPromedio',
      'estado',
      'mensajeError',
    ],
  },
  {
    model: DetalleRecepcion,
    as: 'lineas',
    // RF04.2: nunca exponemos producto.precioCosto en recepciones; solo el
    // costo declarado en el comprobante (DetalleRecepcion.precioCosto).
    include: [{
      model: Producto,
      as: 'producto',
      attributes: ['idProducto', 'codigoInterno', 'denominacion', 'stockActual'],
    }],
  },
]

const formatearRecepcion = (r) => ({
  idRecepcion: r.idRecepcion,
  idProveedor: r.idProveedor,
  proveedor: r.proveedor
    ? {
        idProveedor: r.proveedor.idProveedor,
        nombre: r.proveedor.persona?.apellidoNombre ?? 'Sin nombre',
        cuit: r.proveedor.persona?.numeroDocumento ?? null,
      }
    : null,
  usuario: r.usuario ? { idUsuario: r.usuario.idUsuario, nombreUsuario: r.usuario.nombreUsuario } : null,
  tipoComprobante: r.tipoComprobante,
  numeroComprobante: r.numeroComprobante,
  fechaComprobante: r.fechaComprobante,
  fechaRegistro: r.fechaRegistro,
  origenCarga: r.origenCarga,
  tieneImagen: Boolean(r.imagenComprobante),
  estado: r.estado,
  montoTotal: Number(r.montoTotal ?? 0),
  fechaConfirmacion: r.fechaConfirmacion,
  extraccion: r.extraccion
    ? {
        idExtraccion: r.extraccion.idExtraccion,
        fechaProcesamiento: r.extraccion.fechaProcesamiento,
        motorOcr: r.extraccion.motorOcr,
        textoExtraido: r.extraccion.textoExtraido,
        confianzaPromedio: r.extraccion.confianzaPromedio !== null
          ? Number(r.extraccion.confianzaPromedio)
          : null,
        estado: r.extraccion.estado,
        mensajeError: r.extraccion.mensajeError,
      }
    : null,
  lineas: (r.lineas ?? []).map((l) => ({
    idDetalleRecepcion: l.idDetalleRecepcion,
    idProducto: l.idProducto,
    producto: l.producto
      ? {
          idProducto: l.producto.idProducto,
          codigoInterno: l.producto.codigoInterno,
          denominacion: l.producto.denominacion,
          stockActual: Number(l.producto.stockActual ?? 0),
        }
      : null,
    descripcionOriginal: l.descripcionOriginal,
    cantidad: Number(l.cantidad),
    precioCosto: Number(l.precioCosto),
    validado: Boolean(l.validado),
  })),
})

const verificarProveedor = async (idProveedor, transaction) => {
  const proveedor = await Proveedor.findOne({
    where: { idProveedor, activo: true },
    include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre'] }],
    transaction,
  })
  if (!proveedor) throw new NoEncontrado('El proveedor')
  return proveedor
}

const verificarProductosActivos = async (lineas, transaction) => {
  const ids = [...new Set(lineas.map((l) => l.idProducto).filter(Boolean))]
  if (ids.length === 0) return

  const encontrados = await Producto.findAll({
    where: { idProducto: ids, activo: true },
    attributes: ['idProducto'],
    transaction,
  })
  if (encontrados.length !== ids.length) {
    throw new NoEncontrado('Uno de los productos indicados')
  }
}

const manejarDuplicadoComprobante = (error) => {
  if (error?.name === 'SequelizeUniqueConstraintError') {
    throw new DatosInvalidos(
      'Ya existe una recepción con ese tipo y número de comprobante para el proveedor seleccionado.',
    )
  }
  throw error
}

/**
 * Busca la mejor sugerencia en el catalogo usando el indice FULLTEXT que ya
 * usa la busqueda de productos. El FULLTEXT trae candidatos con que coincida
 * una sola palabra; de los mejores se toma el primero que pase
 * productoSugerible. Si ninguno pasa, la linea queda sin producto y el
 * usuario lo elige o lo crea.
 */
const sugerirProductoFulltext = async (descripcion) => {
  const consulta = consultaSugerenciaProducto(descripcion)
  if (!consulta) return null

  const [candidatos] = await sequelize.query(`
    SELECT p.id_producto AS idProducto,
           p.denominacion,
           m.nombre AS marca,
           MATCH (p.denominacion, p.descripcion) AGAINST (:consulta IN BOOLEAN MODE) AS relevancia
      FROM producto p
      JOIN marca m ON m.id_marca = p.id_marca
     WHERE p.activo = 1
       AND MATCH (p.denominacion, p.descripcion) AGAINST (:consulta IN BOOLEAN MODE)
     ORDER BY relevancia DESC
     LIMIT 5
  `, { replacements: { consulta } })

  return candidatos.find((candidato) => productoSugerible(descripcion, candidato))?.idProducto ?? null
}

/** RF10.1 — alta manual de recepcion en estado PENDIENTE_VALIDACION. */
export const crearRecepcionManual = async (datos, idUsuario) => {
  const { idProveedor, tipoComprobante, numeroComprobante, fechaComprobante, lineas } = datos

  let idRecepcion
  try {
    idRecepcion = await sequelize.transaction(async (transaction) => {
      await verificarProveedor(idProveedor, transaction)
      await verificarProductosActivos(lineas, transaction)

      const montoTotal = calcularTotalRecepcion(lineas)
      const recepcion = await RecepcionMercaderia.create({
        idProveedor,
        idUsuario,
        tipoComprobante,
        numeroComprobante: numeroComprobante || null,
        fechaComprobante: fechaComprobante || null,
        origenCarga: 'MANUAL',
        estado: 'PENDIENTE_VALIDACION',
        montoTotal,
      }, { transaction })

      await DetalleRecepcion.bulkCreate(
        lineas.map((l) => ({
          idRecepcion: recepcion.idRecepcion,
          idProducto: l.idProducto,
          descripcionOriginal: null,
          cantidad: l.cantidad,
          precioCosto: l.precioCosto,
          validado: false,
        })),
        { transaction },
      )

      return recepcion.idRecepcion
    })
  } catch (error) {
    manejarDuplicadoComprobante(error)
  }

  log.info({ idRecepcion, usuario: idUsuario }, 'recepcion manual registrada')
  return buscarRecepcion(idRecepcion)
}

/**
 * RF10.2 — alta con imagen del comprobante y procesamiento OCR en servidor.
 * Si el motor falla o la foto es mala, la recepcion queda igual con la
 * extraccion en estado ERROR para que el usuario cargue las lineas a mano.
 */
export const crearRecepcionOcr = async ({ idProveedor, tipoComprobante, numeroComprobante, fechaComprobante, archivo }, idUsuario) => {
  let recepcion
  try {
    recepcion = await sequelize.transaction(async (transaction) => {
      await verificarProveedor(idProveedor, transaction)

      return RecepcionMercaderia.create({
        idProveedor,
        idUsuario,
        tipoComprobante,
        numeroComprobante: numeroComprobante || null,
        fechaComprobante: fechaComprobante || null,
        origenCarga: 'OCR',
        imagenComprobante: archivo.filename,
        estado: 'PENDIENTE_VALIDACION',
        montoTotal: 0,
      }, { transaction })
    })
  } catch (error) {
    await unlink(archivo.path).catch(() => {})
    manejarDuplicadoComprobante(error)
  }

  // El OCR corre fuera de la transaccion para no retener bloqueos en MySQL
  // mientras procesa la imagen.
  const resultadoOcr = await procesarImagenOcr(archivo.path)
  const lineasExtraidas = resultadoOcr.ok
    ? (resultadoOcr.lineas ?? extraerLineas(resultadoOcr.texto))
    : []

  const lineasConSugerencia = []
  const sugerir = resultadoOcr.ok && (resultadoOcr.confianza ?? 0) >= CONFIANZA_MINIMA_SUGERENCIA
  for (const linea of lineasExtraidas) {
    const idProducto = sugerir
      ? await sugerirProductoFulltext(linea.descripcionOriginal).catch(() => null)
      : null
    lineasConSugerencia.push({
      idRecepcion: recepcion.idRecepcion,
      idProducto,
      descripcionOriginal: linea.descripcionOriginal,
      cantidad: linea.cantidad,
      precioCosto: linea.precioCosto,
      validado: false,
    })
  }

  await sequelize.transaction(async (transaction) => {
    await OcrExtraccion.create({
      idRecepcion: recepcion.idRecepcion,
      motorOcr: resultadoOcr.motor,
      textoExtraido: resultadoOcr.texto,
      confianzaPromedio: resultadoOcr.confianza,
      estado: resultadoOcr.ok ? 'PROCESADO' : 'ERROR',
      mensajeError: resultadoOcr.error,
    }, { transaction })

    if (lineasConSugerencia.length > 0) {
      await DetalleRecepcion.bulkCreate(lineasConSugerencia, { transaction })
      await recepcion.update({ montoTotal: calcularTotalRecepcion(lineasConSugerencia) }, { transaction })
    }
  })

  log.info({
    idRecepcion: recepcion.idRecepcion,
    ok: resultadoOcr.ok,
    confianza: resultadoOcr.confianza,
    lineas: lineasConSugerencia.length,
  }, 'recepcion OCR procesada')

  return buscarRecepcion(recepcion.idRecepcion)
}

export const listarRecepciones = async ({ estado, idProveedor, desde, hasta, limit, offset }) => {
  const where = {}
  if (estado && estado !== 'TODAS') where.estado = estado
  if (idProveedor) where.idProveedor = idProveedor
  if (desde || hasta) {
    where.fechaRegistro = {
      ...(desde ? { [Op.gte]: inicioDeDia(desde) } : {}),
      ...(hasta ? { [Op.lte]: finDeDia(hasta) } : {}),
    }
  }

  const resultado = await RecepcionMercaderia.findAndCountAll({
    where,
    include: [
      {
        model: Proveedor,
        as: 'proveedor',
        attributes: ['idProveedor'],
        include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre'] }],
      },
      { model: Usuario, as: 'usuario', attributes: ['idUsuario', 'nombreUsuario'] },
      { model: OcrExtraccion, as: 'extraccion', attributes: ['confianzaPromedio', 'estado'] },
    ],
    order: [['fechaRegistro', 'DESC'], ['idRecepcion', 'DESC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

  return {
    count: resultado.count,
    rows: resultado.rows.map((r) => ({
      idRecepcion: r.idRecepcion,
      idProveedor: r.idProveedor,
      proveedor: r.proveedor?.persona?.apellidoNombre ?? 'Sin nombre',
      usuario: r.usuario?.nombreUsuario ?? null,
      tipoComprobante: r.tipoComprobante,
      numeroComprobante: r.numeroComprobante,
      fechaComprobante: r.fechaComprobante,
      fechaRegistro: r.fechaRegistro,
      origenCarga: r.origenCarga,
      estado: r.estado,
      montoTotal: Number(r.montoTotal ?? 0),
      confianzaOcr: r.extraccion?.confianzaPromedio !== null && r.extraccion?.confianzaPromedio !== undefined
        ? Number(r.extraccion.confianzaPromedio)
        : null,
      estadoOcr: r.extraccion?.estado ?? null,
    })),
  }
}

export const buscarRecepcion = async (idRecepcion) => {
  const recepcion = await RecepcionMercaderia.findByPk(idRecepcion, {
    include: RELACIONES_RECEPCION,
    order: [[{ model: DetalleRecepcion, as: 'lineas' }, 'idDetalleRecepcion', 'ASC']],
  })
  if (!recepcion) throw new NoEncontrado('La recepción')
  return formatearRecepcion(recepcion)
}

export const rutaImagenComprobante = async (idRecepcion) => {
  const recepcion = await RecepcionMercaderia.findByPk(idRecepcion, {
    attributes: ['idRecepcion', 'imagenComprobante'],
  })
  if (!recepcion || !recepcion.imagenComprobante) {
    throw new NoEncontrado('La imagen del comprobante')
  }

  const ruta = join(CARPETA_COMPROBANTES, recepcion.imagenComprobante)
  try {
    await access(ruta)
  } catch {
    throw new NoEncontrado('La imagen del comprobante')
  }
  return ruta
}

/** RF10.3 — edita las lineas mientras la recepcion esta pendiente. */
export const actualizarLineas = async (idRecepcion, lineas) => {
  await sequelize.transaction(async (transaction) => {
    const recepcion = await RecepcionMercaderia.findByPk(idRecepcion, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    })
    if (!recepcion) throw new NoEncontrado('La recepción')
    if (recepcion.estado !== 'PENDIENTE_VALIDACION') {
      throw new DatosInvalidos('Solo se pueden editar las líneas de una recepción pendiente de validación.')
    }

    await verificarProductosActivos(lineas, transaction)

    await DetalleRecepcion.destroy({ where: { idRecepcion }, transaction })
    if (lineas.length > 0) {
      await DetalleRecepcion.bulkCreate(
        lineas.map((l) => ({
          idRecepcion,
          idProducto: l.idProducto ?? null,
          descripcionOriginal: l.descripcionOriginal ?? null,
          cantidad: l.cantidad,
          precioCosto: l.precioCosto,
          validado: false,
        })),
        { transaction },
      )
    }

    await recepcion.update({ montoTotal: calcularTotalRecepcion(lineas) }, { transaction })
  })

  return buscarRecepcion(idRecepcion)
}

/** RF10.3 — confirmacion atomica: existencias, costos y bitacora en una transaccion. */
export const confirmarRecepcion = async (idRecepcion, idUsuario) => {
  await sequelize.transaction(async (transaction) => {
    const recepcion = await RecepcionMercaderia.findByPk(idRecepcion, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    })
    if (!recepcion) throw new NoEncontrado('La recepción')
    if (recepcion.estado !== 'PENDIENTE_VALIDACION') {
      throw new DatosInvalidos('Esa recepción ya fue confirmada o anulada.')
    }

    const proveedor = await verificarProveedor(recepcion.idProveedor, transaction)

    const lineas = await DetalleRecepcion.findAll({
      where: { idRecepcion },
      order: [['idDetalleRecepcion', 'ASC']],
      transaction,
    })
    if (lineas.length === 0) {
      throw new DatosInvalidos('La recepción no tiene líneas cargadas para confirmar.')
    }

    const sinProducto = lineas
      .map((l, idx) => (!l.idProducto ? (l.descripcionOriginal || `Línea #${idx + 1}`) : null))
      .filter(Boolean)
    if (sinProducto.length > 0) {
      throw new DatosInvalidos(
        `Falta asociar producto en: ${sinProducto.slice(0, 5).join(', ')}${sinProducto.length > 5 ? '…' : ''}.`,
      )
    }

    const comprobante = `${recepcion.tipoComprobante}${recepcion.numeroComprobante ? ` ${recepcion.numeroComprobante}` : ` #${recepcion.idRecepcion}`}`
    const nombreProveedor = proveedor.persona?.apellidoNombre ?? `Proveedor #${proveedor.idProveedor}`

    await registrarIngreso({
      lineas: lineas.map((l) => ({ idProducto: l.idProducto, cantidad: l.cantidad })),
      observaciones: `Recepción ${comprobante} — ${nombreProveedor}`.slice(0, 200),
      idRecepcion: recepcion.idRecepcion,
    }, idUsuario, transaction)

    for (const linea of lineas) {
      await Producto.update(
        { precioCosto: linea.precioCosto },
        { where: { idProducto: linea.idProducto, activo: true }, transaction },
      )
    }

    await DetalleRecepcion.update(
      { validado: true },
      { where: { idRecepcion }, transaction },
    )

    const montoTotal = calcularTotalRecepcion(lineas)
    await recepcion.update({
      montoTotal,
      estado: 'CONFIRMADA',
      fechaConfirmacion: new Date(),
    }, { transaction })

    await registrarEnBitacora({
      entidad: 'recepcion_mercaderia',
      idRegistro: recepcion.idRecepcion,
      accion: 'ALTA',
      despues: {
        idProveedor: recepcion.idProveedor,
        proveedor: nombreProveedor,
        comprobante,
        lineas: lineas.length,
        montoTotal,
      },
      detalle: `${nombreProveedor} · ${comprobante} (${lineas.length} líneas)`,
    }, transaction)
  })

  log.info({ idRecepcion, usuario: idUsuario }, 'recepcion confirmada')
  return buscarRecepcion(idRecepcion)
}

/**
 * RF10.3 — elimina una recepcion pendiente. Una recepcion cargada por error
 * (o leida mal) no debe quedar ocupando su numero de comprobante: la base lo
 * exige unico por proveedor, y la factura real no se podria volver a cargar.
 * Solo se eliminan las pendientes, que todavia no movieron stock. Las lineas y
 * la extraccion OCR se borran en cascada. La recepcion completa queda en la
 * bitacora, y la foto se conserva en el almacen como respaldo de ese registro.
 */
export const eliminarRecepcion = async (idRecepcion) => {
  await sequelize.transaction(async (transaction) => {
    const recepcion = await RecepcionMercaderia.findByPk(idRecepcion, {
      lock: transaction.LOCK.UPDATE,
      transaction,
    })
    if (!recepcion) throw new NoEncontrado('La recepción')
    if (recepcion.estado !== 'PENDIENTE_VALIDACION') {
      throw new DatosInvalidos('Solo se puede eliminar una recepción pendiente de validación.')
    }

    const completa = await RecepcionMercaderia.findByPk(idRecepcion, {
      include: RELACIONES_RECEPCION,
      order: [[{ model: DetalleRecepcion, as: 'lineas' }, 'idDetalleRecepcion', 'ASC']],
      transaction,
    })
    const copia = { ...formatearRecepcion(completa), imagenComprobante: completa.imagenComprobante }
    const comprobante = `${copia.tipoComprobante} ${copia.numeroComprobante ?? `#${copia.idRecepcion}`}`

    await registrarEnBitacora({
      entidad: 'recepcion_mercaderia',
      idRegistro: recepcion.idRecepcion,
      accion: 'BAJA',
      antes: copia,
      despues: null,
      detalle: `Recepción eliminada: ${comprobante} de ${copia.proveedor?.nombre ?? 'proveedor sin nombre'}`,
    }, transaction)

    await recepcion.destroy({ transaction })
  })

  log.info({ idRecepcion }, 'recepcion pendiente eliminada')
}

export const listarProveedoresActivos = async () => {
  const filas = await Proveedor.findAll({
    where: { activo: true },
    attributes: ['idProveedor'],
    include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre', 'numeroDocumento'] }],
    order: [[{ model: Persona, as: 'persona' }, 'apellidoNombre', 'ASC']],
  })
  return filas.map((p) => ({
    idProveedor: p.idProveedor,
    nombre: p.persona?.apellidoNombre ?? `Proveedor #${p.idProveedor}`,
    cuit: p.persona?.numeroDocumento ?? null,
  }))
}
