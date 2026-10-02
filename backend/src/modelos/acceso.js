import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Contexto Acceso: identidad, perfiles, modulos, permisos, usuarios y sesiones.
// Los nombres de columna son los del esquema; el mapeo a camelCase es explicito.

export const Persona = sequelize.define('Persona', {
  idPersona: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_persona' },
  apellidoNombre: { type: DataTypes.STRING(150), allowNull: false, field: 'apellido_nombre' },
  tipoPersona: { type: DataTypes.ENUM('FISICA', 'JURIDICA'), allowNull: false, defaultValue: 'FISICA', field: 'tipo_persona' },
  tipoDocumento: { type: DataTypes.ENUM('DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'OTRO'), allowNull: true, field: 'tipo_documento' },
  numeroDocumento: { type: DataTypes.STRING(20), allowNull: true, field: 'numero_documento' },
  telefonoWhatsapp: { type: DataTypes.STRING(30), allowNull: true, field: 'telefono_whatsapp' },
  correo: { type: DataTypes.STRING(120), allowNull: true },
  domicilio: { type: DataTypes.STRING(200), allowNull: true },
  creadoEn: { type: DataTypes.DATE, field: 'creado_en' },
  actualizadoEn: { type: DataTypes.DATE, field: 'actualizado_en' },
}, { tableName: 'persona' })

export const Perfil = sequelize.define('Perfil', {
  idPerfil: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_perfil' },
  nombre: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  descripcion: { type: DataTypes.STRING(200), allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'perfil' })

export const Modulo = sequelize.define('Modulo', {
  idModulo: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_modulo' },
  codigo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  nombre: { type: DataTypes.STRING(80), allowNull: false },
  descripcion: { type: DataTypes.STRING(200), allowNull: true },
}, { tableName: 'modulo' })

// Matriz perfil x modulo. Es lo que lee RF04 para decidir cada operacion.
export const Permiso = sequelize.define('Permiso', {
  idPerfil: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_perfil' },
  idModulo: { type: DataTypes.INTEGER, primaryKey: true, field: 'id_modulo' },
  permiteLectura: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'permite_lectura' },
  permiteEscritura: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'permite_escritura' },
}, { tableName: 'permiso' })

export const Usuario = sequelize.define('Usuario', {
  idUsuario: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_usuario' },
  idPersona: { type: DataTypes.INTEGER, allowNull: false, field: 'id_persona' },
  idPerfil: { type: DataTypes.INTEGER, allowNull: false, field: 'id_perfil' },
  nombreUsuario: { type: DataTypes.STRING(50), allowNull: false, unique: true, field: 'nombre_usuario' },
  // RNF09: siempre hash, nunca la contrasena en claro. Ver acceso.servicio.js.
  contrasenaHash: { type: DataTypes.STRING(255), allowNull: false, field: 'contrasena_hash' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  creadoEn: { type: DataTypes.DATE, field: 'creado_en' },
  actualizadoEn: { type: DataTypes.DATE, field: 'actualizado_en' },
}, {
  tableName: 'usuario',
  // El hash no sale por omision en ninguna consulta: hay que pedirlo a proposito.
  defaultScope: { attributes: { exclude: ['contrasenaHash'] } },
  scopes: { conCredenciales: { attributes: { include: ['contrasenaHash'] } } },
})

// Sin persistir los tokens no se puede invalidar una sesion (RF01.2) ni
// cerrarla por inactividad (RNF11). Se guarda el hash del token, no el token.
export const Sesion = sequelize.define('Sesion', {
  idSesion: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id_sesion' },
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  tokenHash: { type: DataTypes.STRING(255), allowNull: false, unique: true, field: 'token_hash' },
  fechaInicio: { type: DataTypes.DATE, field: 'fecha_inicio' },
  fechaUltimoUso: { type: DataTypes.DATE, field: 'fecha_ultimo_uso' },
  fechaExpiracion: { type: DataTypes.DATE, allowNull: false, field: 'fecha_expiracion' },
  fechaCierre: { type: DataTypes.DATE, allowNull: true, field: 'fecha_cierre' },
  motivoCierre: { type: DataTypes.ENUM('LOGOUT', 'INACTIVIDAD', 'EXPIRACION', 'REVOCADA'), allowNull: true, field: 'motivo_cierre' },
  direccionIp: { type: DataTypes.STRING(45), allowNull: true, field: 'direccion_ip' },
}, { tableName: 'sesion' })
