import { api, consulta } from '../../api/cliente.js'

export const listarClientes = ({ texto, pagina = 1, tamano = 8 } = {}) =>
  api.obtener(`/clientes${consulta({ texto, pagina, tamano })}`)

export const buscarCliente = (idCliente) => api.obtener(`/clientes/${idCliente}`)

export const listarTiposCliente = () => api.obtener('/clientes/tipos')

export const registrarCliente = (datos) => api.enviar('/clientes', datos)

export const modificarCliente = (idCliente, datos) => api.modificar(`/clientes/${idCliente}`, datos)

export const darDeBajaCliente = (idCliente) => api.borrar(`/clientes/${idCliente}`)

export const listarComprasCliente = (idCliente, { pagina = 1, tamano = 15 } = {}) =>
  api.obtener(`/clientes/${idCliente}/compras${consulta({ pagina, tamano })}`)

export const listarReparacionesCliente = (idCliente, { pagina = 1, tamano = 15 } = {}) =>
  api.obtener(`/clientes/${idCliente}/reparaciones${consulta({ pagina, tamano })}`)
