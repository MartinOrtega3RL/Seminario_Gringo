import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { RUTA_PUBLICA } from './imagen.js'
import { DatosInvalidos } from '../../errores.js'
import {
  listarProductos, buscarProducto, registrarProducto, modificarProducto,
  asociarImagen, darDeBajaProducto, actualizarPreciosMasivo,
} from './catalogo.servicio.js'

const esquemaFiltros = z.object({
  texto: z.string().trim().min(1).max(80).optional(),
  idCategoria: z.coerce.number().int().positive().optional(),
  idMarca: z.coerce.number().int().positive().optional(),
  soloBajoMinimo: z.coerce.boolean().optional(),
})

const dinero = z.coerce.number().min(0).max(99_999_999)

const esquemaProducto = z.object({
  denominacion: z.string().trim().min(2, 'Cargá el nombre del producto.').max(150),
  descripcion: z.string().trim().max(2000).nullish().transform((v) => v || null),
  idCategoria: z.coerce.number().int().positive(),
  idMarca: z.coerce.number().int().positive(),
  // Ausente significa conservar el que ya tenia: un perfil sin acceso al costo
  // no lo recibe y por lo tanto tampoco lo manda (RF04.2).
  precioCosto: dinero.optional(),
  precioMinorista: dinero,
  precioMayorista: dinero,
  stockMinimo: z.coerce.number().int().min(0).max(999_999).default(0),
  stockInicial: z.coerce.number().int().min(0).max(999_999).optional(),
  // RF06.8 — identificadores de modelo_dispositivo, no texto libre: el modelo
  // se da de alta una sola vez en /api/modelos y despues se referencia.
  compatibilidades: z.array(z.coerce.number().int().positive()).max(40).optional(),
  // RF06.7 — identificadores de proveedor. Ausente significa no tocar;
  // un arreglo vacio significa quitarlos a todos.
  proveedores: z.array(z.coerce.number().int().positive()).max(20).optional(),
})

const esquemaPrecios = z.object({
  alcance: z.enum(['categoria', 'marca']),
  idAlcance: z.coerce.number().int().positive(),
  lista: z.enum(['MINORISTA', 'MAYORISTA', 'AMBAS', 'COSTO']),
  porcentaje: z.coerce.number().min(-99).max(1000).refine((v) => v !== 0, 'Cero no cambia nada.'),
})

const esquemaId = z.coerce.number().int().positive()

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const filtros = esquemaFiltros.parse(peticion.query)

  const resultado = await listarProductos(
    { ...filtros, limit: paginacion.limit, offset: paginacion.offset },
    peticion.usuario.perfil,
  )

  return respuesta.json(responderPaginado(resultado, paginacion))
}

export const detalle = async (peticion, respuesta) =>
  respuesta.json({ datos: await buscarProducto(esquemaId.parse(peticion.params.idProducto), peticion.usuario.perfil) })

export const registrar = async (peticion, respuesta) => {
  const datos = esquemaProducto.parse(peticion.body)

  // El responsable de las existencias iniciales sale del token.
  const producto = await registrarProducto(datos, peticion.usuario.idUsuario, peticion.usuario.perfil)

  return respuesta.status(201).json({ datos: producto })
}

export const modificar = async (peticion, respuesta) => {
  const producto = await modificarProducto(
    esquemaId.parse(peticion.params.idProducto),
    esquemaProducto.parse(peticion.body),
    peticion.usuario.perfil,
  )
  return respuesta.json({ datos: producto })
}

export const subirImagen = async (peticion, respuesta) => {
  if (!peticion.file) throw new DatosInvalidos('No llegó ninguna imagen.')

  const producto = await asociarImagen(
    esquemaId.parse(peticion.params.idProducto),
    `${RUTA_PUBLICA}/${peticion.file.filename}`,
  )

  return respuesta.json({ datos: { imagenRuta: producto.imagenRuta } })
}

export const darDeBaja = async (peticion, respuesta) => {
  await darDeBajaProducto(esquemaId.parse(peticion.params.idProducto))
  return respuesta.status(204).send()
}

export const preciosMasivos = async (peticion, respuesta) =>
  respuesta.json({ datos: await actualizarPreciosMasivo(esquemaPrecios.parse(peticion.body)) })
