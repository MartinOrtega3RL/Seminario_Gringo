import { useCallback, useEffect, useState } from 'react'
import {
  obtenerMatriz, guardarPermisosPerfil, modificarModulo,
} from '../permisos.api.js'
import {
  alternarPermiso, esCeldaProtegida, serializarPermisos,
} from '../permisos.reglas.js'
import { Boton } from '../../../ui/Boton.jsx'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Texto, Area } from '../../../ui/Formulario.jsx'
import { Cargando, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoCandado, IconoEditar } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF03.3, RF03.4 y RF03.2 — matriz de permisos por perfil y edicion de modulos.
export const MatrizPermisos = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('SOPORTE_SISTEMA')

  const [modulos, setModulos] = useState([])
  const [perfiles, setPerfiles] = useState([])
  const [borrador, setBorrador] = useState({}) // { [idPerfil]: { [codigo]: { lectura, escritura } } }
  const [sucios, setSucios] = useState({})
  const [guardandoId, setGuardandoId] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [moduloEditado, setModuloEditado] = useState(null)
  const [modNombre, setModNombre] = useState('')
  const [modDesc, setModDesc] = useState('')
  const [modError, setModError] = useState(null)
  const [guardandoMod, setGuardandoMod] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { datos } = await obtenerMatriz()
      setModulos(datos.modulos)
      setPerfiles(datos.perfiles)
      const mapa = {}
      for (const p of datos.perfiles) {
        mapa[p.idPerfil] = p.permisos
      }
      setBorrador(mapa)
      setSucios({})
    } catch (fallo) {
      setError(fallo)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => {
    cargar()
  }, [cargar])

  const cambiar = (perfil, codigoModulo, campo, valor) => {
    if (!escritura || esCeldaProtegida(perfil, codigoModulo)) return
    setAviso(null)
    setBorrador((prev) => ({
      ...prev,
      [perfil.idPerfil]: {
        ...prev[perfil.idPerfil],
        [codigoModulo]: alternarPermiso(prev[perfil.idPerfil]?.[codigoModulo], campo, valor),
      },
    }))
    setSucios((prev) => ({ ...prev, [perfil.idPerfil]: true }))
  }

  const guardarPerfil = async (perfil) => {
    setGuardandoId(perfil.idPerfil)
    setAviso(null)
    try {
      const payload = serializarPermisos(modulos, borrador[perfil.idPerfil])
      await guardarPermisosPerfil(perfil.idPerfil, payload)
      setSucios((prev) => ({ ...prev, [perfil.idPerfil]: false }))
      setAviso({ tono: 'bien', texto: `Permisos de "${perfil.nombre}" guardados.` })
    } catch (fallo) {
      setAviso({ tono: 'mal', texto: fallo.message })
    } finally {
      setGuardandoId(null)
    }
  }

  const abrirModulo = (mod) => {
    setModuloEditado(mod)
    setModNombre(mod.nombre)
    setModDesc(mod.descripcion ?? '')
    setModError(null)
    setGuardandoMod(false)
  }

  const guardarModulo = async (evento) => {
    evento.preventDefault()
    if (modNombre.trim().length < 2) {
      setModError('El nombre del módulo necesita al menos 2 caracteres.')
      return
    }
    setGuardandoMod(true)
    setModError(null)
    try {
      await modificarModulo(moduloEditado.idModulo, {
        nombre: modNombre.trim(),
        descripcion: modDesc.trim() || null,
      })
      setModuloEditado(null)
      await cargar()
    } catch (fallo) {
      setModError(fallo.message)
      setGuardandoMod(false)
    }
  }

  if (error) return <Fallo error={error} reintentar={cargar} />
  if (cargando) return <Cargando filas={4} etiqueta="Cargando matriz de permisos" />

  return (
    <div className="grid gap-5">
      <p className="border-l-2 border-ambar ps-3 text-xs leading-relaxed text-crema/75">
        Los usuarios con sesión abierta ven los menús nuevos al volver a entrar, pero el servidor aplica el cambio en el acto.
      </p>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <div className="overflow-x-auto border-2 border-black bg-azul-hondo">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr className="border-b-2 border-crema/20 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-crema/70">
              <th className="px-4 py-3">Perfil</th>
              {modulos.map((mod) => (
                <th key={mod.idModulo} className="px-3 py-3 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span>{mod.nombre}</span>
                    {escritura && (
                      <button
                        type="button"
                        onClick={() => abrirModulo(mod)}
                        title={`Editar ${mod.nombre}`}
                        aria-label={`Editar módulo ${mod.nombre}`}
                        className="text-crema/45 hover:text-ambar"
                      >
                        <IconoEditar className="size-3.5" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {escritura && <th className="px-4 py-3 text-right">Acción</th>}
            </tr>
          </thead>
          <tbody>
            {perfiles.map((perfil) => {
              const mapa = borrador[perfil.idPerfil] ?? {}
              const sucio = Boolean(sucios[perfil.idPerfil])

              return (
                <tr key={perfil.idPerfil} className="border-b border-crema/10 last:border-b-0">
                  <td className="px-4 py-3 font-semibold text-crema">
                    <span className="inline-flex items-center gap-1.5">
                      {perfil.protegido && <IconoCandado className="size-4 text-ambar" />}
                      {perfil.nombre}
                    </span>
                  </td>

                  {modulos.map((mod) => {
                    const celda = mapa[mod.codigo] ?? { lectura: false, escritura: false }
                    const bloqueada = !escritura || esCeldaProtegida(perfil, mod.codigo)

                    return (
                      <td key={mod.idModulo} className="px-3 py-3">
                        <div className="flex items-center justify-center gap-3">
                          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-crema/80">
                            <input
                              type="checkbox"
                              checked={Boolean(celda.lectura)}
                              disabled={bloqueada}
                              onChange={(e) => cambiar(perfil, mod.codigo, 'lectura', e.target.checked)}
                              aria-label={`${perfil.nombre} lectura en ${mod.nombre}`}
                              className="size-4 accent-ambar disabled:opacity-50"
                            />
                            Lec
                          </label>
                          <label className="inline-flex cursor-pointer items-center gap-1 text-xs text-crema/80">
                            <input
                              type="checkbox"
                              checked={Boolean(celda.escritura)}
                              disabled={bloqueada}
                              onChange={(e) => cambiar(perfil, mod.codigo, 'escritura', e.target.checked)}
                              aria-label={`${perfil.nombre} escritura en ${mod.nombre}`}
                              className="size-4 accent-escarlata disabled:opacity-50"
                            />
                            Esc
                          </label>
                        </div>
                      </td>
                    )
                  })}

                  {escritura && (
                    <td className="px-4 py-3 text-right">
                      <Boton
                        tono={sucio ? 'rojo' : 'papel'}
                        tamano="chico"
                        disabled={!sucio || guardandoId === perfil.idPerfil}
                        cargando={guardandoId === perfil.idPerfil}
                        onClick={() => guardarPerfil(perfil)}
                      >
                        Guardar
                      </Boton>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Dialogo
        abierto={moduloEditado !== null}
        alCerrar={() => setModuloEditado(null)}
        titulo="Editar módulo"
        descripcion={moduloEditado ? `Código interno: ${moduloEditado.codigo}` : ''}
        ancho="max-w-md"
        pie={
          <div className="flex justify-end gap-3">
            <Boton tono="desnudo" onClick={() => setModuloEditado(null)} disabled={guardandoMod}>
              Cancelar
            </Boton>
            <Boton form="form-modulo" type="submit" cargando={guardandoMod}>
              Guardar
            </Boton>
          </div>
        }
      >
        <form id="form-modulo" onSubmit={guardarModulo} noValidate className="grid gap-4">
          <Texto
            etiqueta="Nombre"
            obligatorio
            value={modNombre}
            onChange={(e) => setModNombre(e.target.value)}
            maxLength={80}
            disabled={guardandoMod}
          />
          <Area
            etiqueta="Descripción"
            value={modDesc}
            onChange={(e) => setModDesc(e.target.value)}
            maxLength={200}
            disabled={guardandoMod}
          />
          {modError && <Aviso tono="mal">{modError}</Aviso>}
        </form>
      </Dialogo>
    </div>
  )
}

