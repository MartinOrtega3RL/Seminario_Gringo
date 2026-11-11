import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { entorno } from '../../config/entorno.js'
import { Usuario, Perfil, Persona, Sesion, Permiso, Modulo } from '../../modelos/index.js'
import { hashearToken } from '../../http/middlewares/autenticar.js'
import { usuarioActual } from '../../http/contexto.js'
import { NoAutenticado, DatosInvalidos } from '../../errores.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'

const RONDAS = 10

// RNF09 — la contrasena se guarda cifrada con funcion de hash, nunca en claro.
export const cifrarContrasena = (contrasena) => bcrypt.hash(contrasena, RONDAS)

// Hash descartable con el que comparar cuando el usuario no existe: sin esto,
// una respuesta mas rapida delataria que ese nombre de usuario no esta dado
// de alta, y serviria para enumerar usuarios.
const HASH_SENUELO = bcrypt.hashSync('senuelo-sin-uso', RONDAS)

const vigenciaEnMilisegundos = () => {
  const unidades = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }
  const partes = /^(\d+)([smhd])$/.exec(entorno.JWT_VIGENCIA)
  if (!partes) return 8 * unidades.h
  return Number(partes[1]) * unidades[partes[2]]
}

const permisosDelPerfil = async (idPerfil) => {
  const filas = await Permiso.findAll({
    where: { idPerfil },
    include: [{ model: Modulo, as: 'modulo', attributes: ['codigo', 'nombre'] }],
  })

  // RF04.1 — con esto el frontend arma el menu. La verificacion real la hace
  // el servidor en cada operacion (RNF18); esto es solo para la interfaz.
  return filas
    .filter((fila) => fila.permiteLectura)
    .map((fila) => ({
      modulo: fila.modulo.codigo,
      nombre: fila.modulo.nombre,
      escritura: fila.permiteEscritura,
    }))
}

/**
 * El usuario tal como lo necesita el frontend: quien es y que puede hacer. Lo usan
 * el ingreso y la rehidratacion de la sesion al recargar la pagina; si cada uno
 * lo armara por su lado, uno se olvidaria de los permisos y el otro no, que es
 * exactamente lo que paso: despues de recargar, el menu quedaba vacio.
 */
const presentarUsuario = async (usuario) => ({
  idUsuario: usuario.idUsuario,
  nombreUsuario: usuario.nombreUsuario,
  apellidoNombre: usuario.persona.apellidoNombre,
  perfil: usuario.perfil.nombre,
  permisos: await permisosDelPerfil(usuario.idPerfil),
})

/** RF01.1 — autentica y emite el token de sesion. */
export const iniciarSesion = async ({ nombreUsuario, contrasena, direccionIp }) => {
  const usuario = await Usuario.scope('conCredenciales').findOne({
    where: { nombreUsuario },
    include: [
      { model: Perfil, as: 'perfil' },
      { model: Persona, as: 'persona', attributes: ['apellidoNombre'] },
    ],
  })

  const coincide = await bcrypt.compare(contrasena, usuario?.contrasenaHash ?? HASH_SENUELO)

  // Un solo mensaje para usuario inexistente, contrasena incorrecta y usuario
  // dado de baja: distinguirlos le diria a un atacante cual de las tres es.
  if (!usuario || !usuario.activo || !coincide) {
    throw new NoAutenticado('El usuario o la contrasena no son correctos.')
  }

  const token = jwt.sign(
    { idUsuario: usuario.idUsuario, perfil: usuario.perfil.nombre },
    entorno.JWT_SECRETO,
    { expiresIn: entorno.JWT_VIGENCIA },
  )

  await Sesion.create({
    idUsuario: usuario.idUsuario,
    tokenHash: hashearToken(token),
    fechaExpiracion: new Date(Date.now() + vigenciaEnMilisegundos()),
    direccionIp: direccionIp ?? null,
  })

  await registrarEnBitacora({
    entidad: 'usuario',
    idRegistro: usuario.idUsuario,
    accion: 'LOGIN',
    idUsuario: usuario.idUsuario,
    ip: direccionIp ?? null,
    detalle: `Inicio de sesión de ${usuario.nombreUsuario}`,
  })

  return { token, usuario: await presentarUsuario(usuario) }
}

/**
 * Con quien esta hablando el frontend, con lo que puede hacer. Sirve para
 * rehidratar la sesion al recargar la pagina sin volver a pedir la contrasena.
 */
export const usuarioDeSesion = async (idUsuario) => {
  const usuario = await Usuario.findByPk(idUsuario, {
    include: [
      { model: Perfil, as: 'perfil' },
      { model: Persona, as: 'persona', attributes: ['apellidoNombre'] },
    ],
  })
  if (!usuario || !usuario.activo) throw new NoAutenticado()

  return presentarUsuario(usuario)
}

/** RF01.2 — invalida el token vigente. */
export const cerrarSesion = async (idSesion) => {
  await Sesion.update(
    { fechaCierre: new Date(), motivoCierre: 'LOGOUT' },
    { where: { idSesion, fechaCierre: null } },
  )

  await registrarEnBitacora({
    entidad: 'usuario',
    idRegistro: usuarioActual()?.idUsuario ?? null,
    accion: 'LOGOUT',
    detalle: 'Cierre de sesión',
  })
}

/** RF01.3 — el usuario cambia su propia contrasena. */
export const cambiarContrasenaPropia = async (idUsuario, { contrasenaActual, contrasenaNueva }) => {
  const usuario = await Usuario.scope('conCredenciales').findByPk(idUsuario)
  if (!usuario) throw new NoAutenticado()

  const coincide = await bcrypt.compare(contrasenaActual, usuario.contrasenaHash)
  if (!coincide) throw new DatosInvalidos('La contrasena actual no es correcta.')

  await usuario.update({ contrasenaHash: await cifrarContrasena(contrasenaNueva) })

  // Cambiar la contrasena cierra las demas sesiones: si alguien la habia
  // comprometido, deja de tener acceso en ese mismo momento.
  await Sesion.update(
    { fechaCierre: new Date(), motivoCierre: 'REVOCADA' },
    { where: { idUsuario, fechaCierre: null } },
  )

  await registrarEnBitacora({
    entidad: 'usuario',
    idRegistro: idUsuario,
    accion: 'MODIFICACION',
    detalle: 'cambio de contraseña',
  })
}
