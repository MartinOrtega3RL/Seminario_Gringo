import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { ingresar, salir, cambiarContrasena, sesionActual } from './acceso.controlador.js'

export const rutasAcceso = Router()

// Unica ruta publica del sistema: sin ella nadie podria autenticarse.
rutasAcceso.post('/ingresar', ingresar)

// De aca en adelante hace falta sesion.
rutasAcceso.use(autenticar)
rutasAcceso.get('/sesion', sesionActual)
rutasAcceso.post('/salir', salir)
rutasAcceso.post('/contrasena', cambiarContrasena)
