import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { recibirComprobante } from './comprobantes.js'
import {
  listar,
  proveedores,
  detalle,
  imagen,
  crearManual,
  crearOcr,
  guardarLineas,
  confirmar,
  eliminar,
} from './recepciones.controlador.js'

export const rutasRecepciones = Router()

rutasRecepciones.use(autenticar)

const leer = autorizar('CATALOGO_STOCK', 'lectura')
const escribir = autorizar('CATALOGO_STOCK', 'escritura')

rutasRecepciones.get('/', leer, listar)
rutasRecepciones.get('/proveedores', leer, proveedores)
rutasRecepciones.post('/', escribir, crearManual)
rutasRecepciones.post('/ocr', escribir, recibirComprobante, crearOcr)
rutasRecepciones.get('/:id', leer, detalle)
rutasRecepciones.get('/:id/imagen', leer, imagen)
rutasRecepciones.put('/:id/lineas', escribir, guardarLineas)
rutasRecepciones.post('/:id/confirmar', escribir, confirmar)
rutasRecepciones.delete('/:id', escribir, eliminar)
