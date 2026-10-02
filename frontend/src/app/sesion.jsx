import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api, guardarToken, leerToken } from '../api/cliente.js'

// Estado compartido de toda la aplicacion: quien es el usuario y que puede
// hacer. Es lo unico que se comparte; el resto del estado vive en el gancho
// de cada modulo. No hace falta una libreria de estado global para esto.

const Contexto = createContext(null)

export const ProveedorSesion = ({ children }) => {
  const [usuario, setUsuario] = useState(null)
  const [rehidratando, setRehidratando] = useState(Boolean(leerToken()))

  // Al recargar la pagina el token sigue en sessionStorage, pero no los datos
  // del usuario. Se los vuelve a pedir en vez de guardarlos duplicados.
  useEffect(() => {
    if (!leerToken()) return

    let vigente = true
    api
      .obtener('/acceso/sesion')
      .then((respuesta) => vigente && setUsuario(respuesta.usuario))
      .catch(() => guardarToken(null))
      .finally(() => vigente && setRehidratando(false))

    return () => {
      vigente = false
    }
  }, [])

  const ingresar = useCallback(async (credenciales) => {
    const respuesta = await api.enviar('/acceso/ingresar', credenciales)
    guardarToken(respuesta.token)
    setUsuario(respuesta.usuario)
    return respuesta.usuario
  }, [])

  const salir = useCallback(async () => {
    // Aunque el servidor falle, la sesion local se cierra: quedarse adentro
    // por un error de red seria lo contrario de lo que el usuario pidio.
    await api.enviar('/acceso/salir').catch(() => {})
    guardarToken(null)
    setUsuario(null)
  }, [])

  const valor = useMemo(() => {
    const porModulo = new Map((usuario?.permisos ?? []).map((p) => [p.modulo, p]))

    return {
      usuario,
      rehidratando,
      ingresar,
      salir,
      // RF04.1: con esto se arma el menu. La verificacion real la hace el
      // servidor en cada operacion (RNF18); esto es solo para la interfaz.
      puedeLeer: (modulo) => porModulo.has(modulo),
      puedeEscribir: (modulo) => Boolean(porModulo.get(modulo)?.escritura),
      modulos: usuario?.permisos ?? [],
    }
  }, [usuario, rehidratando, ingresar, salir])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export const useSesion = () => {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useSesion se usa dentro de ProveedorSesion')
  return valor
}
