import { Router } from 'express'
import { z } from 'zod'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import {
  listarMovimientos, registrarIngreso, registrarAjuste, registrarConsumoReparacion,
} from './existencias.servicio.js'

// En ninguna de estas rutas viaja el id del usuario: el responsable de todo
// movimiento sale del token. Si se aceptara del cuerpo, cualquiera podria
// registrar un ajuste a nombre de otro.

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD.')

const esquemaFiltros = z.object({
  idProducto: z.coerce.number().int().positive().optional(),
  tipo: z.enum(['INGRESO', 'VENTA', 'REPARACION', 'AJUSTE', 'DEVOLUCION']).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
})

const esquemaIngreso = z.object({
  lineas: z.array(z.object({
    idProducto: z.coerce.number().int().positive(),
    cantidad: z.coerce.number().int().min(1).max(999_999),
  })).min(1, 'El ingreso necesita al menos un producto.').max(100),
  observaciones: z.string().trim().max(200).nullish().transform((v) => v || null),
})

const esquemaAjuste = z.object({
  idProducto: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().refine((v) => v !== 0, 'Cero no es un ajuste.'),
  motivo: z.string().trim().min(4, 'Escribí por qué se ajusta.').max(200),
})

const esquemaConsumo = z.object({
  idProducto: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().min(1).max(9_999),
  motivo: z.string().trim().min(4, 'Indicá para qué reparación se usó.').max(200),
  // Queda listo para cuando exista el modulo de servicio tecnico (RF21).
  idOrden: z.coerce.number().int().positive().nullish(),
})

export const rutasExistencias = Router()

rutasExistencias.use(autenticar)
const leer = autorizar('CATALOGO_STOCK', 'lectura')
const escribir = autorizar('CATALOGO_STOCK', 'escritura')

// RF12.4
rutasExistencias.get('/movimientos', leer, async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const filtros = esquemaFiltros.parse(peticion.query)

  const resultado = await listarMovimientos({
    ...filtros,
    limit: paginacion.limit,
    offset: paginacion.offset,
  })

  return respuesta.json(responderPaginado(resultado, paginacion))
})

// RF11.1
rutasExistencias.post('/ingreso', escribir, async (peticion, respuesta) =>
  respuesta.status(201).json({
    datos: await registrarIngreso(esquemaIngreso.parse(peticion.body), peticion.usuario.idUsuario),
  }))

// RF11.5
rutasExistencias.post('/ajuste', escribir, async (peticion, respuesta) =>
  respuesta.status(201).json({
    datos: await registrarAjuste(esquemaAjuste.parse(peticion.body), peticion.usuario.idUsuario),
  }))

// RF11.3 — el consumo de repuestos que hoy se anota en una planilla (H29).
rutasExistencias.post('/consumo-reparacion', escribir, async (peticion, respuesta) =>
  respuesta.status(201).json({
    datos: await registrarConsumoReparacion(esquemaConsumo.parse(peticion.body), peticion.usuario.idUsuario),
  }))
