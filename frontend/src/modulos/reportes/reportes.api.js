import { api, consulta } from '../../api/cliente.js'

export const reporteVentas = ({ desde, hasta }) =>
  api.obtener(`/reportes/ventas${consulta({ desde, hasta })}`)

export const reporteStockBajoMinimo = ({ pagina = 1, tamano = 25 } = {}) =>
  api.obtener(`/reportes/stock-bajo-minimo${consulta({ pagina, tamano })}`)

export const reporteValorizacion = () =>
  api.obtener('/reportes/valorizacion')

export const reporteServicio = ({ desde, hasta }) =>
  api.obtener(`/reportes/servicio${consulta({ desde, hasta })}`)

