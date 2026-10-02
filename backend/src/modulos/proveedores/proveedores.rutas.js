import { Router } from 'express'
import { z } from 'zod'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { leerPaginacion, responderPaginado } from '../../http/paginacion.js'
import {
  listarProveedores, buscarProveedor, listarProductosDelProveedor,
  registrarProveedor, modificarProveedor, darDeBajaProveedor,
} from './proveedores.servicio.js'

// RF15 — vive bajo el mismo permiso que clientes: el modulo 3 de la carpeta
// es «Clientes y proveedores», uno solo.

const opcional = (esquema) => esquema.nullish().transform((v) => v || null)

const esquemaProveedor = z.object({
  apellidoNombre: z.string().trim().min(2, 'Cargá el nombre del proveedor.').max(150),
  tipoPersona: z.enum(['FISICA', 'JURIDICA']).default('JURIDICA'),
  tipoDocumento: opcional(z.enum(['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'OTRO'])),
  numeroDocumento: opcional(z.string().trim().max(20)),
  telefonoWhatsapp: opcional(z.string().trim().max(30)),
  correo: opcional(z.string().trim().email('El correo no tiene un formato válido.').max(120)),
  domicilio: opcional(z.string().trim().max(200)),
  // H14: algunos pedidos se cursan por la web del proveedor.
  sitioWeb: opcional(z.string().trim().max(200)),
  observaciones: opcional(z.string().trim().max(300)),
})

const esquemaId = z.coerce.number().int().positive()

export const rutasProveedores = Router()

rutasProveedores.use(autenticar)
const leer = autorizar('CLIENTES_PROV', 'lectura')
const escribir = autorizar('CLIENTES_PROV', 'escritura')

rutasProveedores.get('/', leer, async (peticion, respuesta) => {
  const paginacion = leerPaginacion(peticion.query)
  const texto = z.string().trim().max(80).optional().parse(peticion.query.texto || undefined)

  const resultado = await listarProveedores({ texto, limit: paginacion.limit, offset: paginacion.offset })
  return respuesta.json(responderPaginado(resultado, paginacion))
})

rutasProveedores.post('/', escribir, async (peticion, respuesta) =>
  respuesta.status(201).json({ datos: await registrarProveedor(esquemaProveedor.parse(peticion.body)) }))

rutasProveedores.get('/:idProveedor', leer, async (peticion, respuesta) =>
  respuesta.json({ datos: await buscarProveedor(esquemaId.parse(peticion.params.idProveedor)) }))

// RF15.2 — que se le compra a este proveedor.
rutasProveedores.get('/:idProveedor/productos', leer, async (peticion, respuesta) =>
  respuesta.json({
    datos: await listarProductosDelProveedor(esquemaId.parse(peticion.params.idProveedor)),
  }))

rutasProveedores.put('/:idProveedor', escribir, async (peticion, respuesta) =>
  respuesta.json({
    datos: await modificarProveedor(
      esquemaId.parse(peticion.params.idProveedor),
      esquemaProveedor.parse(peticion.body),
    ),
  }))

rutasProveedores.delete('/:idProveedor', escribir, async (peticion, respuesta) => {
  await darDeBajaProveedor(esquemaId.parse(peticion.params.idProveedor))
  return respuesta.status(204).send()
})
