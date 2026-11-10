import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { rangoMesEnCurso } from './reportes.reglas.js'
import {
  reporteVentas,
  reporteStockBajoMinimo,
  reporteValorizacion,
  reporteServicio,
} from './reportes.servicio.js'

const FECHA = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe tener formato AAAA-MM-DD.')

const leerPeriodo = (consulta) => {
  const defecto = rangoMesEnCurso()
  return z.object({
    desde: FECHA.optional(),
    hasta: FECHA.optional(),
  }).transform((valores) => ({
    desde: valores.desde ?? defecto.desde,
    hasta: valores.hasta ?? defecto.hasta,
  })).parse(consulta)
}

export const ventas = async (peticion, respuesta) => {
  const periodo = leerPeriodo(peticion.query)
  const datos = await reporteVentas(periodo)
  return respuesta.json({ datos })
}

export const stockBajoMinimo = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const resultado = await reporteStockBajoMinimo(paginacion)
  return respuesta.json(responderPaginado(resultado, paginacion))
}

export const valorizacion = async (peticion, respuesta) => {
  const datos = await reporteValorizacion(peticion.usuario.perfil)
  return respuesta.json({ datos })
}

export const servicio = async (peticion, respuesta) => {
  const periodo = leerPeriodo(peticion.query)
  const datos = await reporteServicio(periodo)
  return respuesta.json({ datos })
}

