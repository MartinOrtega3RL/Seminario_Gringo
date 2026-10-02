import { Permiso, Modulo } from '../../modelos/index.js'
import { SinPermiso } from '../../errores.js'

// RNF18: el servidor valida los permisos en cada operacion, con independencia
// de lo que muestre la interfaz. Ocultar un boton (RF04.1) es comodidad para
// el usuario; no impide que alguien invoque el endpoint directamente.

// La matriz son 18 filas que casi nunca cambian. Se lee una vez por perfil.
const cache = new Map()

const cargarPermisos = async (idPerfil) => {
  const filas = await Permiso.findAll({
    where: { idPerfil },
    include: [{ model: Modulo, as: 'modulo', attributes: ['codigo'] }],
  })

  const matriz = Object.fromEntries(filas.map((fila) => [
    fila.modulo.codigo,
    { lectura: fila.permiteLectura, escritura: fila.permiteEscritura },
  ]))

  cache.set(idPerfil, matriz)
  return matriz
}

const permisosDe = async (idPerfil) => cache.get(idPerfil) ?? cargarPermisos(idPerfil)

// Invalidar tras modificar la matriz, para no reiniciar el servidor.
export const olvidarPermisos = () => cache.clear()

/**
 * @param {string} codigoModulo  codigo de la tabla modulo (ej. 'VENTAS')
 * @param {'lectura'|'escritura'} accion
 */
export const autorizar = (codigoModulo, accion = 'lectura') =>
  async (peticion, _respuesta, siguiente) => {
    const matriz = await permisosDe(peticion.usuario.idPerfil)
    const permiso = matriz[codigoModulo]

    if (!permiso?.[accion]) {
      throw new SinPermiso(
        `El perfil ${peticion.usuario.perfil} no tiene permiso de ${accion} sobre ${codigoModulo}.`,
      )
    }

    siguiente()
  }
