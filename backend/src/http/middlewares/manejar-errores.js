import { ZodError } from 'zod'
import {
  BaseError as ErrorSequelize,
  UniqueConstraintError,
  ForeignKeyConstraintError,
  OptimisticLockError,
} from 'sequelize'
import { MulterError } from 'multer'
import { ErrorDeDominio, DatosInvalidos, ConflictoDeConcurrencia } from '../../errores.js'
import { registroDe } from '../../registro.js'

const log = registroDe('http')

// RNF08: mensajes comprensibles, sin exponer informacion tecnica interna.
// Todo lo que no sea un error de dominio previsto sale como un 500 generico,
// y el detalle queda en el registro del servidor, no en la respuesta.

const desdeZod = (error) => new DatosInvalidos(
  'Hay datos incompletos o mal cargados. Revisa el formulario.',
  error.issues.map((problema) => ({
    campo: problema.path.join('.'),
    mensaje: problema.message,
  })),
)

const desdeSequelize = (error) => {
  if (error instanceof OptimisticLockError) return new ConflictoDeConcurrencia()

  if (error instanceof UniqueConstraintError) {
    const campo = error.errors?.[0]?.path ?? 'uno de los datos'
    return new DatosInvalidos(`Ya existe un registro con ese valor en ${campo}.`)
  }

  if (error instanceof ForeignKeyConstraintError) {
    return new DatosInvalidos('El registro esta relacionado con otros y no se puede modificar o eliminar.')
  }

  // Una restriccion CHECK violada significa que algo paso la validacion de la
  // aplicacion y no debio: es un defecto nuestro, no del usuario. Se traduce
  // para no asustar, pero se registra como error para que quede a la vista.
  if (error.parent?.errno === 3819) {
    return null
  }

  return null
}

const desdeMulter = (error) => {
  if (error.code === 'LIMIT_FILE_SIZE') return new DatosInvalidos('La imagen es demasiado grande.')
  return new DatosInvalidos('No se pudo procesar el archivo enviado.')
}

const normalizar = (error) => {
  if (error instanceof ErrorDeDominio) return error
  if (error instanceof ZodError) return desdeZod(error)
  if (error instanceof MulterError) return desdeMulter(error)
  if (error instanceof ErrorSequelize) return desdeSequelize(error)
  return null
}

// eslint-disable-next-line no-unused-vars -- Express reconoce el manejador de
// errores por su aridad de cuatro parametros; quitar `siguiente` lo rompe.
export const manejarErrores = (error, peticion, respuesta, siguiente) => {
  const conocido = normalizar(error)

  const contexto = {
    metodo: peticion.method,
    ruta: peticion.originalUrl,
    usuario: peticion.usuario?.nombreUsuario,
  }

  if (!conocido) {
    // Imprevisto: va con la traza completa. Si aparece uno de estos, hay algo
    // que arreglar en el codigo.
    log.error({ ...contexto, err: error }, 'error no controlado')

    return respuesta.status(500).json({
      error: {
        codigo: 'ERROR_INTERNO',
        mensaje: 'Ocurrio un problema inesperado. Si se repite, avisa al administrador.',
      },
    })
  }

  // Previsto: es flujo normal del negocio. Registrarlo como error llenaria la
  // consola de ruido y taparia los de verdad. Solo se anota, sin traza.
  log.warn({ ...contexto, codigo: conocido.codigo }, conocido.message)

  return respuesta.status(conocido.estado).json({
    error: {
      codigo: conocido.codigo,
      mensaje: conocido.message,
      ...(conocido.detalles?.length ? { detalles: conocido.detalles } : {}),
    },
  })
}

// 404 de ruta inexistente. Va montado despues de todas las rutas.
export const rutaNoEncontrada = (peticion, respuesta) => {
  log.warn({ metodo: peticion.method, ruta: peticion.originalUrl }, 'ruta inexistente')

  return respuesta.status(404).json({
    error: {
      codigo: 'RUTA_NO_ENCONTRADA',
      mensaje: `No existe la ruta ${peticion.method} ${peticion.originalUrl}.`,
    },
  })
}
