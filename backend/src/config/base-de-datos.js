import { Sequelize } from 'sequelize'
import { entorno } from './entorno.js'
import { registroDe } from '../registro.js'

const log = registroDe('base')

// El esquema lo crea gestion_comercial_ddl.sql. Sequelize solo se mapea encima.
//
// NUNCA llamar a sequelize.sync(): no reproduce las 25 restricciones CHECK, la
// columna generada bajo_minimo ni los indices FULLTEXT. Si se sincronizara,
// el esquema real dejaria de coincidir con el diagrama documentado en la carpeta.
export const sequelize = new Sequelize(
  entorno.DB_NAME,
  entorno.DB_USER,
  entorno.DB_PASSWORD,
  {
    host: entorno.DB_HOST,
    port: entorno.DB_PORT,
    dialect: 'mysql',

    // El SQL va a nivel debug, no a la consola pelada: en el dia a dia estorba,
    // y cuando se necesita se enciende con NIVEL_REGISTRO=debug sin tocar codigo.
    logging: (sql, ms) => log.debug({ ms }, sql),
    benchmark: true,

    define: {
      timestamps: false,
      freezeTableName: true,
      underscored: false,
    },
    pool: {
      max: 10,
      min: 0,
      idle: 10_000,
      acquire: 30_000,
    },
    dialectOptions: {
      // Devolver DECIMAL como cadena y convertirlo a proposito, en vez de
      // dejar que el punto flotante redondee importes de dinero.
      decimalNumbers: false,
      dateStrings: false,
    },
  },
)

export const conectar = async () => {
  await sequelize.authenticate()
  const [[fila]] = await sequelize.query('SELECT VERSION() AS version')
  return fila.version
}
