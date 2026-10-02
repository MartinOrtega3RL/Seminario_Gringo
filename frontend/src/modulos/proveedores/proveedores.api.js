import { api, consulta } from '../../api/cliente.js'

// RF15 — proveedores. Viven bajo el mismo permiso que clientes: el modulo 3
// de la carpeta es «Clientes y proveedores», uno solo.

export const listarProveedores = ({ texto, pagina = 1, tamano = 20 } = {}) =>
  api.obtener(`/proveedores${consulta({ texto, pagina, tamano })}`)

export const buscarProveedor = (idProveedor) => api.obtener(`/proveedores/${idProveedor}`)

/** RF15.2 — que productos se le compran a este proveedor. */
export const listarProductosDelProveedor = (idProveedor) =>
  api.obtener(`/proveedores/${idProveedor}/productos`)

export const registrarProveedor = (datos) => api.enviar('/proveedores', datos)

export const modificarProveedor = (idProveedor, datos) =>
  api.modificar(`/proveedores/${idProveedor}`, datos)

/** Baja LOGICA: las recepciones de mercaderia siguen diciendo a quien se le compro. */
export const darDeBajaProveedor = (idProveedor) => api.borrar(`/proveedores/${idProveedor}`)
