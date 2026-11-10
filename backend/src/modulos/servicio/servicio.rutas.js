import { Router } from 'express'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { crearControladorServicio } from './servicio.controlador.js'
import { recibirFoto } from './fotos.js'

export const crearRutasServicio = () => {
  const controlador = crearControladorServicio()
  const rutas = Router()

  rutas.use(autenticar)

  const leer = autorizar('SERVICIO_TECNICO', 'lectura')
  const escribir = autorizar('SERVICIO_TECNICO', 'escritura')

  rutas.get('/estados', leer, controlador.estados)
  rutas.get('/dispositivos/historial', leer, controlador.historialDispositivo)

  rutas.get('/ordenes', leer, controlador.listar)
  rutas.post('/ordenes', escribir, controlador.recepcionar)

  rutas.get('/ordenes/:idOrden', leer, controlador.detalle)
  rutas.get('/ordenes/:idOrden/documento', leer, controlador.documento)
  rutas.get('/ordenes/:idOrden/fotos/:idFoto', leer, controlador.foto)

  rutas.post('/ordenes/:idOrden/diagnostico', escribir, controlador.diagnosticar)
  rutas.post('/ordenes/:idOrden/presupuesto', escribir, controlador.presupuestar)
  rutas.post('/ordenes/:idOrden/respuesta-presupuesto', escribir, controlador.responder)
  rutas.post('/ordenes/:idOrden/estado', escribir, controlador.cambiarEstado)
  rutas.post('/ordenes/:idOrden/notificacion', escribir, controlador.notificar)
  rutas.post('/ordenes/:idOrden/entrega', escribir, controlador.entregar)

  rutas.post('/ordenes/:idOrden/repuestos', escribir, controlador.agregarRepuesto)
  rutas.delete('/ordenes/:idOrden/repuestos/:idRepuesto', escribir, controlador.quitarRepuesto)
  rutas.post('/ordenes/:idOrden/tareas', escribir, controlador.agregarTarea)

  // El permiso se verifica ANTES de que multer escriba nada a disco: una
  // persona sin acceso no puede llenar la carpeta de archivos.
  rutas.post('/ordenes/:idOrden/fotos', escribir, recibirFoto, controlador.agregarFoto)

  return rutas
}
