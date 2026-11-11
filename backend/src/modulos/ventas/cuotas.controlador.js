import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { listarCuotas, cobrarCuota } from './cuotas.servicio.js'

const esquemaId = z.coerce.number().int().positive()
const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD.')

const esquemaFiltros = z.object({
  estado: z.enum(['POR_COBRAR', 'PENDIENTE', 'VENCIDA', 'COBRADA', 'TODAS']).default('POR_COBRAR'),
  idCliente: esquemaId.optional(),
  desde: FECHA.optional(),
  hasta: FECHA.optional(),
})

const esquemaCobro = z.object({
  idMedioPago: esquemaId,
})

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const filtros = esquemaFiltros.parse({
    estado: peticion.query.estado || undefined,
    idCliente: peticion.query.idCliente || undefined,
    desde: peticion.query.desde || undefined,
    hasta: peticion.query.hasta || undefined,
  })

  const { resumen, ...resultado } = await listarCuotas({ ...filtros, ...paginacion })
  return respuesta.json({ ...responderPaginado(resultado, paginacion), resumen })
}

export const cobrar = async (peticion, respuesta) => {
  const idCuota = esquemaId.parse(peticion.params.idCuota)
  const { idMedioPago } = esquemaCobro.parse(peticion.body)
  const cuota = await cobrarCuota(idCuota, { idMedioPago }, peticion.usuario.idUsuario)
  return respuesta.json({ datos: cuota })
}

