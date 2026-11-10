import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import {
  listar, detalle, tipos, registrar, modificar, darDeBaja,
  comprasDelCliente, reparacionesDelCliente,
} from './clientes.controlador.js'

export const rutasClientes = Router()

rutasClientes.use(autenticar)

const leer = autorizar('CLIENTES_PROV', 'lectura')
const escribir = autorizar('CLIENTES_PROV', 'escritura')

// Antes de /:idCliente, o Express tomaria "tipos" como identificador.
rutasClientes.get('/tipos', leer, tipos)

rutasClientes.get('/', leer, listar)
rutasClientes.post('/', escribir, registrar)
rutasClientes.get('/:idCliente', leer, detalle)
rutasClientes.put('/:idCliente', escribir, modificar)
rutasClientes.delete('/:idCliente', escribir, darDeBaja)

// RF14 — historial del cliente. El permiso depende del modulo consultado:
// las compras son de VENTAS, las reparaciones de SERVICIO_TECNICO.
rutasClientes.get('/:idCliente/compras', autorizar('VENTAS', 'lectura'), comprasDelCliente)
rutasClientes.get('/:idCliente/reparaciones', autorizar('SERVICIO_TECNICO', 'lectura'), reparacionesDelCliente)
