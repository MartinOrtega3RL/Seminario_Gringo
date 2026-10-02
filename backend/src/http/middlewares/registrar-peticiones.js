import { randomUUID } from 'node:crypto'
import pinoHttp from 'pino-http'
import { registroDe } from '../../registro.js'

// Una linea por peticion, con su duracion. El nivel sale del codigo de estado:
// un 404 o un 422 son flujo normal y no tienen por que gritar.
//
// Cada peticion lleva un identificador que tambien viaja en la respuesta. Si
// alguien reporta un problema, con ese identificador se encuentra exactamente
// su peticion en el registro, en vez de buscar por hora aproximada.

const SILENCIOSAS = new Set(['/api/estado'])

export const registrarPeticiones = pinoHttp({
  logger: registroDe('http'),

  genReqId: (peticion, respuesta) => {
    const id = peticion.headers['x-request-id'] ?? randomUUID().slice(0, 8)
    respuesta.setHeader('x-request-id', id)
    return id
  },

  customLogLevel: (_peticion, respuesta, error) => {
    if (error || respuesta.statusCode >= 500) return 'error'
    if (respuesta.statusCode >= 400) return 'warn'
    return 'info'
  },

  // El chequeo de estado se consulta cada pocos segundos: registrarlo tapa
  // todo lo demas sin aportar nada.
  autoLogging: {
    ignore: (peticion) => SILENCIOSAS.has(peticion.url?.split('?')[0]),
  },

  customSuccessMessage: (peticion, respuesta) =>
    `${peticion.method} ${peticion.url} ${respuesta.statusCode}`,

  customErrorMessage: (peticion, respuesta) =>
    `${peticion.method} ${peticion.url} ${respuesta.statusCode}`,

  // De la peticion solo interesa esto. El cuerpo NO se registra: ahi viajan
  // contrasenas y datos personales de clientes (Ley 25.326, RNF10).
  serializers: {
    req: (peticion) => ({
      id: peticion.id,
      metodo: peticion.method,
      ruta: peticion.url,
      ip: peticion.remoteAddress,
    }),
    res: (respuesta) => ({ estado: respuesta.statusCode }),
  },
})
