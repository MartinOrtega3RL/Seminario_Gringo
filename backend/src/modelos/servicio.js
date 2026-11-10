import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Servicio tecnico. La orden de servicio es la raiz del agregado: su
// historial de estados, sus fotos, sus repuestos y sus tareas pertenecen a ella
// y no se modifican por fuera.

// El equipo no se vincula al cliente: el titular puede cambiar y el historial
// por IMEI (RF25.2) tiene que sobrevivir a ese cambio.
export const Dispositivo = sequelize.define('Dispositivo', {
  idDispositivo: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_dispositivo' },
  idModelo: { type: DataTypes.INTEGER, allowNull: false, field: 'id_modelo' },
  // Nulo: un equipo que no enciende puede ingresar sin IMEI legible.
  imeiSerie: { type: DataTypes.STRING(30), allowNull: true, unique: true, field: 'imei_serie' },
  color: { type: DataTypes.STRING(30), allowNull: true },
  observaciones: { type: DataTypes.STRING(200), allowNull: true },
}, { tableName: 'dispositivo' })

// Los once estados vienen precargados (RF22.6). Se leen, no se editan.
export const EstadoOrden = sequelize.define('EstadoOrden', {
  idEstado: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_estado' },
  codigo: { type: DataTypes.STRING(30), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  ordenSecuencia: { type: DataTypes.INTEGER, allowNull: false, field: 'orden_secuencia' },
  esFinal: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'es_final' },
}, { tableName: 'estado_orden' })

export const OrdenServicio = sequelize.define('OrdenServicio', {
  idOrden: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_orden' },
  numeroOrden: { type: DataTypes.STRING(20), allowNull: false, unique: true, field: 'numero_orden' },
  idCliente: { type: DataTypes.INTEGER, allowNull: false, field: 'id_cliente' },
  idDispositivo: { type: DataTypes.INTEGER, allowNull: false, field: 'id_dispositivo' },
  // Salen del token, nunca del cuerpo de la peticion.
  idUsuarioRecepcion: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario_recepcion' },
  // Nulo hasta que alguien toma la orden (RF22 / RF28).
  idUsuarioTecnico: { type: DataTypes.INTEGER, allowNull: true, field: 'id_usuario_tecnico' },
  // Denormalizacion controlada: el estado vigente tambien consta en el historial.
  idEstadoActual: { type: DataTypes.INTEGER, allowNull: false, field: 'id_estado_actual' },
  // RF24.3 — reingreso por garantia.
  idOrdenAnterior: { type: DataTypes.INTEGER, allowNull: true, field: 'id_orden_anterior' },

  fechaIngreso: { type: DataTypes.DATE, field: 'fecha_ingreso' },
  fallaDeclarada: { type: DataTypes.TEXT, allowNull: false, field: 'falla_declarada' },
  estadoIngreso: { type: DataTypes.TEXT, allowNull: false, field: 'estado_ingreso' },
  accesoriosRecibidos: { type: DataTypes.STRING(300), allowNull: true, field: 'accesorios_recibidos' },
  // H07: lo que anula la garantia es el estado del sello, no haberlo verificado.
  estadoSellos: {
    type: DataTypes.ENUM('INTACTOS', 'VIOLADOS', 'SIN_SELLO'),
    allowNull: false,
    defaultValue: 'SIN_SELLO',
    field: 'estado_sellos',
  },

  diagnosticoTecnico: { type: DataTypes.TEXT, allowNull: true, field: 'diagnostico_tecnico' },
  montoPresupuestado: { type: DataTypes.DECIMAL(12, 2), allowNull: true, field: 'monto_presupuestado' },
  // Nulo mientras el cliente no responde.
  presupuestoAprobado: { type: DataTypes.BOOLEAN, allowNull: true, field: 'presupuesto_aprobado' },
  fechaRespuestaPresupuesto: { type: DataTypes.DATE, allowNull: true, field: 'fecha_respuesta_presupuesto' },

  // Ultima notificacion: inicia el plazo de retiro (H08).
  fechaNotificacion: { type: DataTypes.DATE, allowNull: true, field: 'fecha_notificacion' },
  fechaEntrega: { type: DataTypes.DATE, allowNull: true, field: 'fecha_entrega' },
  conformidadCliente: { type: DataTypes.BOOLEAN, allowNull: true, field: 'conformidad_cliente' },
  recargoAplicado: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'recargo_aplicado' },
  // Derivado al entregar: reparacion + recargo. Antes de entregar es cero.
  montoTotal: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'monto_total' },
  fechaVencGarantia: { type: DataTypes.DATEONLY, allowNull: true, field: 'fecha_venc_garantia' },
}, { tableName: 'orden_servicio' })

