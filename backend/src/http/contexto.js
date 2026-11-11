import { AsyncLocalStorage } from 'node:async_hooks'

// Almacen por peticion HTTP: permite que cualquier servicio registre el
// responsable e IP en la bitacora (RF05) sin alterar la firma de funciones que
// no reciben el usuario.
const almacen = new AsyncLocalStorage()

export const contextoPeticion = (peticion, _respuesta, siguiente) => {
  almacen.run({ idUsuario: null, ip: peticion.ip ?? null }, () => siguiente())
}

export const fijarUsuarioEnContexto = (idUsuario) => {
  const actual = almacen.getStore()
  if (actual) actual.idUsuario = idUsuario
}

export const usuarioActual = () => almacen.getStore() ?? null

