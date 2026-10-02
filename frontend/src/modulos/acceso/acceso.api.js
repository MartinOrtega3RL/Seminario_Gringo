import { api, consulta } from '../../api/cliente.js'

// RF01.3 — el usuario cambia su propia contrasena. Endpoint ya implementado.
export const cambiarContrasenaPropia = (datos) => api.enviar('/acceso/contrasena', datos)

// RF02 — administracion de usuarios.
export const listarUsuarios = ({ texto, pagina = 1, tamano = 25 } = {}) =>
  api.obtener(`/usuarios${consulta({ texto, pagina, tamano })}`)

export const registrarUsuario = (datos) => api.enviar('/usuarios', datos)

export const modificarUsuario = (idUsuario, datos) => api.modificar(`/usuarios/${idUsuario}`, datos)

/** RF02.3 — baja LOGICA. Conserva el registro de operaciones del usuario. */
export const darDeBajaUsuario = (idUsuario) => api.borrar(`/usuarios/${idUsuario}`)

/** RF02.4 — perfiles disponibles para asignar. */
export const listarPerfiles = () => api.obtener('/usuarios/perfiles')
