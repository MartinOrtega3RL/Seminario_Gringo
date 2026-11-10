import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { registrar, cambiarEstado, listar } from './pedidos.controlador.js'

export const rutasPedidos = Router()

rutasPedidos.use(autenticar)

const leer = autorizar('VENTAS', 'lectura')
const escribir = autorizar('VENTAS', 'escritura')

rutasPedidos.get('/', leer, listar)
rutasPedidos.post('/', escribir, registrar)
rutasPedidos.patch('/:idPedido/estado', escribir, cambiarEstado)

