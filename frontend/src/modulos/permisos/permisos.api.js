import { api, consulta } from '../../api/cliente.js'

export const listarPerfiles = ({ pagina = 1, tamano = 25 } = {}) =>
  api.obtener(`/perfiles${consulta({ pagina, tamano })}`)

export const registrarPerfil = (datos) => api.enviar('/perfiles', datos)

export const modificarPerfil = (idPerfil, datos) => api.modificar(`/perfiles/${idPerfil}`, datos)

export const darDeBajaPerfil = (idPerfil) => api.borrar(`/perfiles/${idPerfil}`)

export const listarModulos = () => api.obtener('/perfiles/modulos')

export const modificarModulo = (idModulo, datos) => api.modificar(`/perfiles/modulos/${idModulo}`, datos)

export const obtenerMatriz = () => api.obtener('/perfiles/matriz')

export const guardarPermisosPerfil = (idPerfil, permisos) =>
  api.modificar(`/perfiles/${idPerfil}/permisos`, { permisos })

