import pino from 'pino'

// Registro tecnico de eventos del servidor.
//
// OJO con el nombre: esto NO es la tabla `bitacora`. Esa es del dominio y
// guarda que hizo cada usuario, para auditar el negocio. Esto es para nosotros,
// vive en la consola y en un archivo, y no se consulta desde el sistema.
//
// Que nivel usar, que es lo unico que hay que tener claro:
//
//   fatal  el servidor no puede seguir. Se usa una sola vez: al no poder
//          conectar a la base.
//   error  algo salio mal y NO estaba previsto. Va con la traza. Si aparece,
//          hay que mirarlo.
//   warn   algo salio mal pero estaba previsto: contrasena incorrecta, permiso
//          denegado, stock insuficiente. Es flujo normal del negocio, no una
//          falla del sistema, y por eso NO va como error. Si los 404 se
//          registraran como errores, el registro se llena de ruido y el error
//          de verdad pasa desapercibido.
//   info   arranque, apagado, y las operaciones que cambian plata o existencias.
//   debug  el detalle, incluido el SQL. Apagado salvo que se pida.

const enDesarrollo = process.env.NODE_ENV !== 'production'

export const registro = pino({
  level: process.env.NIVEL_REGISTRO ?? (enDesarrollo ? 'debug' : 'info'),

  // Nada de esto puede terminar en el registro, ni siquiera por accidente:
  // una contrasena o un token en un archivo de texto es una filtracion, y los
  // archivos de registro se copian, se pegan en un chat y se suben a un repo.
  redact: {
    paths: [
      'contrasena', 'contrasenaActual', 'contrasenaNueva', 'contrasenaHash',
      'token', 'tokenHash', 'authorization',
      'req.headers.authorization', 'req.headers.cookie',
      '*.contrasena', '*.contrasenaHash', '*.token',
    ],
    censor: '[oculto]',
  },

  ...(enDesarrollo
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            // Todo registro sale de registroDe(), asi que `modulo` siempre esta.
            messageFormat: '{modulo} · {msg}',
          },
        },
      }
    : {}),
})

/**
 * Registro con el nombre del modulo adelante, para saber de donde salio cada
 * linea sin tener que deducirlo del mensaje.
 *
 *   const log = registroDe('ventas')
 *   log.info({ idVenta }, 'venta confirmada')
 */
export const registroDe = (modulo) => registro.child({ modulo })
