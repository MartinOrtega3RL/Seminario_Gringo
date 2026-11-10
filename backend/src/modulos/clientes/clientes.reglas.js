// Reglas del padron que se deciden sin consultar la base.

import { aCentavos, aPesos } from '../ventas/ventas.reglas.js'

/** El nombre para mostrar sale de persona; cliente solo agrega lo comercial. */
export const nombreVisible = (cliente) =>
  cliente?.persona?.apellidoNombre?.trim() || 'Sin nombre'

/**
 * RF16.5 — la clasificacion del cliente determina la lista aplicable.
 * Sin cliente asociado (venta de mostrador) rige la minorista.
 */
export const listaDelCliente = (cliente) =>
  cliente?.tipoCliente?.listaPrecioAplicable ?? 'MINORISTA'

/**
 * Normaliza un numero de WhatsApp argentino a solo digitos, conservando el
 * cero y el quince si el operador los escribio: el sistema no llama, solo
 * guarda lo que se cargo, y "corregir" un numero valido seria peor que dejarlo.
 */
export const normalizarContacto = (valor) => {
  const limpio = String(valor ?? '').replace(/[^\d+]/g, '')
  return limpio || null
}

/**
 * Un documento repetido no puede existir: la base tiene UNIQUE sobre el par
 * (tipo, numero). Verificarlo antes deja un mensaje entendible en vez de que
 * salte la restriccion como error tecnico (RNF08).
 */
export const documentoCompleto = ({ tipoDocumento, numeroDocumento }) => {
  if (!tipoDocumento && !numeroDocumento) return true
  return Boolean(tipoDocumento && numeroDocumento)
}

/** Resume las lineas de una venta para el renglon del historial (RF14.1). */
export const resumirProductosVenta = (detalle = []) => {
  if (!detalle?.length) return null
  const unidades = detalle.reduce((suma, linea) => suma + Number(linea.cantidad ?? 0), 0)
  const primero = detalle[0].producto?.denominacion ?? 'Producto dado de baja'
  const resto = detalle.length - 1
  return `${unidades} u. · ${primero}${resto > 0 ? ` y ${resto} más` : ''}`
}

/** RF14.1 — forma plana de una compra en el historial del cliente. */
export const formatearCompraHistorial = (venta) => {
  const totalCentavos = aCentavos(venta.montoTotal ?? 0) + aCentavos(venta.recargoFinanciacion ?? 0)
  return {
    idVenta: venta.idVenta,
    fechaHora: venta.fechaHora,
    numeroComprobante: venta.numeroComprobante,
    total: Number(aPesos(totalCentavos)),
    estado: venta.estado,
    modalidadPago: venta.modalidadPago,
    cantidadCuotas: venta.cantidadCuotas ?? null,
    listaPrecioAplicada: venta.listaPrecioAplicada,
    medioPago: venta.pago?.medioPago?.nombre ?? null,
    resumenProductos: resumirProductosVenta(venta.detalle),
  }
}

/** RF14.2 — forma plana de una reparacion en el historial del cliente. */
export const formatearReparacionHistorial = (orden) => ({
  idOrden: orden.idOrden,
  numeroOrden: orden.numeroOrden,
  fechaIngreso: orden.fechaIngreso,
  fallaDeclarada: orden.fallaDeclarada,
  equipo: {
    marca: orden.dispositivo?.modelo?.marca?.nombre ?? null,
    modelo: orden.dispositivo?.modelo?.denominacion ?? null,
    imeiSerie: orden.dispositivo?.imeiSerie ?? null,
  },
  estado: orden.estado
    ? {
        codigo: orden.estado.codigo,
        nombre: orden.estado.nombre,
        esFinal: Boolean(orden.estado.esFinal),
      }
    : null,
  total: Number(orden.montoTotal ?? 0),
  montoPresupuestado: orden.montoPresupuestado != null ? Number(orden.montoPresupuestado) : null,
  fechaVencGarantia: orden.fechaVencGarantia ?? null,
  fechaEntrega: orden.fechaEntrega ?? null,
  idOrdenAnterior: orden.idOrdenAnterior ?? null,
})
