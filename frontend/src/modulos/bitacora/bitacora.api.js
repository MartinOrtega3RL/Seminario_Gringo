import { api, consulta } from '../../api/cliente.js'

export const listarBitacora = ({
  desde, hasta, idUsuario, entidad, accion, pagina = 1, tamano = 25,
} = {}) =>
  api.obtener(`/bitacora${consulta({ desde, hasta, idUsuario, entidad, accion, pagina, tamano })}`)

