import { createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { Op } from 'sequelize'
import { entorno } from '../../config/entorno.js'
import { Sesion, Usuario, Perfil } from '../../modelos/index.js'
import { leerParametro } from '../../modelos/sistema.js'
import { NoAutenticado } from '../../errores.js'

// En la tabla se guarda el hash del token, no el token: si alguien lee la
// base, no puede hacerse pasar por una sesion abierta.
export const hashearToken = (token) => createHash('sha256').update(token).digest('hex')

const leerCabecera = (peticion) => {
  const cabecera = peticion.get('authorization')
  if (!cabecera?.startsWith('Bearer ')) return null
  return cabecera.slice(7).trim() || null
}

// RNF11. El plazo sale de parametro_sistema, no del codigo: el comercio puede
// cambiarlo sin que nadie recompile nada.
const vencioPorInactividad = async (sesion) => {
  const minutos = Number(await leerParametro('SESION_INACTIVIDAD_MIN', '30'))
  const limite = new Date(sesion.fechaUltimoUso).getTime() + minutos * 60_000
  return Date.now() > limite
}

const buscarSesionVigente = async (token) => Sesion.findOne({
  where: {
    tokenHash: hashearToken(token),
    fechaCierre: null,
    fechaExpiracion: { [Op.gt]: new Date() },
  },
})

export const autenticar = async (peticion, _respuesta, siguiente) => {
  const token = leerCabecera(peticion)
  if (!token) throw new NoAutenticado('Falta el token de sesion.')

  let contenido
  try {
    contenido = jwt.verify(token, entorno.JWT_SECRETO)
  } catch {
    throw new NoAutenticado()
  }

  // Firma valida no alcanza: la sesion tiene que seguir abierta en la base.
  // Sin esto, cerrar sesion (RF01.2) no invalidaria nada.
  const sesion = await buscarSesionVigente(token)
  if (!sesion) throw new NoAutenticado()

  if (await vencioPorInactividad(sesion)) {
    await sesion.update({ fechaCierre: new Date(), motivoCierre: 'INACTIVIDAD' })
    throw new NoAutenticado('Se cerro la sesion por inactividad. Volve a iniciar sesion.')
  }

  const usuario = await Usuario.findByPk(contenido.idUsuario, {
    include: [{ model: Perfil, as: 'perfil' }],
  })
  if (!usuario || !usuario.activo) throw new NoAutenticado()

  await sesion.update({ fechaUltimoUso: new Date() })

  // El responsable de toda operacion se toma de aca. Ningun controlador lee
  // un idUsuario del cuerpo de la peticion: seria suplantacion trivial.
  peticion.usuario = {
    idUsuario: usuario.idUsuario,
    nombreUsuario: usuario.nombreUsuario,
    idPerfil: usuario.idPerfil,
    perfil: usuario.perfil.nombre,
  }
  peticion.idSesion = sesion.idSesion

  siguiente()
}
