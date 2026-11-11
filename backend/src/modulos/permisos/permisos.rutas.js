import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import {
  listar, registrar, modificar, darDeBaja,
  modulos, editarModulo, matriz, guardarPermisos,
} from './permisos.controlador.js'

export const rutasPerfiles = Router()

rutasPerfiles.use(autenticar)
const leer = autorizar('SOPORTE_SISTEMA', 'lectura')
const escribir = autorizar('SOPORTE_SISTEMA', 'escritura')

// Antes de /:idPerfil para evitar colisiones de ruta.
rutasPerfiles.get('/modulos', leer, modulos)
rutasPerfiles.put('/modulos/:idModulo', escribir, editarModulo)
rutasPerfiles.get('/matriz', leer, matriz)

rutasPerfiles.get('/', leer, listar)
rutasPerfiles.post('/', escribir, registrar)
rutasPerfiles.put('/:idPerfil', escribir, modificar)
rutasPerfiles.delete('/:idPerfil', escribir, darDeBaja)
rutasPerfiles.put('/:idPerfil/permisos', escribir, guardarPermisos)

