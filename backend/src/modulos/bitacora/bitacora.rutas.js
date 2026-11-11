import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { listar } from './bitacora.controlador.js'

export const rutasBitacora = Router()

// RF05 — la bitacora es de solo lectura y es de soporte del sistema: muestra
// IP, datos antes y despues y nombres de tabla, que no son del negocio.
rutasBitacora.use(autenticar, autorizar('SOPORTE_SISTEMA', 'lectura'))

rutasBitacora.get('/', listar)

