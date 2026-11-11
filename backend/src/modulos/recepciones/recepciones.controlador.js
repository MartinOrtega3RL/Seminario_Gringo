import { unlink } from 'node:fs/promises'
import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { DatosInvalidos } from '../../errores.js'
import {
  crearRecepcionManual,
  crearRecepcionOcr,
  listarRecepciones,
  listarProveedoresActivos,
  buscarRecepcion,
  rutaImagenComprobante,
  actualizarLineas,
  confirmarRecepcion,
  eliminarRecepcion,
} from './recepciones.servicio.js'

const id = z.coerce.number().int().positive()
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD.')
const tipoComprobante = z.enum(['FACTURA', 'REMITO', 'OTRO'])

const esquemaLinea = z.object({
  idProducto: z.coerce.number().int().positive().nullable().optional(),
  descripcionOriginal: z.string().trim().max(200).nullish().transform((v) => v || null),
  cantidad: z.coerce.number().int().min(1, 'La cantidad debe ser al menos 1.').max(999_999),
  precioCosto: z.coerce.number().min(0, 'El costo no puede ser negativo.').max(99_999_999),
})

const esquemaManual = z.object({
  idProveedor: id,
  tipoComprobante: tipoComprobante.default('FACTURA'),
  numeroComprobante: z.string().trim().max(40).nullish().transform((v) => v || null),
  fechaComprobante: fecha.nullish().transform((v) => v || null),
  lineas: z.array(esquemaLinea.extend({
    idProducto: z.coerce.number().int().positive(),
  })).min(1, 'La recepción necesita al menos una línea.').max(200),
})

const esquemaOcrCampos = z.object({
  idProveedor: id,
  tipoComprobante: tipoComprobante.default('FACTURA'),
  numeroComprobante: z.string().trim().max(40).nullish().transform((v) => v || null),
  fechaComprobante: fecha.nullish().transform((v) => v || null),
})

const esquemaFiltros = z.object({
  estado: z.enum(['PENDIENTE_VALIDACION', 'CONFIRMADA', 'ANULADA', 'TODAS']).optional(),
  idProveedor: id.optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
})

const esquemaActualizarLineas = z.object({
  lineas: z.array(esquemaLinea).max(200),
})

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const filtros = esquemaFiltros.parse(peticion.query)

  const resultado = await listarRecepciones({
    ...filtros,
    limit: paginacion.limit,
    offset: paginacion.offset,
  })
  return respuesta.json(responderPaginado(resultado, paginacion))
}

export const detalle = async (peticion, respuesta) =>
  respuesta.json({ datos: await buscarRecepcion(id.parse(peticion.params.id)) })

export const imagen = async (peticion, respuesta) => {
  const ruta = await rutaImagenComprobante(id.parse(peticion.params.id))
  respuesta.set('Cache-Control', 'private, max-age=3600')
  return respuesta.sendFile(ruta)
}

export const crearManual = async (peticion, respuesta) => {
  const datos = esquemaManual.parse(peticion.body)
  const recepcion = await crearRecepcionManual(datos, peticion.usuario.idUsuario)
  return respuesta.status(201).json({ datos: recepcion })
}

export const crearOcr = async (peticion, respuesta) => {
  let campos
  try {
    if (!peticion.file) throw new DatosInvalidos('Subí la imagen del comprobante (JPG o PNG).')
    campos = esquemaOcrCampos.parse(peticion.body)
  } catch (error) {
    if (peticion.file) await unlink(peticion.file.path).catch(() => {})
    throw error
  }

  const recepcion = await crearRecepcionOcr(
    { ...campos, archivo: peticion.file },
    peticion.usuario.idUsuario,
  )
  return respuesta.status(201).json({ datos: recepcion })
}

export const guardarLineas = async (peticion, respuesta) => {
  const { lineas } = esquemaActualizarLineas.parse(peticion.body)
  return respuesta.json({ datos: await actualizarLineas(id.parse(peticion.params.id), lineas) })
}

export const confirmar = async (peticion, respuesta) =>
  respuesta.json({
    datos: await confirmarRecepcion(id.parse(peticion.params.id), peticion.usuario.idUsuario),
  })

export const eliminar = async (peticion, respuesta) => {
  await eliminarRecepcion(id.parse(peticion.params.id))
  respuesta.status(204).end()
}

export const proveedores = async (_peticion, respuesta) =>
  respuesta.json({ datos: await listarProveedoresActivos() })
