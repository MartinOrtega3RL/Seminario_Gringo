import { unlink } from 'node:fs/promises'
import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { DatosInvalidos } from '../../errores.js'
import {
  detalleOrden, listarOrdenes, listarEstados, recepcionar, diagnosticar, presupuestar,
  responderPresupuesto, cambiarEstado, notificar, entregar,
} from './ordenes.servicio.js'
import { registrarRepuesto, quitarRepuesto, registrarTarea, registrarFoto, rutaDeFoto } from './reparacion.servicio.js'
import { consultarDispositivo } from './dispositivos.servicio.js'
import { generarDocumentoOrden } from './orden.html.js'

// En ninguna de estas operaciones viaja el id del usuario: el responsable de
// cada paso sale del token. Si se aceptara del cuerpo, cualquiera podria cargar
// un diagnostico o una entrega a nombre de otro.

const id = z.coerce.number().int().positive()
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD.')

// Un campo opcional vacio es "sin dato", no una cadena vacia.
const opcional = (maximo) => z.string().trim().max(maximo).nullish().transform((valor) => valor || null)

const esquemaFiltros = z.object({
  texto: z.string().trim().max(80).optional(),
  estado: z.string().trim().max(30).optional(),
  idCliente: id.optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  soloNoRetiradas: z.enum(['true', 'false']).optional().transform((valor) => valor === 'true'),
})

const esquemaRecepcion = z.object({
  idCliente: id,
  dispositivo: z.object({
    idModelo: id.optional(),
    // El modelo que todavia no esta cargado se da de alta en la recepcion.
    nuevoModelo: z.object({
      idMarca: id,
      denominacion: z.string().trim().min(2, 'Cargá el nombre del modelo.').max(80),
    }).optional(),
    imeiSerie: z.string().trim()
      .regex(/^[A-Za-z0-9/-]{5,30}$/, 'El IMEI o número de serie tiene entre 5 y 30 letras o números.')
      .nullish()
      .transform((valor) => valor || null),
    color: opcional(30),
    observaciones: opcional(200),
  }).refine((d) => d.idModelo || d.nuevoModelo, { message: 'Indicá el modelo del equipo.', path: ['idModelo'] }),
  fallaDeclarada: z.string().trim().min(3, 'Anotá la falla que declara el cliente.').max(2000),
  estadoIngreso: z.string().trim().min(3, 'Describí cómo llega el equipo: golpes, rayones, si enciende.').max(2000),
  accesoriosRecibidos: opcional(300),
  estadoSellos: z.enum(['INTACTOS', 'VIOLADOS', 'SIN_SELLO']).default('SIN_SELLO'),
  idOrdenAnterior: id.nullish().transform((valor) => valor ?? null),
})

const esquemaDiagnostico = z.object({
  diagnostico: z.string().trim().min(5, 'Escribí qué se encontró en la revisión.').max(4000),
})

const esquemaPresupuesto = z.object({
  monto: z.coerce.number().positive('El presupuesto tiene que ser mayor que cero.').max(99_999_999),
})

const esquemaRespuesta = z.object({
  aprobado: z.boolean({ message: 'Indicá si el cliente aprobó o rechazó el presupuesto.' }),
  observacion: opcional(300),
})

const esquemaEstado = z.object({
  codigo: z.string().trim().min(1).max(30),
  observacion: opcional(300),
})

const esquemaNotificacion = z.object({
  medio: z.enum(['WHATSAPP', 'LLAMADA', 'PRESENCIAL', 'CORREO'], { message: 'Indicá por qué medio se avisó.' }),
  observacion: opcional(300),
})

const esquemaEntrega = z.object({
  conformidad: z.boolean({ message: 'Indicá si el cliente quedó conforme.' }),
  observacion: opcional(300),
})

const esquemaRepuesto = z.object({
  idProducto: id,
  cantidad: z.coerce.number().int().min(1, 'Indicá cuántas unidades se usaron.').max(9_999),
})

const esquemaTarea = z.object({
  descripcion: z.string().trim().min(3, 'Describí qué se hizo.').max(2000),
})

const esquemaFoto = z.object({
  momento: z.enum(['INGRESO', 'PROCESO', 'ENTREGA']).default('INGRESO'),
  descripcion: opcional(200),
})

const esquemaHistorial = z.object({
  imei: z.string().trim().min(5, 'Indicá el IMEI o número de serie.').max(30),
  sellos: z.enum(['INTACTOS', 'VIOLADOS', 'SIN_SELLO']).optional(),
})

