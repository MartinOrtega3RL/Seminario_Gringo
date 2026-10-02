import { Router } from 'express'
import { z } from 'zod'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { recibirImagen } from './imagen.js'
import { buscarProducto } from './catalogo.servicio.js'
import {
  listar, detalle, registrar, modificar, subirImagen, darDeBaja, preciosMasivos,
} from './catalogo.controlador.js'

const esquemaId = z.coerce.number().int().positive()

export const crearRutasCatalogo = ({ generadorEtiqueta }) => {
  const rutas = Router()

  rutas.use(autenticar)
  const leer = autorizar('CATALOGO_STOCK', 'lectura')
  const escribir = autorizar('CATALOGO_STOCK', 'escritura')

  // Antes de /:idProducto, o Express tomaria "precios" como identificador.
  rutas.post('/precios', escribir, preciosMasivos)

  rutas.get('/', leer, listar)
  rutas.post('/', escribir, registrar)

  rutas.get('/:idProducto', leer, detalle)
  rutas.put('/:idProducto', escribir, modificar)
  rutas.delete('/:idProducto', escribir, darDeBaja)

  rutas.post('/:idProducto/imagen', escribir, recibirImagen, subirImagen)

  // RF09.2 — el pliego de etiquetas. El precio que lleva impreso es el
  // minorista; el costo no aparece nunca en un papel que va a la gondola.
  rutas.get('/:idProducto/etiqueta', leer, async (peticion, respuesta) => {
    const producto = await buscarProducto(esquemaId.parse(peticion.params.idProducto), peticion.usuario.perfil)
    const cantidad = z.coerce.number().int().min(1).max(60).default(12).parse(peticion.query.cantidad ?? 12)

    const emitida = await generadorEtiqueta.generar(producto, cantidad)
    respuesta.type(emitida.tipoMime)
    return respuesta.send(emitida.contenido)
  })

  return rutas
}
