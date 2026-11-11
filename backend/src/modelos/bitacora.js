import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// RF05 — bitacora de operaciones criticas. Solo se inserta y se consulta;
// nunca se modifica ni se borra desde la aplicacion.
export const Bitacora = sequelize.define('Bitacora', {
  idBitacora: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true, field: 'id_bitacora' },
  idUsuario: { type: DataTypes.INTEGER, allowNull: false, field: 'id_usuario' },
  fechaHora: { type: DataTypes.DATE, field: 'fecha_hora' },
  entidadAfectada: { type: DataTypes.STRING(60), allowNull: false, field: 'entidad_afectada' },
  idRegistro: { type: DataTypes.BIGINT, allowNull: true, field: 'id_registro' },
  accion: {
    type: DataTypes.ENUM('ALTA', 'MODIFICACION', 'BAJA', 'ANULACION', 'LOGIN', 'LOGOUT', 'AJUSTE'),
    allowNull: false,
  },
  datosAntes: { type: DataTypes.JSON, allowNull: true, field: 'datos_antes' },
  datosDespues: { type: DataTypes.JSON, allowNull: true, field: 'datos_despues' },
  detalle: { type: DataTypes.STRING(300), allowNull: true },
  direccionIp: { type: DataTypes.STRING(45), allowNull: true, field: 'direccion_ip' },
}, { tableName: 'bitacora', timestamps: false, freezeTableName: true })

