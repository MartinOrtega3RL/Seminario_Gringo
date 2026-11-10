import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { ESTADOS_PEDIDO } from './pedidos.reglas.js'
import { registrarPedido, actualizarEstadoPedido, listarPedidos } from './pedidos.servicio.js'

const opcional = (esquema) => esquema.nullish().transform((valor) => valor || null)
const esquemaId = z.coerce.number().int().positive()

const esquemaAlta = z.object({
  idCliente: esquemaId,
  idProducto: opcional(esquemaId),
  descripcionPedido: opcional(z.string().trim().max(200)),
  cantidad: z.coerce.number().int().positive('La cantidad tiene que ser mayor que cero.'),
  observacion: opcional(z.string().trim().max(300)),
})

const esquemaEstado = z.object({
  estado: z.enum(ESTADOS_PEDIDO),
  observacion: z.string().trim().max(300).nullish(),
})

const esquemaFiltro = z.object({
  estado: z.enum([...ESTADOS_PEDIDO, 'TODOS']).optional(),
  idCliente: esquemaId.optional(),
})

export const registrar = async (peticion, respuesta) => {
  const datos = esquemaAlta.parse(peticion.body)
  const pedido = await registrarPedido(datos, peticion.usuario.idUsuario)
  return respuesta.status(201).json({ datos: pedido })
}

export const cambiarEstado = async (peticion, respuesta) => {
  const idPedido = esquemaId.parse(peticion.params.idPedido)
  const datos = esquemaEstado.parse(peticion.body)
  const pedido = await actualizarEstadoPedido(idPedido, datos, peticion.usuario.idUsuario)
  return respuesta.json({ datos: pedido })
}

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const filtros = esquemaFiltro.parse({
    estado: peticion.query.estado || undefined,
    idCliente: peticion.query.idCliente || undefined,
  })
  const resultado = await listarPedidos({ ...filtros, ...paginacion })
  return respuesta.json(responderPaginado(resultado, paginacion))
}

