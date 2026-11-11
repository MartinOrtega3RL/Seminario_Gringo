// Reglas puras de la matriz de permisos en la interfaz (RF03.3).

// Cada perfil protegido conserva el modulo sin el cual nadie podria volver a
// configurarlo: Soporte la matriz y la bitacora, Administrador los usuarios.
export const PERFILES_PROTEGIDOS = {
  Soporte: 'SOPORTE_SISTEMA',
  Administrador: 'ADMIN_SEGURIDAD',
}

/**
 * RF03.3 — regla de coherencia al tildar casillas:
 * - marcar escritura marca lectura;
 * - desmarcar lectura desmarca escritura.
 */
export const alternarPermiso = (actual, campo, valor) => {
  if (campo === 'escritura') {
    return valor
      ? { lectura: true, escritura: true }
      : { lectura: Boolean(actual?.lectura), escritura: false }
  }
  // campo === 'lectura'
  return valor
    ? { lectura: true, escritura: Boolean(actual?.escritura) }
    : { lectura: false, escritura: false }
}

export const esCeldaProtegida = (perfil, codigoModulo) =>
  Object.hasOwn(PERFILES_PROTEGIDOS, perfil?.nombre ?? '') && PERFILES_PROTEGIDOS[perfil.nombre] === codigoModulo

export const serializarPermisos = (modulos, mapa) =>
  modulos.map((mod) => ({
    codigoModulo: mod.codigo,
    lectura: Boolean(mapa?.[mod.codigo]?.lectura),
    escritura: Boolean(mapa?.[mod.codigo]?.escritura),
  }))

