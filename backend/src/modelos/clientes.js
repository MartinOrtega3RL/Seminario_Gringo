import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Clientes. Cliente es una especializacion de persona: la identidad
// vive en persona, la relacion comercial vive aca.
//
// Ojo con la palabra "cliente": aca significa una clasificacion de lista de
// precios. En Servicio Tecnico (diferido) significa el dueno de un equipo.
// Son dos cosas distintas y no se unifican.

export const TipoCliente = sequelize.define('TipoCliente', {
  idTipoCliente: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_tipo_cliente' },
  nombre: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  // Determina que precio del producto se aplica en la venta (RF16.5).
  listaPrecioAplicable: {
    type: DataTypes.ENUM('MINORISTA', 'MAYORISTA'),
    allowNull: false,
    field: 'lista_precio_aplicable',
  },
}, { tableName: 'tipo_cliente' })

/**
 * RF15 — proveedores. Igual que cliente, es una especializacion de persona:
 * la identidad vive en persona y aca solo la relacion comercial.
 *
 * Sin columna de tipo a proposito: el titular aclaro que la central se
 * registra como un proveedor mas y no se distingue del resto (H22), asi que
 * la clasificacion que existia se elimino junto con el requerimiento.
 */
export const Proveedor = sequelize.define('Proveedor', {
  idProveedor: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_proveedor' },
  idPersona: { type: DataTypes.INTEGER, allowNull: false, field: 'id_persona' },
  sitioWeb: { type: DataTypes.STRING(200), allowNull: true, field: 'sitio_web' },
  observaciones: { type: DataTypes.STRING(300), allowNull: true },
  fechaAlta: { type: DataTypes.DATE, field: 'fecha_alta' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'proveedor' })

/**
 * RF06.7 — asociativa producto x proveedor: a quien se le compra cada cosa.
 * Sin atributos propios: guardar el codigo del proveedor y su precio de compra
 * queda para una etapa posterior, y las columnas se sacaron para no dejar
 * campos que nadie escribe.
 */
export const ProductoProveedor = sequelize.define('ProductoProveedor', {
  idProducto: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_producto' },
  idProveedor: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_proveedor' },
  actualizadoEn: { type: DataTypes.DATE, field: 'actualizado_en' },
}, { tableName: 'producto_proveedor' })

export const Cliente = sequelize.define('Cliente', {
  idCliente: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_cliente' },
  idPersona: { type: DataTypes.INTEGER, allowNull: false, field: 'id_persona' },
  idTipoCliente: { type: DataTypes.INTEGER, allowNull: false, field: 'id_tipo_cliente' },
  fechaAlta: { type: DataTypes.DATE, field: 'fecha_alta' },
  observaciones: { type: DataTypes.STRING(300), allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'cliente' })