export const crearControladorServicio = () => {
  // Toda operacion que modifica una orden devuelve la ficha ya actualizada: la
  // pantalla no tiene que pedirla de nuevo, y lo que ve es lo que quedo escrito.
  const conDetalle = (operacion, estado = 200) => async (peticion, respuesta) => {
    const idOrden = id.parse(peticion.params.idOrden)
    await operacion(idOrden, peticion)
    return respuesta.status(estado).json({ datos: await detalleOrden(idOrden, peticion.usuario.perfil) })
  }

  return {
    estados: async (_peticion, respuesta) => respuesta.json({ datos: await listarEstados() }),

    // RF25.1 / RF23.2
    listar: async (peticion, respuesta) => {
      const paginacion = leerPaginacion(peticion.query)
      const filtros = esquemaFiltros.parse(peticion.query)

      const { resumen, ...resultado } = await listarOrdenes({
        ...filtros, limit: paginacion.limit, offset: paginacion.offset,
      })
      return respuesta.json({ ...responderPaginado(resultado, paginacion), resumen })
    },

    detalle: async (peticion, respuesta) =>
      respuesta.json({ datos: await detalleOrden(id.parse(peticion.params.idOrden), peticion.usuario.perfil) }),

    // RF21.1 a RF21.8
    recepcionar: async (peticion, respuesta) => {
      const idOrden = await recepcionar(esquemaRecepcion.parse(peticion.body), peticion.usuario.idUsuario)
      return respuesta.status(201).json({ datos: await detalleOrden(idOrden, peticion.usuario.perfil) })
    },

    diagnosticar: conDetalle((idOrden, peticion) =>
      diagnosticar(idOrden, esquemaDiagnostico.parse(peticion.body), peticion.usuario.idUsuario)),

    presupuestar: conDetalle((idOrden, peticion) =>
      presupuestar(idOrden, esquemaPresupuesto.parse(peticion.body), peticion.usuario.idUsuario)),

    responder: conDetalle((idOrden, peticion) =>
      responderPresupuesto(idOrden, esquemaRespuesta.parse(peticion.body), peticion.usuario.idUsuario)),

    cambiarEstado: conDetalle((idOrden, peticion) =>
      cambiarEstado(idOrden, esquemaEstado.parse(peticion.body), peticion.usuario.idUsuario)),

    notificar: conDetalle((idOrden, peticion) =>
      notificar(idOrden, esquemaNotificacion.parse(peticion.body), peticion.usuario.idUsuario)),

    entregar: conDetalle((idOrden, peticion) =>
      entregar(idOrden, esquemaEntrega.parse(peticion.body), peticion.usuario.idUsuario)),

    // RF22.4
    agregarRepuesto: conDetalle((idOrden, peticion) =>
      registrarRepuesto(idOrden, esquemaRepuesto.parse(peticion.body), peticion.usuario.idUsuario), 201),

    quitarRepuesto: conDetalle((idOrden, peticion) =>
      quitarRepuesto(idOrden, id.parse(peticion.params.idRepuesto), peticion.usuario.idUsuario)),

    // RF22.5
    agregarTarea: conDetalle((idOrden, peticion) =>
      registrarTarea(idOrden, esquemaTarea.parse(peticion.body), peticion.usuario.idUsuario), 201),

    // RF21.7 — multer ya dejo el archivo en disco antes de llegar aca. Si algo
    // falla ANTES de registrarlo (el cuerpo mal armado, un id invalido) se lo
    // borra: nadie lo va a referenciar nunca. Despues de registrado, jamas: el
    // archivo ya tiene una fila que lo apunta.
    agregarFoto: async (peticion, respuesta) => {
      let idOrden
      let campos

      try {
        if (!peticion.file) throw new DatosInvalidos('Elegí la foto que querés adjuntar.')
        idOrden = id.parse(peticion.params.idOrden)
        campos = esquemaFoto.parse(peticion.body)
      } catch (error) {
        if (peticion.file) await unlink(peticion.file.path).catch(() => {})
        throw error
      }

      // registrarFoto borra el archivo por su cuenta si la orden no existe.
      await registrarFoto(idOrden, { archivo: peticion.file, ...campos })
      return respuesta.status(201).json({ datos: await detalleOrden(idOrden, peticion.usuario.perfil) })
    },

    // La foto sale por una ruta con sesion y permiso: no es un archivo publico.
    foto: async (peticion, respuesta) => {
      const ruta = await rutaDeFoto(id.parse(peticion.params.idOrden), id.parse(peticion.params.idFoto))
      respuesta.set('Cache-Control', 'private, max-age=3600')
      return respuesta.sendFile(ruta)
    },

    // RF21.9
    documento: async (peticion, respuesta) => {
      const orden = await detalleOrden(id.parse(peticion.params.idOrden), peticion.usuario.perfil)
      const emitido = generarDocumentoOrden(orden)

      respuesta.type(emitido.tipoMime)
      return respuesta.send(emitido.contenido)
    },

    // RF25.2 / RF24.2
    historialDispositivo: async (peticion, respuesta) =>
      respuesta.json({ datos: await consultarDispositivo(esquemaHistorial.parse(peticion.query)) }),
  }
}
