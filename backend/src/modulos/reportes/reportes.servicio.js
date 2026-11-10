import { sequelize } from '../../config/base-de-datos.js'
import { DatosInvalidos } from '../../errores.js'
import { inicioDeDia, finDeDia } from '../servicio/servicio.reglas.js'
import {
  rangoValido,
  instanteUtc,
  resumirVentasPeriodo,
  valorizacionVisible,
  resumirServicioPeriodo,
} from './reportes.reglas.js'

const limitesDelPeriodo = ({ desde, hasta }) => {
  const { valido, motivo } = rangoValido({ desde, hasta })
  if (!valido) throw new DatosInvalidos(motivo)

  return {
    desdeInstante: instanteUtc(inicioDeDia(desde)),
    hastaInstante: instanteUtc(finDeDia(hasta)),
  }
}

/**
 * RF26.1 y RF26.2 — reporte de ventas y desglose por medio de pago.
 * Filtra por rango sobre `venta(fecha_hora, estado)` (ix_venta_fecha_estado)
 * y agrupa en hora local de Formosa (UTC-3).
 */
export const reporteVentas = async ({ desde, hasta }) => {
  const { desdeInstante, hastaInstante } = limitesDelPeriodo({ desde, hasta })
  const replacements = { desde: desdeInstante, hasta: hastaInstante }

  const [totalesPorEstado] = await sequelize.query(`
    SELECT estado,
           COUNT(*) AS operaciones,
           COALESCE(SUM(monto_total + recargo_financiacion), 0) AS importe
      FROM venta
     WHERE fecha_hora >= :desde
       AND fecha_hora <= :hasta
     GROUP BY estado
  `, { replacements })

  const [porDia] = await sequelize.query(`
    SELECT DATE_FORMAT(DATE_SUB(fecha_hora, INTERVAL 3 HOUR), '%Y-%m-%d') AS fecha,
           COUNT(*) AS operaciones,
           COALESCE(SUM(monto_total + recargo_financiacion), 0) AS importe
      FROM venta
     WHERE estado = 'CONFIRMADA'
       AND fecha_hora >= :desde
       AND fecha_hora <= :hasta
     GROUP BY DATE_FORMAT(DATE_SUB(fecha_hora, INTERVAL 3 HOUR), '%Y-%m-%d')
     ORDER BY fecha ASC
  `, { replacements })

  const [porMedioPago] = await sequelize.query(`
    SELECT mp.id_medio_pago AS idMedioPago,
           mp.nombre AS medioPago,
           COUNT(DISTINCT v.id_venta) AS operaciones,
           COALESCE(SUM(pv.importe), 0) AS importe
      FROM venta v
      JOIN pago_venta pv ON pv.id_venta = v.id_venta
      JOIN medio_pago mp ON mp.id_medio_pago = pv.id_medio_pago
     WHERE v.estado = 'CONFIRMADA'
       AND v.fecha_hora >= :desde
       AND v.fecha_hora <= :hasta
     GROUP BY mp.id_medio_pago, mp.nombre
     ORDER BY importe DESC, mp.nombre ASC
  `, { replacements })

  return {
    periodo: { desde, hasta },
    ...resumirVentasPeriodo({ totalesPorEstado, porDia, porMedioPago }),
  }
}

/**
 * RF27.1 — productos por debajo de su nivel minimo de existencias, desde la
 * vista v_stock_bajo_minimo, ordenados por faltante y paginados.
 */
export const reporteStockBajoMinimo = async ({ limit, offset }) => {
  const [[{ total }]] = await sequelize.query(`
    SELECT COUNT(*) AS total
      FROM v_stock_bajo_minimo
  `)

  const [rows] = await sequelize.query(`
    SELECT id_producto AS idProducto,
           codigo_interno AS codigoInterno,
           denominacion,
           categoria,
           marca,
           stock_actual AS stockActual,
           stock_minimo AS stockMinimo,
           faltante
      FROM v_stock_bajo_minimo
     ORDER BY faltante DESC, denominacion ASC
     LIMIT :limit OFFSET :offset
  `, { replacements: { limit, offset } })

  return {
    count: Number(total ?? 0),
    rows: rows.map((fila) => ({
      idProducto: Number(fila.idProducto),
      codigoInterno: fila.codigoInterno,
      denominacion: fila.denominacion,
      categoria: fila.categoria,
      marca: fila.marca,
      stockActual: Number(fila.stockActual),
      stockMinimo: Number(fila.stockMinimo),
      faltante: Number(fila.faltante),
    })),
  }
}

/**
 * RF27.2 — valorizacion del inventario por categoria desde
 * v_valorizacion_inventario, respetando RF04.2 (costos segun perfil).
 */
export const reporteValorizacion = async (perfil) => {
  const [filas] = await sequelize.query(`
    SELECT categoria,
           articulos,
           unidades,
           valor_costo AS valorCosto,
           valor_venta AS valorVenta
      FROM v_valorizacion_inventario
     ORDER BY valor_venta DESC, categoria ASC
  `)

  return valorizacionVisible(filas, perfil)
}

/**
 * RF28 — ordenes de servicio ingresadas en el periodo por estado, mas totales
 * y ordenes no retiradas fuera de plazo (v_ordenes_no_retiradas).
 */
export const reporteServicio = async ({ desde, hasta }) => {
  const { desdeInstante, hastaInstante } = limitesDelPeriodo({ desde, hasta })
  const replacements = { desde: desdeInstante, hasta: hastaInstante }

  const [porEstado] = await sequelize.query(`
    SELECT eo.codigo,
           eo.nombre,
           eo.es_final AS esFinal,
           COUNT(o.id_orden) AS cantidad,
           COALESCE(SUM(o.monto_total), 0) AS monto
      FROM estado_orden eo
      LEFT JOIN orden_servicio o
        ON o.id_estado_actual = eo.id_estado
       AND o.fecha_ingreso >= :desde
       AND o.fecha_ingreso <= :hasta
     GROUP BY eo.id_estado, eo.codigo, eo.nombre, eo.es_final, eo.orden_secuencia
     ORDER BY eo.orden_secuencia ASC
  `, { replacements })

  const [[totales]] = await sequelize.query(`
    SELECT COUNT(*) AS ingresadas,
           COALESCE(SUM(CASE WHEN fecha_entrega IS NOT NULL THEN 1 ELSE 0 END), 0) AS entregadas,
           COALESCE(SUM(recargo_aplicado), 0) AS recargosCobrados,
           COALESCE(SUM(monto_total), 0) AS montoTotal
      FROM orden_servicio
     WHERE fecha_ingreso >= :desde
       AND fecha_ingreso <= :hasta
  `, { replacements })

  const [noRetiradas] = await sequelize.query(`
    SELECT id_orden AS idOrden,
           numero_orden AS numeroOrden,
           cliente,
           telefono_whatsapp AS telefonoWhatsapp,
           fecha_notificacion AS fechaNotificacion,
           dias_desde_notificacion AS diasDesdeNotificacion,
           monto_total AS montoTotal,
           recargo_sugerido AS recargoSugerido
      FROM v_ordenes_no_retiradas
     ORDER BY dias_desde_notificacion DESC, numero_orden ASC
  `)

  return {
    periodo: { desde, hasta },
    ...resumirServicioPeriodo({ porEstado, totales, noRetiradas }),
  }
}

