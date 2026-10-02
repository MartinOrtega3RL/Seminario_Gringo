import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Catalogo: clasificaciones y productos.

export const Categoria = sequelize.define('Categoria', {
  idCategoria: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_categoria' },
  nombre: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'categoria' })

export const Marca = sequelize.define('Marca', {
  idMarca: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_marca' },
  nombre: { type: DataTypes.STRING(60), allowNull: false, unique: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'marca' })

// RF06.8 — modelos de dispositivo con los que un producto es compatible.
// H23: cuando falta el repuesto exacto, encontrar el que se adapta es lo que
// salva la venta. H24: el comercio trabaja Apple y Android por igual.
export const ModeloDispositivo = sequelize.define('ModeloDispositivo', {
  idModelo: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_modelo' },
  idMarca: { type: DataTypes.INTEGER, allowNull: false, field: 'id_marca' },
  denominacion: { type: DataTypes.STRING(80), allowNull: false },
  sistemaOperativo: {
    type: DataTypes.ENUM('ANDROID', 'IOS', 'OTRO'),
    allowNull: true,
    field: 'sistema_operativo',
  },
}, { tableName: 'modelo_dispositivo' })

// Asociativa producto x modelo. Sin columnas propias: solo relaciona.
export const ProductoModeloCompatible = sequelize.define('ProductoModeloCompatible', {
  idProducto: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_producto' },
  idModelo: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_modelo' },
}, { tableName: 'producto_modelo_compatible' })

export const Producto = sequelize.define('Producto', {
  idProducto: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_producto' },
  idCategoria: { type: DataTypes.INTEGER, allowNull: false, field: 'id_categoria' },
  idMarca: { type: DataTypes.INTEGER, allowNull: false, field: 'id_marca' },
  codigoInterno: { type: DataTypes.STRING(30), allowNull: false, unique: true, field: 'codigo_interno' },
  denominacion: { type: DataTypes.STRING(150), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  imagenRuta: { type: DataTypes.STRING(255), allowNull: true, field: 'imagen_ruta' },

  // RF04.2: el precio de costo revela la rentabilidad. Nunca sale en una
  // respuesta sin pasar por catalogo.reglas.js -> visibleSegunPerfil().
  precioCosto: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'precio_costo' },
  precioMinorista: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'precio_minorista' },
  precioMayorista: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'precio_mayorista' },

  stockActual: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'stock_actual' },
  stockMinimo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'stock_minimo' },
  // Columna generada por MySQL (stock_actual <= stock_minimo). Solo lectura.
  bajoMinimo: { type: DataTypes.BOOLEAN, field: 'bajo_minimo' },

  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  creadoEn: { type: DataTypes.DATE, field: 'creado_en' },
  actualizadoEn: { type: DataTypes.DATE, field: 'actualizado_en' },
}, {
  tableName: 'producto',
  // Bloqueo optimista para la EDICION de la ficha (RF06.2, RF08): impide que
  // dos personas se pisen los cambios. NO es lo que protege las existencias
  // durante una venta: eso lo hace el UPDATE con guarda de existencias.servicio.js.
  version: 'version_registro',
})
