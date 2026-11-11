// Punto unico donde se declaran las asociaciones. Los archivos de modelo solo
// definen columnas; si cada uno declarara sus relaciones, importarse entre
// ellos crearia ciclos.

import { Persona, Perfil, Modulo, Permiso, Usuario, Sesion } from './acceso.js'
import { Categoria, Marca, Producto, ModeloDispositivo, ProductoModeloCompatible } from './catalogo.js'
import { MovimientoStock } from './existencias.js'
import { TipoCliente, Cliente, Proveedor, ProductoProveedor } from './clientes.js'
import { MedioPago, Venta, DetalleVenta, PagoVenta, Cuota } from './ventas.js'
import { ParametroSistema } from './sistema.js'
import {
  Dispositivo, EstadoOrden, OrdenServicio, OrdenEstadoHistorial, FotoOrden, RepuestoUtilizado, TareaRealizada,
} from './servicio.js'
import { PedidoPendiente } from './pedidos.js'
import { Bitacora } from './bitacora.js'
import { RecepcionMercaderia, OcrExtraccion, DetalleRecepcion } from './recepciones.js'

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
// idRecepcion apunta a una tabla del modulo diferido de recepcion con OCR
// (RF10): existe en la base con su clave foranea, pero no se mapea todavia.
MovimientoStock.belongsTo(OrdenServicio, { foreignKey: 'idOrden', as: 'orden' })

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

Venta.hasMany(Cuota, { foreignKey: 'idVenta', as: 'cuotas' })
Cuota.belongsTo(Venta, { foreignKey: 'idVenta', as: 'venta' })
Cuota.belongsTo(MedioPago, { foreignKey: 'idMedioPago', as: 'medioPago' })
Cuota.belongsTo(Usuario, { foreignKey: 'idUsuarioCobro', as: 'cobradoPor' })

Venta.hasMany(MovimientoStock, { foreignKey: 'idVenta', as: 'movimientos' })

// --- Servicio tecnico (RF21 a RF25) -------------------------------------------
Dispositivo.belongsTo(ModeloDispositivo, { foreignKey: 'idModelo', as: 'modelo' })
ModeloDispositivo.hasMany(Dispositivo, { foreignKey: 'idModelo', as: 'dispositivos' })
Dispositivo.hasMany(OrdenServicio, { foreignKey: 'idDispositivo', as: 'ordenes' })

OrdenServicio.belongsTo(Cliente, { foreignKey: 'idCliente', as: 'cliente' })
OrdenServicio.belongsTo(Dispositivo, { foreignKey: 'idDispositivo', as: 'dispositivo' })
OrdenServicio.belongsTo(EstadoOrden, { foreignKey: 'idEstadoActual', as: 'estado' })
OrdenServicio.belongsTo(Usuario, { foreignKey: 'idUsuarioRecepcion', as: 'recibidoPor' })
OrdenServicio.belongsTo(Usuario, { foreignKey: 'idUsuarioTecnico', as: 'tecnico' })
// RF24.3 — relacion recursiva: un reingreso por garantia apunta a su orden de origen.
OrdenServicio.belongsTo(OrdenServicio, { foreignKey: 'idOrdenAnterior', as: 'ordenAnterior' })
Cliente.hasMany(OrdenServicio, { foreignKey: 'idCliente', as: 'ordenes' })

OrdenServicio.hasMany(OrdenEstadoHistorial, { foreignKey: 'idOrden', as: 'historial' })
OrdenEstadoHistorial.belongsTo(OrdenServicio, { foreignKey: 'idOrden', as: 'orden' })
OrdenEstadoHistorial.belongsTo(EstadoOrden, { foreignKey: 'idEstado', as: 'estado' })
OrdenEstadoHistorial.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })

OrdenServicio.hasMany(FotoOrden, { foreignKey: 'idOrden', as: 'fotos' })
FotoOrden.belongsTo(OrdenServicio, { foreignKey: 'idOrden', as: 'orden' })

OrdenServicio.hasMany(RepuestoUtilizado, { foreignKey: 'idOrden', as: 'repuestos' })
RepuestoUtilizado.belongsTo(OrdenServicio, { foreignKey: 'idOrden', as: 'orden' })
RepuestoUtilizado.belongsTo(Producto, { foreignKey: 'idProducto', as: 'producto' })

OrdenServicio.hasMany(TareaRealizada, { foreignKey: 'idOrden', as: 'tareas' })
TareaRealizada.belongsTo(OrdenServicio, { foreignKey: 'idOrden', as: 'orden' })
TareaRealizada.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })

// --- Pedidos pendientes (RF19) -----------------------------------------------
PedidoPendiente.belongsTo(Cliente, { foreignKey: 'idCliente', as: 'cliente' })
PedidoPendiente.belongsTo(Producto, { foreignKey: 'idProducto', as: 'producto' })
PedidoPendiente.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })
Cliente.hasMany(PedidoPendiente, { foreignKey: 'idCliente', as: 'pedidos' })

// --- Bitacora (RF05) ---------------------------------------------------------
Bitacora.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })
Usuario.hasMany(Bitacora, { foreignKey: 'idUsuario', as: 'registrosBitacora' })

// --- Recepcion de mercaderia (RF10) ------------------------------------------
RecepcionMercaderia.belongsTo(Proveedor, { foreignKey: 'idProveedor', as: 'proveedor' })
RecepcionMercaderia.belongsTo(Usuario, { foreignKey: 'idUsuario', as: 'usuario' })
RecepcionMercaderia.hasMany(DetalleRecepcion, { foreignKey: 'idRecepcion', as: 'lineas' })
RecepcionMercaderia.hasOne(OcrExtraccion, { foreignKey: 'idRecepcion', as: 'extraccion' })
RecepcionMercaderia.hasMany(MovimientoStock, { foreignKey: 'idRecepcion', as: 'movimientos' })
MovimientoStock.belongsTo(RecepcionMercaderia, { foreignKey: 'idRecepcion', as: 'recepcion' })

OcrExtraccion.belongsTo(RecepcionMercaderia, { foreignKey: 'idRecepcion', as: 'recepcion' })
DetalleRecepcion.belongsTo(RecepcionMercaderia, { foreignKey: 'idRecepcion', as: 'recepcion' })
DetalleRecepcion.belongsTo(Producto, { foreignKey: 'idProducto', as: 'producto' })

export {
  Persona, Perfil, Modulo, Permiso, Usuario, Sesion,
  Categoria, Marca, Producto, ModeloDispositivo, ProductoModeloCompatible,
  MovimientoStock,
  TipoCliente, Cliente, Proveedor, ProductoProveedor,
  MedioPago, Venta, DetalleVenta, PagoVenta, Cuota,
  ParametroSistema,
  Dispositivo, EstadoOrden, OrdenServicio, OrdenEstadoHistorial, FotoOrden, RepuestoUtilizado, TareaRealizada,
  PedidoPendiente,
  Bitacora,
  RecepcionMercaderia, OcrExtraccion, DetalleRecepcion,
}
