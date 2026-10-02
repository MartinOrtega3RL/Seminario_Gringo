import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { entorno } from './config/entorno.js'
import { conectar, sequelize } from './config/base-de-datos.js'
import { registro, registroDe } from './registro.js'
import './modelos/index.js'

import { registrarPeticiones } from './http/middlewares/registrar-peticiones.js'
import { manejarErrores, rutaNoEncontrada } from './http/middlewares/manejar-errores.js'

import { rutasAcceso } from './modulos/acceso/acceso.rutas.js'
import { rutasUsuarios } from './modulos/acceso/usuarios.rutas.js'
import { crearRutasCatalogo } from './modulos/catalogo/catalogo.rutas.js'
import { rutasModelos } from './modulos/catalogo/modelos.rutas.js'
import { CARPETA_IMAGENES, RUTA_PUBLICA } from './modulos/catalogo/imagen.js'
import { rutasCategorias, rutasMarcas } from './modulos/clasificaciones/clasificaciones.rutas.js'
import { rutasExistencias } from './modulos/existencias/existencias.rutas.js'
import { rutasClientes } from './modulos/clientes/clientes.rutas.js'
import { rutasProveedores } from './modulos/proveedores/proveedores.rutas.js'
import { crearRutasVentas } from './modulos/ventas/ventas.rutas.js'

import { verificarGenerador } from './modulos/ventas/comprobante/comprobante.puerto.js'
import { generadorHtml } from './modulos/ventas/comprobante/comprobante.html.js'
import { verificarGeneradorEtiqueta } from './modulos/catalogo/etiqueta/etiqueta.puerto.js'
import { generadorEtiquetaHtml } from './modulos/catalogo/etiqueta/etiqueta.html.js'

const log = registroDe('servidor')

// Punto de armado. Es el unico lugar donde se elige una implementacion
// concreta; ningun modulo instancia sus propias dependencias.
const armarAplicacion = () => {
  const generadorComprobante = verificarGenerador(generadorHtml)
  const generadorEtiqueta = verificarGeneradorEtiqueta(generadorEtiquetaHtml)

  const aplicacion = express()

  aplicacion.set('trust proxy', true)
  aplicacion.use(registrarPeticiones)
  aplicacion.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  aplicacion.use(cors({ origin: entorno.ORIGEN_FRONTEND, credentials: true }))
  aplicacion.use(express.json({ limit: '1mb' }))

  // Las imagenes de producto se sirven como archivos estaticos (RF06.6).
  aplicacion.use(RUTA_PUBLICA, express.static(CARPETA_IMAGENES, { maxAge: '7d' }))

  aplicacion.get('/api/estado', async (_peticion, respuesta) => {
    await sequelize.query('SELECT 1')
    respuesta.json({
      estado: 'ok',
      comprobante: generadorComprobante.formato,
      etiqueta: generadorEtiqueta.formato,
    })
  })

  aplicacion.use('/api/acceso', rutasAcceso)
  aplicacion.use('/api/usuarios', rutasUsuarios)
  aplicacion.use('/api/catalogo', crearRutasCatalogo({ generadorEtiqueta }))
  aplicacion.use('/api/modelos', rutasModelos)
  aplicacion.use('/api/categorias', rutasCategorias)
  aplicacion.use('/api/marcas', rutasMarcas)
  aplicacion.use('/api/existencias', rutasExistencias)
  aplicacion.use('/api/clientes', rutasClientes)
  aplicacion.use('/api/proveedores', rutasProveedores)
  aplicacion.use('/api/ventas', crearRutasVentas({ generadorComprobante }))

  aplicacion.use(rutaNoEncontrada)
  aplicacion.use(manejarErrores)

  return aplicacion
}

const arrancar = async () => {
  try {
    const version = await conectar()
    log.info({ version, esquema: entorno.DB_NAME }, 'base de datos conectada')
  } catch (error) {
    // Unico fatal del sistema: sin base no hay nada que servir.
    log.fatal({ err: error, host: entorno.DB_HOST, esquema: entorno.DB_NAME },
      'no se pudo conectar a la base de datos')
    log.fatal('revisar que el servicio MySQL este corriendo y que los datos del .env sean correctos')
    log.fatal('el esquema lo crea gestion_comercial_ddl.sql: la aplicacion no lo crea')
    process.exit(1)
  }

  armarAplicacion().listen(entorno.PORT, () => {
    log.info({ puerto: entorno.PORT, nivel: registro.level },
      `servidor escuchando en http://localhost:${entorno.PORT}`)
  })
}

const cerrarOrdenado = async (senal) => {
  log.info({ senal }, 'cerrando conexiones')
  await sequelize.close().catch(() => {})
  process.exit(0)
}

process.on('SIGINT', () => cerrarOrdenado('SIGINT'))
process.on('SIGTERM', () => cerrarOrdenado('SIGTERM'))

// Una excepcion que nadie atrapo deja el proceso en un estado que no se puede
// razonar. Se registra con todo el detalle y se sale: reiniciar limpio es mas
// seguro que seguir sirviendo con el estado roto.
process.on('uncaughtException', (error) => {
  log.fatal({ err: error }, 'excepcion no atrapada')
  process.exit(1)
})
process.on('unhandledRejection', (razon) => {
  log.fatal({ err: razon }, 'promesa rechazada sin manejar')
  process.exit(1)
})

arrancar()

export { armarAplicacion }
