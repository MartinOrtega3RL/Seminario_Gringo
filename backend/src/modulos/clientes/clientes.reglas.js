// Reglas del padron que se deciden sin consultar la base.

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
