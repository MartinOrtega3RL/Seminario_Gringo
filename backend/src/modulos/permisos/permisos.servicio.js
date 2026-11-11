import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Perfil, Modulo, Permiso, Usuario } from '../../modelos/index.js'
import { olvidarPermisos } from '../../http/middlewares/autorizar.js'
import { DatosInvalidos, NoEncontrado } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { registrarEnBitacora } from '../bitacora/bitacora.servicio.js'
import {
  esPerfilProtegido,
  nombrePerfilValido,
  puedeRenombrarPerfil,
  puedeDarDeBajaPerfil,
  validarPermisosPerfil,
  mapaPermisos,
} from './permisos.reglas.js'

const log = registroDe('permisos')

const buscarPerfilActivo = async (idPerfil, transaction) => {
  const perfil = await Perfil.findOne({ where: { idPerfil, activo: true }, transaction })
  if (!perfil) throw new NoEncontrado('El perfil')
  return perfil
}

const verificarNombreUnico = async (nombre, idActual = null, transaction) => {
  const todos = await Perfil.findAll({
    attributes: ['idPerfil', 'nombre'],
    ...(idActual ? { where: { idPerfil: { [Op.ne]: idActual } } } : {}),
    transaction,
  })
  const buscado = nombre.trim().toLowerCase()
  if (todos.some((fila) => fila.nombre.trim().toLowerCase() === buscado)) {
    throw new DatosInvalidos(`Ya existe un perfil llamado "${nombre.trim()}".`)
  }
}

/** RF03.1 — listado paginado de perfiles activos con cantidad de usuarios activos. */
export const listarPerfilesConConteo = async ({ limit, offset }) => {
  const resultado = await Perfil.findAndCountAll({
    where: { activo: true },
    order: [['idPerfil', 'ASC']],
    limit,
    offset,
  })

  const ids = resultado.rows.map((p) => p.idPerfil)
  const conteos = ids.length > 0
    ? await Usuario.findAll({
        where: { activo: true, idPerfil: { [Op.in]: ids } },
        attributes: ['idPerfil', [sequelize.fn('COUNT', sequelize.col('id_usuario')), 'cantidad']],
        group: ['idPerfil'],
        raw: true,
      })
    : []

  const porPerfil = new Map(conteos.map((c) => [Number(c.idPerfil), Number(c.cantidad)]))

  return {
    count: resultado.count,
    rows: resultado.rows.map((perfil) => ({
      idPerfil: perfil.idPerfil,
      nombre: perfil.nombre,
      descripcion: perfil.descripcion ?? null,
      activo: Boolean(perfil.activo),
      protegido: esPerfilProtegido(perfil),
      usuariosActivos: porPerfil.get(perfil.idPerfil) ?? 0,
    })),
  }
}

/**
 * RF03.1 — alta de perfil. Nace sin permisos: todas las filas en lectura 0 y
 * escritura 0, una por modulo.
 */
export const registrarPerfil = async ({ nombre, descripcion }) => {
  const checkNombre = nombrePerfilValido(nombre)
  if (!checkNombre.valido) throw new DatosInvalidos(checkNombre.motivo)

  const creado = await sequelize.transaction(async (transaction) => {
    await verificarNombreUnico(checkNombre.nombre, null, transaction)

    const perfil = await Perfil.create({
      nombre: checkNombre.nombre,
      descripcion: descripcion?.trim() || null,
      activo: true,
    }, { transaction })

    const modulos = await Modulo.findAll({ order: [['idModulo', 'ASC']], transaction })
    if (modulos.length > 0) {
      await Permiso.bulkCreate(
        modulos.map((m) => ({
          idPerfil: perfil.idPerfil,
          idModulo: m.idModulo,
          permiteLectura: false,
          permiteEscritura: false,
        })),
        { transaction },
      )
    }

    await registrarEnBitacora({
      entidad: 'perfil',
      idRegistro: perfil.idPerfil,
      accion: 'ALTA',
      despues: { nombre: perfil.nombre, descripcion: perfil.descripcion },
    }, transaction)

    return perfil
  })

  log.info({ idPerfil: creado.idPerfil, nombre: creado.nombre }, 'perfil dado de alta')
  return {
    idPerfil: creado.idPerfil,
    nombre: creado.nombre,
    descripcion: creado.descripcion ?? null,
    activo: true,
    protegido: false,
    usuariosActivos: 0,
  }
}

/** RF03.1 — modificar nombre y descripcion de un perfil. */
export const modificarPerfil = async (idPerfil, { nombre, descripcion }) => {
  const checkNombre = nombrePerfilValido(nombre)
  if (!checkNombre.valido) throw new DatosInvalidos(checkNombre.motivo)

  const actualizado = await sequelize.transaction(async (transaction) => {
    const perfil = await buscarPerfilActivo(idPerfil, transaction)
    const renombre = puedeRenombrarPerfil(perfil, checkNombre.nombre)
    if (!renombre.admite) throw new DatosInvalidos(renombre.motivo)

    await verificarNombreUnico(checkNombre.nombre, idPerfil, transaction)

    const antes = { nombre: perfil.nombre, descripcion: perfil.descripcion ?? null }
    const despues = { nombre: checkNombre.nombre, descripcion: descripcion?.trim() || null }

    await perfil.update(despues, { transaction })

    await registrarEnBitacora({
      entidad: 'perfil',
      idRegistro: idPerfil,
      accion: 'MODIFICACION',
      antes,
      despues,
    }, transaction)

    return perfil
  })

  log.info({ idPerfil }, 'perfil modificado')
  return {
    idPerfil: actualizado.idPerfil,
    nombre: actualizado.nombre,
    descripcion: actualizado.descripcion ?? null,
    activo: Boolean(actualizado.activo),
    protegido: esPerfilProtegido(actualizado),
  }
}

