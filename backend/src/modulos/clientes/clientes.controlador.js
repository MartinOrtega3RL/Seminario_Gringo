import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import {
  listarClientes, buscarCliente, listarTiposCliente,
  registrarCliente, modificarCliente, darDeBajaCliente,
} from './clientes.servicio.js'

const opcional = (esquema) => esquema.nullish().transform((valor) => valor || null)

const esquemaCliente = z.object({
  apellidoNombre: z.string().trim().min(2, 'El nombre necesita al menos dos caracteres.').max(150),
  tipoPersona: z.enum(['FISICA', 'JURIDICA']).default('FISICA'),
  tipoDocumento: opcional(z.enum(['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'OTRO'])),
  numeroDocumento: opcional(z.string().trim().max(20)),
  // H11: el WhatsApp es el dato de contacto que piden siempre.
  telefonoWhatsapp: opcional(z.string().trim().max(30)),
  correo: opcional(z.string().trim().email('El correo no tiene un formato valido.').max(120)),
  domicilio: opcional(z.string().trim().max(200)),
  idTipoCliente: z.coerce.number().int().positive(),
  observaciones: opcional(z.string().trim().max(300)),
})

const esquemaId = z.coerce.number().int().positive()

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const texto = z.string().trim().max(80).optional().parse(peticion.query.texto || undefined)

  const resultado = await listarClientes({
    texto,
    limit: paginacion.limit,
    offset: paginacion.offset,
  })

  return respuesta.json(responderPaginado(resultado, paginacion))
}

export const detalle = async (peticion, respuesta) => {
  const cliente = await buscarCliente(esquemaId.parse(peticion.params.idCliente))
  return respuesta.json({ datos: cliente })
}

export const tipos = async (_peticion, respuesta) =>
  respuesta.json({ datos: await listarTiposCliente() })

export const registrar = async (peticion, respuesta) => {
  const cliente = await registrarCliente(esquemaCliente.parse(peticion.body))
  return respuesta.status(201).json({ datos: cliente })
}

export const modificar = async (peticion, respuesta) => {
  const cliente = await modificarCliente(
    esquemaId.parse(peticion.params.idCliente),
    esquemaCliente.parse(peticion.body),
  )
  return respuesta.json({ datos: cliente })
}

export const darDeBaja = async (peticion, respuesta) => {
  await darDeBajaCliente(esquemaId.parse(peticion.params.idCliente))
  return respuesta.status(204).send()
}
