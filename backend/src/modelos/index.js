// Punto unico donde se declaran las asociaciones. Los archivos de modelo solo
// definen columnas; si cada uno declarara sus relaciones, importarse entre
// ellos crearia ciclos.

import { Persona, Perfil, Modulo, Permiso, Usuario, Sesion } from './acceso.js'
import { Categoria, Marca, Producto, ModeloDispositivo, ProductoModeloCompatible } from './catalogo.js'
import { MovimientoStock } from './existencias.js'
import { TipoCliente, Cliente, Proveedor, ProductoProveedor } from './clientes.js'
import { MedioPago, Venta, DetalleVenta, PagoVenta } from './ventas.js'
import { ParametroSistema } from './sistema.js'

// --- Acceso ------------------------------------------------------------------
Usuario.belongsTo(Persona, { foreignKey: 'idPersona', as: 'persona' })
Usuario.belongsTo(Perfil, { foreignKey: 'idPerfil', as: 'perfil' })
Persona.hasOne(Usuario, { foreignKey: 'idPersona', as: 'usuario' })

Perfil.belongsToMany(Modulo, { through: Permiso, foreignKey: 'idPerfil', otherKey: 'idModulo', as: 'modulos' })
Modulo.belongsToMany(Perfil, { through: Permiso, foreignKey: 'idModulo', otherKey: 'idPerfil', as: 'perfiles' })
Permiso.belongsTo(Perfil, { foreignKey: 'idPerfil', as: 'perfil' })
Permiso.belongsTo(Modulo, { foreignKey: 'idModulo', as: 'modulo' })
Perfil.hasMany(Permiso, { foreignKey: 'idPerfil', as: 'permisos' })

Sesion.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })
Usuario.hasMany(Sesion, { foreignKey: 'idUsuario', as: 'sesiones' })

// --- Catalogo ----------------------------------------------------------------
Producto.belongsTo(Categoria, { foreignKey: 'idCategoria', as: 'categoria' })
Producto.belongsTo(Marca, { foreignKey: 'idMarca', as: 'marca' })
Categoria.hasMany(Producto, { foreignKey: 'idCategoria', as: 'productos' })
Marca.hasMany(Producto, { foreignKey: 'idMarca', as: 'productos' })

// RF06.8 — compatibilidad. Un producto sirve para varios modelos y un modelo
// admite varios productos: es muchos a muchos a traves de la asociativa.
ModeloDispositivo.belongsTo(Marca, { foreignKey: 'idMarca', as: 'marca' })
Marca.hasMany(ModeloDispositivo, { foreignKey: 'idMarca', as: 'modelos' })

Producto.belongsToMany(ModeloDispositivo, {
  through: ProductoModeloCompatible, foreignKey: 'idProducto', otherKey: 'idModelo', as: 'compatibilidades',
})
ModeloDispositivo.belongsToMany(Producto, {
  through: ProductoModeloCompatible, foreignKey: 'idModelo', otherKey: 'idProducto', as: 'productos',
})

// --- Existencias -------------------------------------------------------------
MovimientoStock.belongsTo(Producto, { foreignKey: 'idProducto', as: 'producto' })
MovimientoStock.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })
MovimientoStock.belongsTo(Venta, { foreignKey: 'idVenta', as: 'venta' })
Producto.hasMany(MovimientoStock, { foreignKey: 'idProducto', as: 'movimientos' })
// idRecepcion e idOrden apuntan a tablas de modulos diferidos: existen en la
// base con su clave foranea, pero no se mapean todavia.

// --- Clientes ----------------------------------------------------------------
Cliente.belongsTo(Persona, { foreignKey: 'idPersona', as: 'persona' })
Cliente.belongsTo(TipoCliente, { foreignKey: 'idTipoCliente', as: 'tipoCliente' })
Persona.hasOne(Cliente, { foreignKey: 'idPersona', as: 'cliente' })
TipoCliente.hasMany(Cliente, { foreignKey: 'idTipoCliente', as: 'clientes' })

// --- Proveedores (RF15) ------------------------------------------------------
Proveedor.belongsTo(Persona, { foreignKey: 'idPersona', as: 'persona' })
Persona.hasOne(Proveedor, { foreignKey: 'idPersona', as: 'proveedor' })

// RF06.7 — a que proveedores se le compra cada producto, y RF15.2 al reves:
// que productos se le compran a un proveedor determinado.
Producto.belongsToMany(Proveedor, {
  through: ProductoProveedor, foreignKey: 'idProducto', otherKey: 'idProveedor', as: 'proveedores',
})
Proveedor.belongsToMany(Producto, {
  through: ProductoProveedor, foreignKey: 'idProveedor', otherKey: 'idProducto', as: 'productos',
})

// --- Ventas ------------------------------------------------------------------
Venta.belongsTo(Cliente, { foreignKey: 'idCliente', as: 'cliente' })
Venta.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'vendedor' })
Venta.belongsTo(Usuario, { foreignKey: 'idUsuarioAnulacion', as: 'anuladoPor' })

Venta.hasMany(DetalleVenta, { foreignKey: 'idVenta', as: 'detalle' })
DetalleVenta.belongsTo(Venta, { foreignKey: 'idVenta', as: 'venta' })
DetalleVenta.belongsTo(Producto, { foreignKey: 'idProducto', as: 'producto' })

Venta.hasOne(PagoVenta, { foreignKey: 'idVenta', as: 'pago' })
PagoVenta.belongsTo(Venta, { foreignKey: 'idVenta', as: 'venta' })
PagoVenta.belongsTo(MedioPago, { foreignKey: 'idMedioPago', as: 'medioPago' })

Venta.hasMany(MovimientoStock, { foreignKey: 'idVenta', as: 'movimientos' })

export {
  Persona, Perfil, Modulo, Permiso, Usuario, Sesion,
  Categoria, Marca, Producto, ModeloDispositivo, ProductoModeloCompatible,
  MovimientoStock,
  TipoCliente, Cliente, Proveedor, ProductoProveedor,
  MedioPago, Venta, DetalleVenta, PagoVenta,
  ParametroSistema,
}
