// RF09.2 — etiqueta imprimible con el codigo de barras, la denominacion y el
// precio del producto.
//
// Va detras de una interfaz por el mismo motivo que el comprobante: hoy se
// imprime en hoja comun (la impresora que tiene el comercio), y el dia que
// aparezca una impresora de etiquetas adhesivas el formato cambia entero sin
// que el catalogo se entere.
//
// S07 aclara que el comercio NO tiene lector optico y no lo prevé. El codigo
// de barras se imprime igual porque el titular lo pidio expresamente (H02):
// es identificacion visual del articulo en la gondola, no entrada de datos.

/**
 * @typedef {object} EtiquetaEmitida
 * @property {string} contenido
 * @property {string} tipoMime
 * @property {string} nombreArchivo
 */

/**
 * @typedef {object} GeneradorEtiqueta
 * @property {string} formato
 * @property {(producto: object, cantidad: number) => Promise<EtiquetaEmitida>} generar
 */

export const verificarGeneradorEtiqueta = (generador) => {
  if (!generador?.formato || typeof generador.generar !== 'function') {
    throw new Error('El generador de etiquetas no cumple el contrato: necesita formato y generar().')
  }
  return generador
}