/** RF03.1 — baja logica de perfil (solo si no tiene usuarios activos). */
export const darDeBajaPerfil = async (idPerfil) => {
  await sequelize.transaction(async (transaction) => {
    const perfil = await buscarPerfilActivo(idPerfil, transaction)
    const usuariosActivos = await Usuario.count({
      where: { idPerfil, activo: true },
      transaction,
    })

    const veredicto = puedeDarDeBajaPerfil(perfil, usuariosActivos)
    if (!veredicto.admite) throw new DatosInvalidos(veredicto.motivo)

    await perfil.update({ activo: false }, { transaction })

    await registrarEnBitacora({
      entidad: 'perfil',
      idRegistro: idPerfil,
      accion: 'BAJA',
      antes: { activo: true, nombre: perfil.nombre },
      despues: { activo: false },
    }, transaction)
  })

  olvidarPermisos()
  log.info({ idPerfil }, 'perfil dado de baja')
}

/** RF03.2 — listado de los modulos precargados del sistema. */
export const listarModulos = async () => {
  const modulos = await Modulo.findAll({ order: [['idModulo', 'ASC']] })
  return modulos.map((m) => m.get({ plain: true }))
}

/** RF03.2 — edicion de nombre y descripcion de un modulo existente. */
export const modificarModulo = async (idModulo, { nombre, descripcion }) => {
  const actualizado = await sequelize.transaction(async (transaction) => {
    const modulo = await Modulo.findByPk(idModulo, { transaction })
    if (!modulo) throw new NoEncontrado('El módulo')

    const antes = { nombre: modulo.nombre, descripcion: modulo.descripcion ?? null }
    const despues = { nombre: nombre.trim(), descripcion: descripcion?.trim() || null }

    await modulo.update(despues, { transaction })

    await registrarEnBitacora({
      entidad: 'modulo',
      idRegistro: idModulo,
      accion: 'MODIFICACION',
      antes,
      despues,
      detalle: modulo.codigo,
    }, transaction)

    return modulo
  })

  return actualizado.get({ plain: true })
}

/** RF03.4 — matriz completa de perfiles activos x modulos. */
export const obtenerMatriz = async () => {
  const [modulos, perfiles, permisos] = await Promise.all([
    Modulo.findAll({ order: [['idModulo', 'ASC']] }),
    Perfil.findAll({ where: { activo: true }, order: [['idPerfil', 'ASC']] }),
    Permiso.findAll(),
  ])

  const modulosPlanos = modulos.map((m) => m.get({ plain: true }))
  const porPerfil = new Map()

  for (const fila of permisos) {
    if (!porPerfil.has(fila.idPerfil)) porPerfil.set(fila.idPerfil, [])
    porPerfil.get(fila.idPerfil).push(fila)
  }

  return {
    modulos: modulosPlanos,
    perfiles: perfiles.map((perfil) => ({
      idPerfil: perfil.idPerfil,
      nombre: perfil.nombre,
      descripcion: perfil.descripcion ?? null,
      protegido: esPerfilProtegido(perfil),
      permisos: mapaPermisos(modulosPlanos, porPerfil.get(perfil.idPerfil) ?? []),
    })),
  }
}

/**
 * RF03.3 — reemplaza los permisos de un perfil en una transaccion, registra en
 * bitacora y limpia la cache del middleware autorizar.
 */
export const actualizarPermisos = async (idPerfil, permisosEntrada) => {
  const matriz = await sequelize.transaction(async (transaction) => {
    const perfil = await buscarPerfilActivo(idPerfil, transaction)
    const modulos = await Modulo.findAll({ order: [['idModulo', 'ASC']], transaction })
    const codigosModulo = modulos.map((m) => m.codigo)

    const validacion = validarPermisosPerfil({
      perfil,
      permisos: permisosEntrada,
      codigosModulo,
    })
    if (!validacion.valido) throw new DatosInvalidos(validacion.motivo)

    const anteriores = await Permiso.findAll({ where: { idPerfil }, transaction })
    const modulosPlanos = modulos.map((m) => m.get({ plain: true }))
    const antes = mapaPermisos(modulosPlanos, anteriores)
    const despues = mapaPermisos(modulosPlanos, permisosEntrada)

    const idPorCodigo = new Map(modulos.map((m) => [m.codigo, m.idModulo]))

    await Permiso.destroy({ where: { idPerfil }, transaction })
    await Permiso.bulkCreate(
      permisosEntrada.map((item) => ({
        idPerfil,
        idModulo: idPorCodigo.get(item.codigoModulo),
        permiteLectura: Boolean(item.lectura),
        permiteEscritura: Boolean(item.escritura),
      })),
      { transaction },
    )

    await registrarEnBitacora({
      entidad: 'permiso',
      idRegistro: idPerfil,
      accion: 'MODIFICACION',
      antes,
      despues,
      detalle: perfil.nombre,
    }, transaction)

    return despues
  })

  // Invalidar despues del commit para que ningun request lea datos viejos.
  olvidarPermisos()
  log.info({ idPerfil }, 'permisos actualizados')
  return matriz
}

