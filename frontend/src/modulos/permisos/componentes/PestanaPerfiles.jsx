import { useCallback, useState } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import {
  listarPerfiles, registrarPerfil, modificarPerfil, darDeBajaPerfil,
} from '../permisos.api.js'
import { FormularioPerfil } from './FormularioPerfil.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { Confirmar } from '../../../ui/Dialogo.jsx'
import { IconoMas, IconoEditar, IconoQuitar, IconoCandado } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF03.1 — listado y administracion de perfiles.
export const PestanaPerfiles = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('SOPORTE_SISTEMA')

  const consultar = useCallback((params) => listarPerfiles(params), [])
  const listado = useListadoPaginado(consultar, { tamano: 20 })

  const [editando, setEditando] = useState(null) // null | 'nuevo' | perfil
  const [borrando, setBorrando] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [errorAccion, setErrorAccion] = useState(null)

  const guardar = async (datos) => {
    setErrorAccion(null)
    if (editando === 'nuevo') await registrarPerfil(datos)
    else await modificarPerfil(editando.idPerfil, datos)

    setEditando(null)
    listado.recargar()
  }

  const confirmarBaja = async () => {
    setTrabajando(true)
    setErrorAccion(null)
    try {
      await darDeBajaPerfil(borrando.idPerfil)
      setBorrando(null)
      listado.recargar()
    } catch (fallo) {
      setErrorAccion(fallo.message)
      setBorrando(null)
    } finally {
      setTrabajando(false)
    }
  }

  const { datos: perfiles, paginacion, cargando, error } = listado

  return (
    <div className="grid gap-5">
      {escritura && (
        <div className="flex justify-end">
          <Boton onClick={() => setEditando('nuevo')}>
            <IconoMas />
            Nuevo perfil
          </Boton>
        </div>
      )}

      {errorAccion && <Aviso tono="mal">{errorAccion}</Aviso>}
      {error && <Fallo error={error} reintentar={listado.recargar} />}
      {!error && cargando && perfiles.length === 0 && <Cargando filas={4} etiqueta="Cargando perfiles" />}

      {!error && !cargando && perfiles.length === 0 && (
        <Vacio titulo="No hay perfiles" detalle="Faltan los perfiles iniciales en la base." />
      )}

      {perfiles.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {perfiles.map((perfil) => (
              <Fila
                key={perfil.idPerfil}
                principal={
                  <span className="inline-flex items-center gap-2">
                    {perfil.protegido && (
                      <IconoCandado className="size-4 text-ambar" aria-label="Perfil protegido" />
                    )}
                    {perfil.nombre}
                  </span>
                }
                secundario={perfil.descripcion || 'Sin descripción'}
                derecha={
                  <Marca tono={perfil.protegido ? 'destacado' : 'neutro'}>
                    {perfil.usuariosActivos}{' '}
                    {perfil.usuariosActivos === 1 ? 'usuario' : 'usuarios'}
                  </Marca>
                }
                acciones={
                  escritura && !perfil.protegido && (
                    <>
                      <AccionFila etiqueta="Editar" onClick={() => setEditando(perfil)}>
                        <IconoEditar className="size-4" />
                      </AccionFila>
                      <AccionFila etiqueta="Dar de baja" peligrosa onClick={() => setBorrando(perfil)}>
                        <IconoQuitar className="size-4" />
                      </AccionFila>
                    </>
                  )
                }
              />
            ))}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <FormularioPerfil
        abierto={editando !== null}
        perfil={editando === 'nuevo' ? null : editando}
        alCerrar={() => setEditando(null)}
        alGuardar={guardar}
      />

      <Confirmar
        abierto={borrando !== null}
        alCerrar={() => setBorrando(null)}
        alConfirmar={confirmarBaja}
        trabajando={trabajando}
        titulo="Dar de baja el perfil"
        detalle={`¿Querés dar de baja el perfil "${borrando?.nombre ?? ''}"? No se puede dar de baja si tiene usuarios activos.`}
        textoAccion="Dar de baja"
      />
    </div>
  )
}

