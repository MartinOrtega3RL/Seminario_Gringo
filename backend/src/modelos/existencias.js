import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Existencias. Toda variacion del saldo deja un movimiento con su
// origen y su responsable: es el libro mayor del inventario (RF11, RF12.4).
//
// INVARIANTE: producto.stock_actual siempre es igual a la suma de
// movimiento_stock.cantidad de ese producto, e igual al stock_resultante del
// ultimo movimiento. Ninguna operacion escribe una tabla sin la otra, y las
// dos ocurren dentro de la misma transaccion.
export const MovimientoStock = sequelize.define('MovimientoStock', {
  idMovimiento: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id_movimiento' },
  idProducto: { type: DataTypes.INTEGER, allowNull: false, field: 'id_producto' },
  // Sale del token, nunca del cuerpo de la peticion.
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  fechaHora: { type: DataTypes.DATE, field: 'fecha_hora' },
  tipoMovimiento: {
    type: DataTypes.ENUM('INGRESO', 'VENTA', 'REPARACION', 'AJUSTE', 'DEVOLUCION'),
    allowNull: false,
    field: 'tipo_movimiento',
  },
  // Positiva en ingresos, negativa en egresos. Nunca cero.
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  stockResultante: { type: DataTypes.INTEGER, allowNull: false, field: 'stock_resultante' },
  // Obligatorio en los ajustes manuales (RF11.5).
  motivo: { type: DataTypes.STRING(200), allowNull: true },

  // Origen excluyente: como maximo uno de los tres. En la iteracion 1 solo se
  // usa idVenta; los otros dos pertenecen a modulos diferidos.
  idRecepcion: { type: DataTypes.INTEGER, allowNull: true, field: 'id_recepcion' },
  idVenta: { type: DataTypes.INTEGER, allowNull: true, field: 'id_venta' },
  idOrden: { type: DataTypes.INTEGER, allowNull: true, field: 'id_orden' },
}, { tableName: 'movimiento_stock' })
