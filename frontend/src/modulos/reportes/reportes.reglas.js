import { hoyIso, soloFecha } from '../servicio/servicio.reglas.js'

const dosDigitos = (n) => String(n).padStart(2, '0')

/** Del primer dia del mes en curso hasta hoy, en hora local. */
export const mesEnCurso = (hoy = new Date()) => ({
  desde: `${hoy.getFullYear()}-${dosDigitos(hoy.getMonth() + 1)}-01`,
  hasta: `${hoy.getFullYear()}-${dosDigitos(hoy.getMonth() + 1)}-${dosDigitos(hoy.getDate())}`,
})

export const etiquetaPeriodo = (desde, hasta) => {
  if (!desde && !hasta) return 'Todo el período'
  if (desde && hasta) return `Del ${soloFecha(desde)} al ${soloFecha(hasta)}`
  return soloFecha(desde || hasta)
}

export const hoyReporte = () => hoyIso()

