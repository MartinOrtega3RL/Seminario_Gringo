// Lo minimo que necesita cualquier documento que el backend emite como HTML
// imprimible. Todo texto que viene de la base o del usuario pasa por `escapar`
// antes de entrar a una plantilla: un nombre de cliente con un "<" no puede
// romper la hoja ni, peor, ejecutar algo en la ventana que la abre.

export const escapar = (valor) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')

export const fechaLegible = (fecha) => new Date(fecha).toLocaleString('es-AR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})

// Una fecha sin hora ("2026-11-01", como la devuelve una columna DATE) se arma
// con sus partes. `new Date('2026-11-01')` la toma como medianoche UTC y en
// Formosa, a tres horas de UTC, mostraria el 31 de octubre: la garantia
// parecería vencer un dia antes de lo que dice la ficha.
const SOLO_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/

export const soloFecha = (fecha) => {
  const partes = SOLO_FECHA.exec(String(fecha))
  if (partes) return `${partes[3]}/${partes[2]}/${partes[1]}`

  return new Date(fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
