import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Ventas. La venta es la raiz del agregado; su detalle y su pago
// pertenecen al agregado y no se tocan por fuera de el.

export const MedioPago = sequelize.define('MedioPago', {
  idMedioPago: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_medio_pago' },
  nombre: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'medio_pago' })

export const Venta = sequelize.define('Venta', {
  idVenta: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_venta' },
  // Nulo: venta de mostrador sin cliente registrado.
  idCliente: { type: DataTypes.INTEGER, allowNull: true, field: 'id_cliente' },
  // Sale del token, nunca del cuerpo de la peticion.
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  numeroComprobante: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'numero_comprobante' },
  fechaHora: { type: DataTypes.DATE, field: 'fecha_hora' },

  listaPrecioAplicada: {
    type: DataTypes.ENUM('MINORISTA', 'MAYORISTA'),
    allowNull: false,
    defaultValue: 'MINORISTA',
    field: 'lista_precio_aplicada',
  },
  montoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'monto_total' },

  // RF16.8. La base exige: CONTADO obliga cantidadCuotas nula; el resto, >= 1.
  modalidadPago: {
    type: DataTypes.ENUM('CONTADO', 'FINANCIACION_PROPIA', 'TARJETA_CUOTAS', 'GO_CUOTAS'),
    allowNull: false,
    defaultValue: 'CONTADO',
    field: 'modalidad_pago',
  },
  cantidadCuotas: { type: DataTypes.TINYINT.UNSIGNED, allowNull: true, field: 'cantidad_cuotas' },
  recargoFinanciacion: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'recargo_financiacion' },

  // RF17.3. Envio a domicilio obliga a informar el domicilio.
  modalidadEntrega: {
    type: DataTypes.ENUM('RETIRO_LOCAL', 'ENVIO_DOMICILIO'),
    allowNull: false,
    defaultValue: 'RETIRO_LOCAL',
    field: 'modalidad_entrega',
  },
  domicilioEntrega: { type: DataTypes.STRING(200), allowNull: true, field: 'domicilio_entrega' },

  // RF18.2. Anular exige responsable y fecha; la base lo verifica con un CHECK.
  estado: { type: DataTypes.ENUM('CONFIRMADA', 'ANULADA'), allowNull: false, defaultValue: 'CONFIRMADA' },
  idUsuarioAnulacion: { type: DataTypes.INTEGER, allowNull: true, field: 'id_usuario_anulacion' },
  fechaAnulacion: { type: DataTypes.DATE, allowNull: true, field: 'fecha_anulacion' },
  motivoAnulacion: { type: DataTypes.STRING(300), allowNull: true, field: 'motivo_anulacion' },
}, { tableName: 'venta' })

// El precio y el costo se congelan al confirmar: un cambio de precio posterior
// no altera una venta ya registrada.
export const DetalleVenta = sequelize.define('DetalleVenta', {
  idDetalle: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_detalle' },
  idVenta: { type: DataTypes.INTEGER, allowNull: false, field: 'id_venta' },
  idProducto: { type: DataTypes.INTEGER, allowNull: false, field: 'id_producto' },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  precioUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'precio_unitario' },
  costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
}, { tableName: 'detalle_venta' })

// Uno por operacion: la base lo garantiza con un UNIQUE sobre id_venta.
export const PagoVenta = sequelize.define('PagoVenta', {
  idPago: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_pago' },
  idVenta: { type: DataTypes.INTEGER, allowNull: false, unique: true, field: 'id_venta' },
  idMedioPago: { type: DataTypes.INTEGER, allowNull: false, field: 'id_medio_pago' },
  importe: { type: DataTypes.DECIMAL(12, 2), allowNull: false },
  referencia: { type: DataTypes.STRING(60), allowNull: true },
}, { tableName: 'pago_venta' })
