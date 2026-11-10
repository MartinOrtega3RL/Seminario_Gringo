import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { ventas, stockBajoMinimo, valorizacion, servicio } from './reportes.controlador.js'

export const rutasReportes = Router()

// RF26 a RF28 — todas las rutas exigen lectura sobre REPORTES (RNF18).
rutasReportes.use(autenticar, autorizar('REPORTES', 'lectura'))

rutasReportes.get('/ventas', ventas)
rutasReportes.get('/stock-bajo-minimo', stockBajoMinimo)
rutasReportes.get('/valorizacion', valorizacion)
rutasReportes.get('/servicio', servicio)

