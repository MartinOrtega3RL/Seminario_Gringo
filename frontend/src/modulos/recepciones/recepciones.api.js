import { api, consulta } from '../../api/cliente.js'

export const listarRecepciones = ({ estado, idProveedor, desde, hasta, pagina = 1, tamano = 25 } = {}) =>
  api.obtener(`/recepciones${consulta({ estado, idProveedor, desde, hasta, pagina, tamano })}`)

export const listarProveedoresRecepcion = () => api.obtener('/recepciones/proveedores')

export const buscarRecepcion = (idRecepcion) => api.obtener(`/recepciones/${idRecepcion}`)

export const crearRecepcionManual = (datos) => api.enviar('/recepciones', datos)

export const crearRecepcionOcr = (formulario) => api.subir('/recepciones/ocr', formulario)

export const actualizarLineasRecepcion = (idRecepcion, lineas) =>
  api.modificar(`/recepciones/${idRecepcion}/lineas`, { lineas })

export const confirmarRecepcion = (idRecepcion) =>
  api.enviar(`/recepciones/${idRecepcion}/confirmar`)

export const eliminarRecepcion = (idRecepcion) =>
  api.borrar(`/recepciones/${idRecepcion}`)

export const rutaImagenComprobante = (idRecepcion) => `/recepciones/${idRecepcion}/imagen`

