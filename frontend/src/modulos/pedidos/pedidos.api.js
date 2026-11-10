import { api, consulta, ErrorDeApi, guardarToken, leerToken } from '../../api/cliente.js'

const enviarParche = async (ruta, cuerpo) => {
  const token = leerToken()

  let respuesta
  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(cuerpo),
    })
  } catch {
    throw new ErrorDeApi({
      mensaje: 'No se pudo contactar al servidor. Revisa que este encendido.',
      codigo: 'SIN_CONEXION',
      estado: 0,
    })
  }

  if (respuesta.status === 401) guardarToken(null)

  const datos = await respuesta.json()
  if (respuesta.ok) return datos
  throw new ErrorDeApi({ ...datos.error, estado: respuesta.status })
}

export const listarPedidos = ({ estado, idCliente, pagina = 1, tamano = 25 } = {}) =>
  api.obtener(`/pedidos${consulta({ estado, idCliente, pagina, tamano })}`)

export const registrarPedido = (datos) => api.enviar('/pedidos', datos)

export const actualizarEstadoPedido = (idPedido, datos) =>
  enviarParche(`/pedidos/${idPedido}/estado`, datos)

