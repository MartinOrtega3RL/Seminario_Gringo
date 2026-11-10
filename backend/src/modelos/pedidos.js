import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Ventas / Pedidos pendientes (RF19).
export const PedidoPendiente = sequelize.define('PedidoPendiente', {
  idPedido: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_pedido' },
  idCliente: { type: DataTypes.INTEGER, allowNull: false, field: 'id_cliente' },
  // Nulo si el articulo pedido aun no existe en el catalogo (ck_pedido_identificacion).
  idProducto: { type: DataTypes.INTEGER, allowNull: true, field: 'id_producto' },
  descripcionPedido: { type: DataTypes.STRING(200), allowNull: true, field: 'descripcion_pedido' },
  // Sale del token, nunca del cuerpo de la peticion.
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  cantidad: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  fechaSolicitud: { type: DataTypes.DATE, field: 'fecha_solicitud' },
  fechaResolucion: { type: DataTypes.DATE, allowNull: true, field: 'fecha_resolucion' },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'DISPONIBLE', 'ENTREGADO', 'CANCELADO'),
    allowNull: false,
    defaultValue: 'PENDIENTE',
  },
  observacion: { type: DataTypes.STRING(300), allowNull: true },
}, { tableName: 'pedido_pendiente', timestamps: false, freezeTableName: true })

