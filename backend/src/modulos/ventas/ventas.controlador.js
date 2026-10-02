import { z } from 'zod'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import { confirmarVenta, buscarVenta, listarMediosPago, listarVentas, anularVenta } from './ventas.servicio.js'

const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha va como AAAA-MM-DD.')

const esquemaHistorial = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  idCliente: z.coerce.number().int().positive().optional(),
  estado: z.enum(['CONFIRMADA', 'ANULADA']).optional(),
})

const esquemaAnulacion = z.object({
  motivo: z.string().trim().min(5, 'Escribí por qué se anula. Queda en el registro.').max(300),
})

const esquemaLinea = z.object({
  idProducto: z.coerce.number().int().positive(),
  cantidad: z.coerce.number().int().positive('La cantidad tiene que ser mayor que cero.'),
})

const esquemaVenta = z.object({
  idCliente: z.coerce.number().int().positive().nullish(),
  lineas: z.array(esquemaLinea).min(1, 'La venta necesita al menos un producto.'),
  idMedioPago: z.coerce.number().int().positive(),
  referenciaPago: z.string().trim().max(60).nullish(),
  modalidadPago: z.enum(['CONTADO', 'FINANCIACION_PROPIA', 'TARJETA_CUOTAS', 'GO_CUOTAS']).default('CONTADO'),
  cantidadCuotas: z.coerce.number().int().min(1).max(255).nullish(),
  recargoFinanciacion: z.coerce.number().min(0).default(0),
  modalidadEntrega: z.enum(['RETIRO_LOCAL', 'ENVIO_DOMICILIO']).default('RETIRO_LOCAL'),
  domicilioEntrega: z.string().trim().max(200).nullish(),
})

const esquemaId = z.coerce.number().int().positive()

/**
 * El generador de comprobantes se inyecta desde main.js. El controlador
 * depende del contrato, no de la implementacion HTML.
 */
export const crearControladorVentas = ({ generadorComprobante }) => ({

  mediosPago: async (_peticion, respuesta) => respuesta.json({ datos: await listarMediosPago() }),

  confirmar: async (peticion, respuesta) => {
    const orden = esquemaVenta.parse(peticion.body)

    // El responsable sale del token. Si se aceptara del cuerpo, cualquiera
    // podria registrar ventas a nombre de otro.
    const { venta } = await confirmarVenta(orden, peticion.usuario.idUsuario)

    return respuesta.status(201).json({
      datos: {
        idVenta: venta.idVenta,
        numeroComprobante: venta.numeroComprobante,
        montoTotal: venta.montoTotal,
        listaPrecioAplicada: venta.listaPrecioAplicada,
      },
    })
  },

  // RF18.1 — historial. El resumen del periodo viaja aparte de la pagina,
  // porque es el total de todo lo filtrado y no el de los renglones visibles.
  historial: async (peticion, respuesta) => {
    const paginacion = leerPaginacion(peticion.query)
    const filtros = esquemaHistorial.parse(peticion.query)

    const { resumen, ...resultado } = await listarVentas({
      ...filtros,
      limit: paginacion.limit,
      offset: paginacion.offset,
    })

    return respuesta.json({ ...responderPaginado(resultado, paginacion), resumen })
  },

  detalle: async (peticion, respuesta) => {
    const venta = await buscarVenta(esquemaId.parse(peticion.params.idVenta))
    return respuesta.json({ datos: venta })
  },

  // RF18.2 — el responsable de la anulacion sale del token, como todo lo demas.
  anular: async (peticion, respuesta) => {
    const venta = await anularVenta(
      esquemaId.parse(peticion.params.idVenta),
      esquemaAnulacion.parse(peticion.body).motivo,
      peticion.usuario.idUsuario,
    )
    return respuesta.json({ datos: venta })
  },

  // RF17.1 / RF17.2 — el comprobante se devuelve listo para imprimir.
  comprobante: async (peticion, respuesta) => {
    const venta = await buscarVenta(esquemaId.parse(peticion.params.idVenta))
    const emitido = await generadorComprobante.generar(venta)

    respuesta.type(emitido.tipoMime)
    return respuesta.send(emitido.contenido)
  },
})
