import { Router } from 'express'
import { z } from 'zod'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar, permisosDelUsuario } from '../../http/middlewares/autorizar.js'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import {
  listarUsuarios, buscarUsuario, listarPerfiles,
  registrarUsuario, modificarUsuario, darDeBajaUsuario,
} from './usuarios.servicio.js'

// RF02 — administracion de usuarios. Modulo exclusivo del Administrador.

// Letras de cualquier tipo, con ñ y acentos: «Dueño» es un nombre de usuario
// normal en castellano. La base compara sin distinguir acentos, asi que
// «Dueño» y «Dueno» son el mismo usuario y no pueden coexistir.
const nombreUsuario = z.string().trim()
  .regex(/^[\p{L}\p{N}._-]{3,50}$/u, 'Entre 3 y 50 letras, números, puntos o guiones, sin espacios.')

const esquemaAlta = z.object({
  apellidoNombre: z.string().trim().min(2, 'Cargá el nombre.').max(150),
  nombreUsuario,
  idPerfil: z.coerce.number().int().positive(),
  contrasena: z.string().min(8, 'La contraseña necesita al menos 8 caracteres.').max(200),
})

// En la edicion no entra la contrasena a proposito: quien puede fijar la clave
// de otro puede despues operar a su nombre sin que el historial lo distinga.
const esquemaEdicion = esquemaAlta.omit({ contrasena: true })

const esquemaId = z.coerce.number().int().positive()

export const rutasUsuarios = Router()

rutasUsuarios.use(autenticar)
const leer = autorizar('ADMIN_SEGURIDAD', 'lectura')
const escribir = autorizar('ADMIN_SEGURIDAD', 'escritura')

// La matriz de quien pide decide si puede tocar usuarios de soporte.
const permisosDe = (peticion) => permisosDelUsuario(peticion.usuario.idPerfil)

// Antes de /:idUsuario, o Express tomaria "perfiles" como identificador.
rutasUsuarios.get('/perfiles', leer, async (peticion, respuesta) =>
  respuesta.json({ datos: await listarPerfiles(await permisosDe(peticion)) }))

rutasUsuarios.get('/', leer, async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const texto = z.string().trim().max(80).optional().parse(peticion.query.texto || undefined)

  const resultado = await listarUsuarios({ texto, limit: paginacion.limit, offset: paginacion.offset })
  return respuesta.json(responderPaginado(resultado, paginacion))
})

rutasUsuarios.post('/', escribir, async (peticion, respuesta) =>
  respuesta.status(201).json({ datos: await registrarUsuario(esquemaAlta.parse(peticion.body), await permisosDe(peticion)) }))

rutasUsuarios.get('/:idUsuario', leer, async (peticion, respuesta) =>
  respuesta.json({ datos: await buscarUsuario(esquemaId.parse(peticion.params.idUsuario)) }))

rutasUsuarios.put('/:idUsuario', escribir, async (peticion, respuesta) =>
  respuesta.json({
    datos: await modificarUsuario(
      esquemaId.parse(peticion.params.idUsuario),
      esquemaEdicion.parse(peticion.body),
      await permisosDe(peticion),
    ),
  }))

rutasUsuarios.delete('/:idUsuario', escribir, async (peticion, respuesta) => {
  await darDeBajaUsuario(esquemaId.parse(peticion.params.idUsuario), peticion.usuario.idUsuario, await permisosDe(peticion))
  return respuesta.status(204).send()
})
