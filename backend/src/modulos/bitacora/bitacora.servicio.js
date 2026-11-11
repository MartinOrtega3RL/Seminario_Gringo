import { Op } from 'sequelize'
import { Bitacora, Usuario, Persona } from '../../modelos/index.js'
import { usuarioActual } from '../../http/contexto.js'
import { inicioDeDia, finDeDia } from '../../http/fechas.js'
import { limpiarDatosBitacora } from './bitacora.reglas.js'

/**
 * RF05 — registra una operacion critica en la tabla `bitacora`.
 * Toma `idUsuario` e `ip` del contexto de la peticion (salvo cuando se informa
 * explicitamente, como en el inicio de sesion). Si no hay usuario (scripts o
 * tareas internas), no registra nada y no falla.
 */
export const registrarEnBitacora = async (
  { entidad, idRegistro = null, accion, antes = null, despues = null, detalle = null, idUsuario = null, ip = null },
  transaction = undefined,
) => {
  const contexto = usuarioActual()
  const responsable = idUsuario ?? contexto?.idUsuario ?? null
  if (!responsable) return null

  const { datosAntes, datosDespues, detalle: detalleLimpio } = limpiarDatosBitacora({
    antes,
    despues,
    detalle,
  })

  return Bitacora.create({
    idUsuario: responsable,
    fechaHora: new Date(),
    entidadAfectada: entidad,
    idRegistro: idRegistro ?? null,
    accion,
    datosAntes,
    datosDespues,
    detalle: detalleLimpio,
    direccionIp: ip ?? contexto?.ip ?? null,
  }, transaction ? { transaction } : undefined)
}

/**
 * RF05 — consulta paginada de la bitacora para el Administrador, ordenada de
 * lo mas reciente a lo mas antiguo.
 */
export const listarBitacora = async ({ desde, hasta, idUsuario, entidad, accion, limit, offset }) => {
  const donde = {}
  if (idUsuario) donde.idUsuario = idUsuario
  if (entidad) donde.entidadAfectada = entidad
  if (accion) donde.accion = accion
  if (desde || hasta) {
    donde.fechaHora = {
      ...(desde ? { [Op.gte]: inicioDeDia(desde) } : {}),
      ...(hasta ? { [Op.lte]: finDeDia(hasta) } : {}),
    }
  }

  const resultado = await Bitacora.findAndCountAll({
    where: donde,
    include: [{
      model: Usuario,
      as: 'usuario',
      attributes: ['idUsuario', 'nombreUsuario'],
      include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre'] }],
    }],
    order: [['fechaHora', 'DESC'], ['idBitacora', 'DESC']],
    limit,
    offset,
  })

  return {
    count: resultado.count,
    rows: resultado.rows.map((fila) => {
      const plano = fila.get({ plain: true })
      return {
        idBitacora: Number(plano.idBitacora),
        fechaHora: plano.fechaHora,
        idUsuario: plano.idUsuario,
        usuario: plano.usuario
          ? {
              idUsuario: plano.usuario.idUsuario,
              nombreUsuario: plano.usuario.nombreUsuario,
              apellidoNombre: plano.usuario.persona?.apellidoNombre ?? null,
            }
          : null,
        entidadAfectada: plano.entidadAfectada,
        idRegistro: plano.idRegistro != null ? Number(plano.idRegistro) : null,
        accion: plano.accion,
        datosAntes: plano.datosAntes ?? null,
        datosDespues: plano.datosDespues ?? null,
        detalle: plano.detalle ?? null,
        direccionIp: plano.direccionIp ?? null,
      }
    }),
  }
}

