import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Usuario, Persona, Perfil, Sesion } from '../../modelos/index.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { cifrarContrasena } from './acceso.servicio.js'

const log = registroDe('usuarios')

const RELACIONES = [
  { model: Persona, as: 'persona', attributes: ['idPersona', 'apellidoNombre', 'telefonoWhatsapp', 'correo'] },
  { model: Perfil, as: 'perfil', attributes: ['idPerfil', 'nombre', 'descripcion'] },
]

/** RF02.5 — nomina de usuarios con su perfil. El hash nunca sale: lo excluye
 *  el alcance por omision del modelo. */
export const listarUsuarios = async ({ texto, limit, offset }) => {
  const filtro = {}
  if (texto?.trim()) {
    const como = { [Op.like]: `%${texto.trim()}%` }
    filtro[Op.or] = [{ nombreUsuario: como }, { '$persona.apellido_nombre$': como }]
  }

  return Usuario.findAndCountAll({
    where: filtro,
    include: RELACIONES,
    order: [['activo', 'DESC'], ['nombreUsuario', 'ASC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })
}

export const buscarUsuario = async (idUsuario) => {
  const usuario = await Usuario.findByPk(idUsuario, { include: RELACIONES })
  if (!usuario) throw new NoEncontrado('El usuario')
  return usuario
}

/** RF02.4 — perfiles disponibles para asignar. Vienen precargados (H13). */
export const listarPerfiles = () =>
  Perfil.findAll({ where: { activo: true }, order: [['idPerfil', 'ASC']] })

const verificarPerfil = async (idPerfil, transaction) => {
  const perfil = await Perfil.findOne({ where: { idPerfil, activo: true }, transaction })
  if (!perfil) throw new NoEncontrado('El perfil')
  return perfil
}

const verificarNombreLibre = async (nombreUsuario, idActual = null) => {
  const donde = { nombreUsuario }
  if (idActual) donde.idUsuario = { [Op.ne]: idActual }

  if (await Usuario.count({ where: donde })) {
    throw new DatosInvalidos(`Ya existe un usuario "${nombreUsuario}".`)
  }
}

/**
 * RF02.1 — alta. Usuario es una especializacion de persona: las dos filas se
 * escriben juntas o no se escribe ninguna.
 */
export const registrarUsuario = async (datos) => {
  await verificarNombreLibre(datos.nombreUsuario)

  // El hash se calcula fuera de la transaccion: cifrar tarda y no tiene sentido
  // tener la transaccion abierta mientras tanto.
  const contrasenaHash = await cifrarContrasena(datos.contrasena)

  const idUsuario = await sequelize.transaction(async (transaction) => {
    await verificarPerfil(datos.idPerfil, transaction)

    const persona = await Persona.create({
      apellidoNombre: datos.apellidoNombre,
      tipoPersona: 'FISICA',
    }, { transaction })

    const usuario = await Usuario.create({
      idPersona: persona.idPersona,
      idPerfil: datos.idPerfil,
      nombreUsuario: datos.nombreUsuario,
      contrasenaHash,
    }, { transaction })

    return usuario.idUsuario
  })

  log.info({ idUsuario, perfil: datos.idPerfil }, 'usuario dado de alta')
  return buscarUsuario(idUsuario)
}

/**
 * Cuantos administradores activos quedarian si se toca a este usuario.
 * Se usa para no dejar el sistema sin nadie que pueda administrarlo: sin
 * administrador no hay forma de volver a crear uno desde adentro.
 */
const administradoresSinContar = async (idUsuario) => {
  const admin = await Perfil.findOne({ where: { nombre: 'Administrador' } })
  return Usuario.count({
    where: { idPerfil: admin.idPerfil, activo: true, idUsuario: { [Op.ne]: idUsuario } },
  })
}

/** RF02.2 y RF02.4 — modificacion de datos y de perfil. La contrasena no se
 *  toca desde aca: solo la cambia su dueno (RF01.3). */
export const modificarUsuario = async (idUsuario, datos) => {
  const usuario = await buscarUsuario(idUsuario)
  await verificarNombreLibre(datos.nombreUsuario, idUsuario)
  await verificarPerfil(datos.idPerfil)

  const dejaDeSerAdmin = usuario.perfil.nombre === 'Administrador'
    && datos.idPerfil !== usuario.idPerfil
  if (dejaDeSerAdmin && (await administradoresSinContar(idUsuario)) === 0) {
    throw new DatosInvalidos('Es el único administrador activo: si le cambiás el perfil, nadie podría administrar el sistema.')
  }

  await sequelize.transaction(async (transaction) => {
    await usuario.persona.update({ apellidoNombre: datos.apellidoNombre }, { transaction })
    await usuario.update({
      nombreUsuario: datos.nombreUsuario,
      idPerfil: datos.idPerfil,
    }, { transaction })
  })

  log.info({ idUsuario, perfil: datos.idPerfil }, 'usuario modificado')
  return buscarUsuario(idUsuario)
}

/**
 * RF02.3 — baja LOGICA. El usuario no puede volver a entrar, pero las ventas y
 * los movimientos que registro quedan a su nombre: eso es todo el sentido de
 * que la baja sea logica y no un borrado.
 */
export const darDeBajaUsuario = async (idUsuario, idQuienPide) => {
  if (idUsuario === idQuienPide) {
    throw new DatosInvalidos('No podés darte de baja a vos mismo.')
  }

  const usuario = await buscarUsuario(idUsuario)
  if (!usuario.activo) return

  if (usuario.perfil.nombre === 'Administrador' && (await administradoresSinContar(idUsuario)) === 0) {
    throw new DatosInvalidos('Es el único administrador activo: si lo das de baja, nadie podría administrar el sistema.')
  }

  await sequelize.transaction(async (transaction) => {
    await usuario.update({ activo: false }, { transaction })

    // Dar de baja sin cerrar la sesion dejaria al usuario operando hasta que
    // venza el token, que es exactamente lo que la baja quiso impedir.
    await Sesion.update(
      { fechaCierre: new Date(), motivoCierre: 'REVOCADA' },
      { where: { idUsuario, fechaCierre: null }, transaction },
    )
  })

  log.info({ idUsuario, nombreUsuario: usuario.nombreUsuario }, 'usuario dado de baja')
}
