import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { listar, cobrar } from './cuotas.controlador.js'

export const rutasCuotas = Router()

rutasCuotas.use(autenticar)

rutasCuotas.get('/', autorizar('VENTAS', 'lectura'), listar)
rutasCuotas.post('/:idCuota/cobro', autorizar('VENTAS', 'escritura'), cobrar)

