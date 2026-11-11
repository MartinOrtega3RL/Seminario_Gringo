import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Usuario, Persona, Perfil, Sesion } from '../../modelos/index.js'
import { NoEncontrado, DatosInvalidos, SinPermiso } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { cifrarContrasena } from './acceso.servicio.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'
import { permisosDelUsuario } from '../../http/middlewares/autorizar.js'
import { puedeGestionarUsuario, esPerfilProtegido } from '../permisos/permisos.reglas.js'

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

/**
 * RF02.4 — perfiles que quien pide puede asignar. Quien no es de soporte no
 * ve el perfil de soporte: no lo puede dar.
 */
export const listarPerfiles = async (permisosQuienPide) => {
  const perfiles = await Perfil.findAll({ where: { activo: true }, order: [['idPerfil', 'ASC']] })
  const asignables = []
  for (const perfil of perfiles) {
    const { admite } = puedeGestionarUsuario({
      quienPide: permisosQuienPide,
      perfilesInvolucrados: [await permisosDelUsuario(perfil.idPerfil)],
    })
    if (admite) asignables.push(perfil)
  }
  return asignables
}

/** Corta la operacion si toca el perfil de soporte y quien pide no es soporte. */
const verificarAlcance = async (permisosQuienPide, ...idPerfiles) => {
  const { admite, motivo } = puedeGestionarUsuario({
    quienPide: permisosQuienPide,
    perfilesInvolucrados: await Promise.all(idPerfiles.map((id) => permisosDelUsuario(id))),
  })
  if (!admite) throw new SinPermiso(motivo)
}

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
export const registrarUsuario = async (datos, permisosQuienPide) => {
  await verificarAlcance(permisosQuienPide, datos.idPerfil)
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

    await registrarEnBitacora({
      entidad: 'usuario',
      idRegistro: usuario.idUsuario,
      accion: 'ALTA',
      despues: {
        nombreUsuario: datos.nombreUsuario,
        apellidoNombre: datos.apellidoNombre,
        idPerfil: datos.idPerfil,
      },
    }, transaction)

    return usuario.idUsuario
  })

  log.info({ idUsuario, perfil: datos.idPerfil }, 'usuario dado de alta')
  return buscarUsuario(idUsuario)
}

/**
 * Impide dejar sin usuarios activos a un perfil protegido (Soporte o
 * Administrador). Sin Soporte nadie puede volver a configurar permisos ni dar
 * ese perfil desde adentro; sin Administrador el comercio no maneja sus
 * usuarios.
 */
const verificarNoEsElUltimo = async (usuario, accion) => {
  if (!esPerfilProtegido(usuario.perfil)) return
  const otros = await Usuario.count({
    where: { idPerfil: usuario.idPerfil, activo: true, idUsuario: { [Op.ne]: usuario.idUsuario } },
  })
  if (otros === 0) {
    throw new DatosInvalidos(`Es el único usuario activo con perfil ${usuario.perfil.nombre}: si ${accion}, nadie quedaría con ese perfil.`)
  }
}

/** RF02.2 y RF02.4 — modificacion de datos y de perfil. La contrasena no se
 *  toca desde aca: solo la cambia su dueno (RF01.3). */
export const modificarUsuario = async (idUsuario, datos, permisosQuienPide) => {
  const usuario = await buscarUsuario(idUsuario)
  await verificarAlcance(permisosQuienPide, usuario.idPerfil, datos.idPerfil)
  await verificarNombreLibre(datos.nombreUsuario, idUsuario)
  await verificarPerfil(datos.idPerfil)

  if (datos.idPerfil !== usuario.idPerfil) await verificarNoEsElUltimo(usuario, 'le cambiás el perfil')

  const antes = {
    nombreUsuario: usuario.nombreUsuario,
    apellidoNombre: usuario.persona.apellidoNombre,
    idPerfil: usuario.idPerfil,
  }

  await sequelize.transaction(async (transaction) => {
    await usuario.persona.update({ apellidoNombre: datos.apellidoNombre }, { transaction })
    await usuario.update({
      nombreUsuario: datos.nombreUsuario,
      idPerfil: datos.idPerfil,
    }, { transaction })

    await registrarEnBitacora({
      entidad: 'usuario',
      idRegistro: idUsuario,
      accion: 'MODIFICACION',
      antes,
      despues: {
        nombreUsuario: datos.nombreUsuario,
        apellidoNombre: datos.apellidoNombre,
        idPerfil: datos.idPerfil,
      },
    }, transaction)
  })

  log.info({ idUsuario, perfil: datos.idPerfil }, 'usuario modificado')
  return buscarUsuario(idUsuario)
}

/**
 * RF02.3 — baja LOGICA. El usuario no puede volver a entrar, pero las ventas y
 * los movimientos que registro quedan a su nombre: eso es todo el sentido de
 * que la baja sea logica y no un borrado.
 */
export const darDeBajaUsuario = async (idUsuario, idQuienPide, permisosQuienPide) => {
  if (idUsuario === idQuienPide) {
    throw new DatosInvalidos('No podés darte de baja a vos mismo.')
  }

  const usuario = await buscarUsuario(idUsuario)
  await verificarAlcance(permisosQuienPide, usuario.idPerfil)
  if (!usuario.activo) return

  await verificarNoEsElUltimo(usuario, 'lo das de baja')

  await sequelize.transaction(async (transaction) => {
    await usuario.update({ activo: false }, { transaction })

    // Dar de baja sin cerrar la sesion dejaria al usuario operando hasta que
    // venza el token, que es exactamente lo que la baja quiso impedir.
    await Sesion.update(
      { fechaCierre: new Date(), motivoCierre: 'REVOCADA' },
      { where: { idUsuario, fechaCierre: null }, transaction },
    )

    await registrarEnBitacora({
      entidad: 'usuario',
      idRegistro: idUsuario,
      accion: 'BAJA',
      antes: { activo: true, nombreUsuario: usuario.nombreUsuario },
      despues: { activo: false },
    }, transaction)
  })

  log.info({ idUsuario, nombreUsuario: usuario.nombreUsuario }, 'usuario dado de baja')
}
