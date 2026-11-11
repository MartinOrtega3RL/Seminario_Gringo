import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import {
  listarPerfilesConConteo,
  registrarPerfil,
  modificarPerfil,
  darDeBajaPerfil,
  listarModulos,
  modificarModulo,
  obtenerMatriz,
  actualizarPermisos,
} from './permisos.servicio.js'

const esquemaId = z.coerce.number().int().positive()
const descripcionOpcional = z.string().trim().max(200).nullish().transform((v) => v || null)

const esquemaPerfil = z.object({
  nombre: z.string().trim().min(3, 'El nombre del perfil necesita al menos 3 caracteres.').max(50),
  descripcion: descripcionOpcional,
})

const esquemaModulo = z.object({
  nombre: z.string().trim().min(2, 'El nombre del módulo necesita al menos 2 caracteres.').max(80),
  descripcion: descripcionOpcional,
})

const esquemaPermisos = z.object({
  permisos: z.array(z.object({
    codigoModulo: z.string().trim().min(1).max(40),
    lectura: z.boolean(),
    escritura: z.boolean(),
  })),
})

export const listar = async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const resultado = await listarPerfilesConConteo(paginacion)
  return respuesta.json(responderPaginado(resultado, paginacion))
}

export const registrar = async (peticion, respuesta) => {
  const perfil = await registrarPerfil(esquemaPerfil.parse(peticion.body))
  return respuesta.status(201).json({ datos: perfil })
}

export const modificar = async (peticion, respuesta) => {
  const perfil = await modificarPerfil(
    esquemaId.parse(peticion.params.idPerfil),
    esquemaPerfil.parse(peticion.body),
  )
  return respuesta.json({ datos: perfil })
}

export const darDeBaja = async (peticion, respuesta) => {
  await darDeBajaPerfil(esquemaId.parse(peticion.params.idPerfil))
  return respuesta.status(204).send()
}

export const modulos = async (_peticion, respuesta) =>
  respuesta.json({ datos: await listarModulos() })

export const editarModulo = async (peticion, respuesta) => {
  const modulo = await modificarModulo(
    esquemaId.parse(peticion.params.idModulo),
    esquemaModulo.parse(peticion.body),
  )
  return respuesta.json({ datos: modulo })
}

export const matriz = async (_peticion, respuesta) =>
  respuesta.json({ datos: await obtenerMatriz() })

export const guardarPermisos = async (peticion, respuesta) => {
  const { permisos } = esquemaPermisos.parse(peticion.body)
  const datos = await actualizarPermisos(esquemaId.parse(peticion.params.idPerfil), permisos)
  return respuesta.json({ datos })
}

