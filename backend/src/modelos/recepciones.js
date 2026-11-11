import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Modulo 3 — Recepcion de mercaderia y extraccion OCR (RF10 / S04)

export const RecepcionMercaderia = sequelize.define('RecepcionMercaderia', {
  idRecepcion: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_recepcion' },
  idProveedor: { type: DataTypes.INTEGER, allowNull: false, field: 'id_proveedor' },
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  tipoComprobante: {
    type: DataTypes.ENUM('FACTURA', 'REMITO', 'OTRO'),
    allowNull: false,
    defaultValue: 'FACTURA',
    field: 'tipo_comprobante',
  },
  numeroComprobante: { type: DataTypes.STRING(40), allowNull: true, field: 'numero_comprobante' },
  fechaComprobante: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_comprobante' },
  fechaRegistro: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW, field: 'fecha_registro' },
  origenCarga: {
    type: DataTypes.ENUM('MANUAL', 'OCR'),
    allowNull: false,
    defaultValue: 'MANUAL',
    field: 'origen_carga',
  },
  imagenComprobante: { type: DataTypes.STRING(255), allowNull: true, field: 'imagen_comprobante' },
  estado: {
    type: DataTypes.ENUM('PENDIENTE_VALIDACION', 'CONFIRMADA', 'ANULADA'),
    allowNull: false,
    defaultValue: 'PENDIENTE_VALIDACION',
  },
  montoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'monto_total' },
  fechaConfirmacion: { type: DataTypes.DATE, allowNull: true, field: 'fecha_confirmacion' },
}, { tableName: 'recepcion_mercaderia' })

export const OcrExtraccion = sequelize.define('OcrExtraccion', {
  idExtraccion: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_extraccion' },
  idRecepcion: { type: DataTypes.INTEGER, allowNull: false, field: 'id_recepcion' },
  fechaProcesamiento: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'fecha_procesamiento',
  },
  motorOcr: { type: DataTypes.STRING(60), allowNull: true, field: 'motor_ocr' },
  textoExtraido: { type: DataTypes.TEXT('long'), allowNull: true, field: 'texto_extraido' },
  confianzaPromedio: { type: DataTypes.DECIMAL(5, 2), allowNull: true, field: 'confianza_promedio' },
  estado: {
    type: DataTypes.ENUM('PROCESADO', 'ERROR'),
    allowNull: false,
    defaultValue: 'PROCESADO',
  },
  mensajeError: { type: DataTypes.STRING(300), allowNull: true, field: 'mensaje_error' },
}, { tableName: 'ocr_extraccion' })

export const DetalleRecepcion = sequelize.define('DetalleRecepcion', {
  idDetalleRecepcion: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_detalle_recepcion' },
  idRecepcion: { type: DataTypes.INTEGER, allowNull: false, field: 'id_recepcion' },
  idProducto: { type: DataTypes.INTEGER, allowNull: true, field: 'id_producto' },
  descripcionOriginal: { type: DataTypes.STRING(200), allowNull: true, field: 'descripcion_original' },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  precioCosto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'precio_costo' },
  validado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
}, { tableName: 'detalle_recepcion' })