// Trazabilidad completa de las transiciones y de quien las hizo.
export const OrdenEstadoHistorial = sequelize.define('OrdenEstadoHistorial', {
  idHistorial: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_historial' },
  idOrden: { type: DataTypes.INTEGER, allowNull: false, field: 'id_orden' },
  idEstado: { type: DataTypes.INTEGER, allowNull: false, field: 'id_estado' },
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  fechaHora: { type: DataTypes.DATE, field: 'fecha_hora' },
  // RF23.1 — solo en la transicion a NOTIFICADO.
  medioNotificacion: {
    type: DataTypes.ENUM('WHATSAPP', 'LLAMADA', 'PRESENCIAL', 'CORREO'),
    allowNull: true,
    field: 'medio_notificacion',
  },
  observacion: { type: DataTypes.STRING(300), allowNull: true },
}, { tableName: 'orden_estado_historial' })

// RF21.7 — la ruta apunta a un archivo en disco; no se guarda el binario.
export const FotoOrden = sequelize.define('FotoOrden', {
  idFoto: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_foto' },
  idOrden: { type: DataTypes.INTEGER, allowNull: false, field: 'id_orden' },
  imagenRuta: { type: DataTypes.STRING(255), allowNull: false, field: 'imagen_ruta' },
  momentoCaptura: {
    type: DataTypes.ENUM('INGRESO', 'PROCESO', 'ENTREGA'),
    allowNull: false,
    defaultValue: 'INGRESO',
    field: 'momento_captura',
  },
  fechaHora: { type: DataTypes.DATE, field: 'fecha_hora' },
  descripcion: { type: DataTypes.STRING(200), allowNull: true },
}, { tableName: 'foto_orden' })

// El precio y el costo se congelan al registrar el repuesto, igual que en una
// venta: un cambio de precio posterior no altera una orden ya cargada.
export const RepuestoUtilizado = sequelize.define('RepuestoUtilizado', {
  idRepuestoUtilizado: {
    type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_repuesto_utilizado',
  },
  idOrden: { type: DataTypes.INTEGER, allowNull: false, field: 'id_orden' },
  idProducto: { type: DataTypes.INTEGER, allowNull: false, field: 'id_producto' },
  cantidad: { type: DataTypes.INTEGER, allowNull: false },
  precioUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, field: 'precio_unitario' },
  costoUnitario: { type: DataTypes.DECIMAL(12, 2), allowNull: false, defaultValue: 0, field: 'costo_unitario' },
}, { tableName: 'repuesto_utilizado' })

// RF22.5 — delimita el alcance de la garantia: solo lo efectivamente reparado
// queda cubierto (H07).
export const TareaRealizada = sequelize.define('TareaRealizada', {
  idTarea: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_tarea' },
  idOrden: { type: DataTypes.INTEGER, allowNull: false, field: 'id_orden' },
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  descripcion: { type: DataTypes.TEXT, allowNull: false },
  fechaHora: { type: DataTypes.DATE, field: 'fecha_hora' },
}, { tableName: 'tarea_realizada' })
