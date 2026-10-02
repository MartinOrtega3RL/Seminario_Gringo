// El unico limite completo del sistema, y esta justificado por escrito:
// S05 declara que en esta etapa se emiten comprobantes internos no fiscales,
// "postergando la integracion con controladores fiscales para fases futuras".
//
// El servicio de ventas depende de este contrato, nunca de una implementacion.
// Cuando llegue el controlador fiscal se agrega comprobante.fiscal.js y no se
// toca una linea de ventas.servicio.js.

/**
 * @typedef {object} ComprobanteEmitido
 * @property {string} contenido      cuerpo del comprobante
 * @property {string} tipoMime       ej. 'text/html; charset=utf-8'
 * @property {string} nombreArchivo  ej. 'comprobante-0001-00000042.html'
 */

/**
 * @typedef {object} GeneradorComprobante
 * @property {string} formato  identificador legible, ej. 'html-no-fiscal'
 * @property {(venta: object) => Promise<ComprobanteEmitido>} generar
 */

/**
 * Verifica que una implementacion cumpla el contrato. Se llama en main.js al
 * armar el sistema: si falta un metodo, el servidor no arranca, en vez de
 * fallar cuando alguien cierra su primera venta.
 * @param {GeneradorComprobante} generador
 */
export const verificarGenerador = (generador) => {
  const falta = ['formato', 'generar'].filter((clave) => generador?.[clave] === undefined)

  if (falta.length > 0) {
    throw new Error(`El generador de comprobantes no cumple el contrato: falta ${falta.join(', ')}.`)
  }
  if (typeof generador.generar !== 'function') {
    throw new Error('El generador de comprobantes debe exponer generar() como funcion.')
  }

  return generador
}
