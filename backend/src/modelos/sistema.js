import { DataTypes } from 'sequelize'
import { sequelize } from '../config/base-de-datos.js'

// Parametros del negocio que no se escriben en el codigo: prefijo del codigo
// interno, minutos de inactividad, plazos y recargos. Vienen precargados por
// gestion_comercial_datos.sql y se cambian sin tocar el codigo.
export const ParametroSistema = sequelize.define('ParametroSistema', {
  codigo: { type: DataTypes.STRING(50), primaryKey: true },
  valor: { type: DataTypes.STRING(100), allowNull: false },
  descripcion: { type: DataTypes.STRING(200), allowNull: true },
  actualizadoEn: { type: DataTypes.DATE, field: 'actualizado_en' },
}, { tableName: 'parametro_sistema' })

// Los parametros cambian una vez por ano. Leerlos en cada peticion es un viaje
// a la base al pedo, asi que se cachean en memoria del proceso.
let cache = null

export const leerParametros = async () => {
  if (cache) return cache

  const filas = await ParametroSistema.findAll()
  cache = Object.fromEntries(filas.map((fila) => [fila.codigo, fila.valor]))
  return cache
}

export const leerParametro = async (codigo, porOmision = null) => {
  const parametros = await leerParametros()
  return parametros[codigo] ?? porOmision
}

// Invalidar tras modificar un parametro, para no reiniciar el servidor.
export const olvidarParametros = () => {
  cache = null
}
