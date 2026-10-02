import { z } from 'zod'
import { iniciarSesion, cerrarSesion, cambiarContrasenaPropia } from './acceso.servicio.js'

// El controlador traduce peticion en argumentos y resultado en respuesta.
// No decide nada del negocio.

const esquemaIngreso = z.object({
  nombreUsuario: z.string().trim().min(1, 'Ingresa tu nombre de usuario.'),
  contrasena: z.string().min(1, 'Ingresa tu contrasena.'),
})

const esquemaCambio = z.object({
  contrasenaActual: z.string().min(1, 'Ingresa tu contrasena actual.'),
  contrasenaNueva: z.string().min(8, 'La contrasena nueva necesita al menos 8 caracteres.'),
})

export const ingresar = async (peticion, respuesta) => {
  const datos = esquemaIngreso.parse(peticion.body)

  const resultado = await iniciarSesion({
    ...datos,
    direccionIp: peticion.ip,
  })

  return respuesta.json(resultado)
}

export const salir = async (peticion, respuesta) => {
  await cerrarSesion(peticion.idSesion)
  return respuesta.status(204).send()
}

export const cambiarContrasena = async (peticion, respuesta) => {
  const datos = esquemaCambio.parse(peticion.body)
  await cambiarContrasenaPropia(peticion.usuario.idUsuario, datos)
  return respuesta.status(204).send()
}

// Con quien esta hablando el frontend. Sirve para rehidratar la sesion al
// recargar la pagina sin volver a pedir la contrasena.
export const sesionActual = async (peticion, respuesta) => respuesta.json({ usuario: peticion.usuario })
