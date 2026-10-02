import { Router } from 'express'
import { z } from 'zod'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { servicioCategorias, servicioMarcas } from './clasificaciones.servicio.js'

// RF07 — el controlador de las dos colecciones es el mismo, parametrizado.

const esquemaNombre = z.object({
  nombre: z.string().trim().min(2, 'Necesita al menos dos caracteres.').max(60),
})

const esquemaId = z.coerce.number().int().positive()

const armar = (servicio, parametro) => {
  const rutas = Router()

  rutas.use(autenticar)
  const leer = autorizar('CATALOGO_STOCK', 'lectura')
  const escribir = autorizar('CATALOGO_STOCK', 'escritura')

  rutas.get('/', leer, async (_peticion, respuesta) =>
    respuesta.json({ datos: await servicio.listar() }))

  rutas.post('/', escribir, async (peticion, respuesta) =>
    respuesta.status(201).json({ datos: await servicio.registrar(esquemaNombre.parse(peticion.body)) }))

  rutas.put(`/:${parametro}`, escribir, async (peticion, respuesta) =>
    respuesta.json({
      datos: await servicio.modificar(
        esquemaId.parse(peticion.params[parametro]),
        esquemaNombre.parse(peticion.body),
      ),
    }))

  rutas.delete(`/:${parametro}`, escribir, async (peticion, respuesta) => {
    await servicio.darDeBaja(esquemaId.parse(peticion.params[parametro]))
    return respuesta.status(204).send()
  })

  return rutas
}

export const rutasCategorias = armar(servicioCategorias, 'idCategoria')
export const rutasMarcas = armar(servicioMarcas, 'idMarca')
