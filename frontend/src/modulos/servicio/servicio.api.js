import { api, consulta } from '../../api/cliente.js'

// Un solo lugar que conoce las rutas del servicio tecnico. Ninguna pantalla
// arma una URL por su cuenta.

// --- Lectura ---------------------------------------------------------------

export const listarEstados = () => api.obtener('/servicio/estados')

/** RF25.1 / RF23.2 — filtrar por estado, cliente o periodo; o solo las sin retirar. */
export const listarOrdenes = ({
  texto, estado, idCliente, desde, hasta, soloNoRetiradas, pagina = 1, tamano = 20,
} = {}) =>
  api.obtener(`/servicio/ordenes${consulta({
    texto, estado, idCliente, desde, hasta,
    soloNoRetiradas: soloNoRetiradas ? 'true' : undefined,
    pagina, tamano,
  })}`)

export const buscarOrden = (idOrden) => api.obtener(`/servicio/ordenes/${idOrden}`)

/** RF25.2 / RF24.2 — historial y garantia de un equipo, por su IMEI o serie. */
export const consultarDispositivo = ({ imei, sellos }) =>
  api.obtener(`/servicio/dispositivos/historial${consulta({ imei, sellos })}`)

// --- Recepcion (RF21) ------------------------------------------------------

export const recepcionarEquipo = (datos) => api.enviar('/servicio/ordenes', datos)

/**
 * RF21.7 — una foto del equipo. Va aparte del alta porque la orden tiene que
 * existir para colgarle archivos.
 */
export const subirFoto = (idOrden, archivo, { momento = 'INGRESO', descripcion } = {}) => {
  const formulario = new FormData()
  formulario.append('foto', archivo)
  formulario.append('momento', momento)
  if (descripcion) formulario.append('descripcion', descripcion)
  return api.subir(`/servicio/ordenes/${idOrden}/fotos`, formulario)
}

// --- Proceso de reparacion (RF22) ------------------------------------------

export const registrarDiagnostico = (idOrden, diagnostico) =>
  api.enviar(`/servicio/ordenes/${idOrden}/diagnostico`, { diagnostico })

export const registrarPresupuesto = (idOrden, monto) =>
  api.enviar(`/servicio/ordenes/${idOrden}/presupuesto`, { monto })

export const responderPresupuesto = (idOrden, aprobado, observacion) =>
  api.enviar(`/servicio/ordenes/${idOrden}/respuesta-presupuesto`, { aprobado, observacion })

export const cambiarEstado = (idOrden, codigo, observacion) =>
  api.enviar(`/servicio/ordenes/${idOrden}/estado`, { codigo, observacion })

export const agregarRepuesto = (idOrden, idProducto, cantidad) =>
  api.enviar(`/servicio/ordenes/${idOrden}/repuestos`, { idProducto, cantidad })

export const quitarRepuesto = (idOrden, idRepuesto) =>
  api.borrar(`/servicio/ordenes/${idOrden}/repuestos/${idRepuesto}`)

export const registrarTarea = (idOrden, descripcion) =>
  api.enviar(`/servicio/ordenes/${idOrden}/tareas`, { descripcion })

// --- Notificacion y entrega (RF23) -----------------------------------------

export const notificarCliente = (idOrden, medio, observacion) =>
  api.enviar(`/servicio/ordenes/${idOrden}/notificacion`, { medio, observacion })

export const entregarEquipo = (idOrden, conformidad, observacion) =>
  api.enviar(`/servicio/ordenes/${idOrden}/entrega`, { conformidad, observacion })

// --- Documentos ------------------------------------------------------------
// Rutas SIN el prefijo /api: abrirDocumento lo antepone.

/** RF21.9 — la orden, lista para imprimir. */
export const rutaOrden = (idOrden) => `/servicio/ordenes/${idOrden}/documento`

export const rutaFoto = (idOrden, idFoto) => `/servicio/ordenes/${idOrden}/fotos/${idFoto}`
