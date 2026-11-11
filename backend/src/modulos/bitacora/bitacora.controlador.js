import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { ACCIONES_BITACORA } from './bitacora.reglas.js'
import { listarBitacora } from './bitacora.servicio.js'

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD.')

const esquemaFiltros = z.object({
  desde: FECHA.optional(),
  hasta: FECHA.optional(),
  idUsuario: z.coerce.number().int().positive().optional(),
  entidad: z.string().trim().min(1).max(60).optional(),
  accion: z.enum(ACCIONES_BITACORA).optional(),
})

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const filtros = esquemaFiltros.parse({
    desde: peticion.query.desde || undefined,
    hasta: peticion.query.hasta || undefined,
    idUsuario: peticion.query.idUsuario || undefined,
    entidad: peticion.query.entidad || undefined,
    accion: peticion.query.accion || undefined,
  })

  const resultado = await listarBitacora({ ...filtros, ...paginacion })
  return respuesta.json(responderPaginado(resultado, paginacion))
}

