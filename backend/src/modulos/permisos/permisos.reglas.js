// Reglas puras de administracion de perfiles y permisos (RF03).

// Perfiles, permisos y bitacora son tareas de soporte del sistema, no del
// negocio: el Administrador (el titular) administra usuarios, pero no
// configura la matriz ni lee la bitacora tecnica (decision del equipo).
export const MODULO_SOPORTE = 'SOPORTE_SISTEMA'

// Cada perfil protegido conserva el modulo sin el cual nadie podria volver a
// configurarlo desde adentro: Soporte la matriz, Administrador los usuarios.
export const PERFILES_PROTEGIDOS = {
  Soporte: MODULO_SOPORTE,
  Administrador: 'ADMIN_SEGURIDAD',
}

export const esPerfilProtegido = (perfil) => Object.hasOwn(PERFILES_PROTEGIDOS, perfil?.nombre ?? '')

/** Un perfil es de soporte si tiene cualquier acceso al modulo de soporte. */
export const esPerfilDeSoporte = (permisos) => Boolean(permisos?.[MODULO_SOPORTE]?.lectura)

/**
 * Quien no es de soporte no puede dar el perfil de soporte ni tocar a un
 * usuario de soporte: si pudiera, el Administrador se lo asignaria a si mismo
 * y la separacion no serviria.
 * @param {{quienPide: object, perfilesInvolucrados: object[]}} matrices de permisos
 */
export const puedeGestionarUsuario = ({ quienPide, perfilesInvolucrados = [] }) => {
  if (quienPide?.[MODULO_SOPORTE]?.escritura) return { admite: true }
  if (perfilesInvolucrados.some(esPerfilDeSoporte)) {
    return { admite: false, motivo: 'Los usuarios de soporte del sistema solo los administra soporte.' }
  }
  return { admite: true }
}

export const nombrePerfilValido = (nombre) => {
  const limpio = String(nombre ?? '').trim()
  if (limpio.length < 3 || limpio.length > 50) {
    return { valido: false, motivo: 'El nombre del perfil necesita entre 3 y 50 caracteres.' }
  }
  return { valido: true, nombre: limpio }
}

/**
 * RF03.1 — los perfiles protegidos no pueden renombrarse para no romper la
 * proteccion del sistema ni los controles que dependen de ese nombre.
 */
export const puedeRenombrarPerfil = (perfil, nuevoNombre) => {
  const limpio = String(nuevoNombre ?? '').trim()
  if (esPerfilProtegido(perfil) && limpio !== perfil.nombre) {
    return { admite: false, motivo: `El perfil ${perfil.nombre} está protegido y no se puede renombrar.` }
  }
  return { admite: true }
}

/**
 * RF03.1 — no se puede dar de baja un perfil protegido ni un perfil con
 * usuarios activos asignados.
 */
export const puedeDarDeBajaPerfil = (perfil, usuariosActivos) => {
  if (esPerfilProtegido(perfil)) {
    return { admite: false, motivo: `El perfil ${perfil.nombre} está protegido y no puede darse de baja.` }
  }
  if (usuariosActivos > 0) {
    return {
      admite: false,
      motivo: `No se puede dar de baja: hay ${usuariosActivos} usuario${usuariosActivos === 1 ? '' : 's'} activo${usuariosActivos === 1 ? '' : 's'} con este perfil.`,
    }
  }
  return { admite: true }
}

/**
 * RF03.3 — valida coherencia de la matriz de permisos de un perfil antes de
 * persistir:
 * - tienen que venir todos los modulos del sistema, sin duplicados;
 * - si escritura es true, lectura tiene que ser true (ck_permiso_coherente);
 * - un perfil protegido no puede perder lectura ni escritura en su modulo.
 */
export const validarPermisosPerfil = ({ perfil, permisos = [], codigosModulo = [] }) => {
  if (!Array.isArray(permisos)) {
    return { valido: false, motivo: 'Tenés que enviar la lista completa de permisos por módulo.' }
  }

  const esperados = new Set(codigosModulo)
  const vistos = new Set()

  for (const item of permisos) {
    if (!esperados.has(item.codigoModulo)) {
      return { valido: false, motivo: `El módulo "${item.codigoModulo}" no existe.` }
    }
    if (vistos.has(item.codigoModulo)) {
      return { valido: false, motivo: `El módulo "${item.codigoModulo}" está repetido.` }
    }
    vistos.add(item.codigoModulo)

    if (item.escritura && !item.lectura) {
      return {
        valido: false,
        motivo: `En ${item.codigoModulo}, el permiso de escritura requiere tener habilitada la lectura.`,
      }
    }
  }

  if (vistos.size !== esperados.size) {
    return { valido: false, motivo: 'Tenés que informar los permisos de todos los módulos del sistema.' }
  }

  if (esPerfilProtegido(perfil)) {
    const codigo = PERFILES_PROTEGIDOS[perfil.nombre]
    const propio = permisos.find((p) => p.codigoModulo === codigo)
    if (!propio?.lectura || !propio?.escritura) {
      return {
        valido: false,
        motivo: `El perfil ${perfil.nombre} no puede perder lectura ni escritura en ${codigo}.`,
      }
    }
  }

  return { valido: true }
}

/** Convierte filas de permisos en un mapa por codigo de modulo (para la bitacora). */
export const mapaPermisos = (modulos, permisos) => {
  const porModulo = new Map(permisos.map((p) => [p.idModulo ?? p.codigoModulo, p]))
  const mapa = {}

  for (const mod of modulos) {
    const fila = porModulo.get(mod.idModulo) ?? porModulo.get(mod.codigo)
    mapa[mod.codigo] = {
      lectura: Boolean(fila?.permiteLectura ?? fila?.lectura),
      escritura: Boolean(fila?.permiteEscritura ?? fila?.escritura),
    }
  }

  return mapa
}

