import { useCallback, useEffect, useState } from 'react'
import {
  listarCategorias, registrarCategoria, modificarCategoria, darDeBajaCategoria,
  listarMarcas, registrarMarca, modificarMarca, darDeBajaMarca,
} from '../catalogo.api.js'
import { Titulo, Filete } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { Confirmar } from '../../../ui/Dialogo.jsx'
import { IconoEditar, IconoQuitar, IconoMas } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF07.1 y RF07.2 — categorías y marcas. Son dos listas idénticas en forma, así
// que comparten componente: dos pantallas gemelas es como terminan distintas.
//
// La edición es en el mismo renglón y no en un diálogo: cambiar un nombre de
// una palabra no justifica abrir una ventana encima de todo.

const Coleccion = ({ titulo, singular, campoId, cargar, crear, editar, borrar, escritura }) => {
  const [filas, setFilas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [nuevo, setNuevo] = useState('')
  const [editandoId, setEditandoId] = useState(null)
  const [borradorNombre, setBorradorNombre] = useState('')
  const [borrando, setBorrando] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  const [avisoError, setAvisoError] = useState(null)

  const recargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { datos } = await cargar()
      setFilas(datos)
    } catch (fallo) {
      setError(fallo)
      setFilas([])
    } finally {
      setCargando(false)
    }
  }, [cargar])

  useEffect(() => {
    recargar()
  }, [recargar])

  const conError = async (accion) => {
    setAvisoError(null)
    try {
      await accion()
      await recargar()
      return true
    } catch (fallo) {
      setAvisoError(fallo.message)
      return false
    }
  }

  const agregar = async (evento) => {
    evento.preventDefault()
    const nombre = nuevo.trim()
    if (!nombre) return
    if (await conError(() => crear({ nombre }))) setNuevo('')
  }

  const guardarEdicion = async (fila) => {
    const nombre = borradorNombre.trim()
    if (!nombre || nombre === fila.nombre) return setEditandoId(null)
    if (await conError(() => editar(fila[campoId], { nombre }))) setEditandoId(null)
  }

  const confirmarBaja = async () => {
    setTrabajando(true)
    try {
      if (await conError(() => borrar(borrando[campoId]))) setBorrando(null)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <section>
      <Titulo nivel={2} className="text-xl">
        {titulo}
      </Titulo>
      <Filete className="mt-2 mb-4" />

      {escritura && (
        <form onSubmit={agregar} className="mb-4 flex gap-2">
          <label className="sr-only" htmlFor={`nueva-${singular}`}>
            Nombre {singular}
          </label>
          <input
            id={`nueva-${singular}`}
            value={nuevo}
            onChange={(evento) => setNuevo(evento.target.value)}
            placeholder={`Nueva ${singular}…`}
            maxLength={60}
            className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-base text-tinta placeholder:text-tinta/40"
          />
          <Boton type="submit" disabled={!nuevo.trim()}>
            <IconoMas />
            Agregar
          </Boton>
        </form>
      )}

      {avisoError && (
        <div className="mb-3">
          <Aviso tono="mal">{avisoError}</Aviso>
        </div>
      )}

      {error && <Fallo error={error} reintentar={recargar} />}

      {!error && cargando && <Cargando filas={3} etiqueta={`Cargando ${titulo.toLowerCase()}`} />}

      {!error && !cargando && filas.length === 0 && (
        <Vacio
          titulo={`Sin ${titulo.toLowerCase()}`}
          detalle={`Todo producto necesita una ${singular}. Cargá la primera acá arriba.`}
        />
      )}

      {!cargando && filas.length > 0 && (
        <Listado>
          {filas.map((fila) => {
            const enEdicion = editandoId === fila[campoId]

            return (
              <Fila
                key={fila[campoId]}
                principal={
                  enEdicion ? (
                    <input
                      autoFocus
                      value={borradorNombre}
                      onChange={(evento) => setBorradorNombre(evento.target.value)}
                      onBlur={() => guardarEdicion(fila)}
                      onKeyDown={(evento) => {
                        if (evento.key === 'Enter') guardarEdicion(fila)
                        if (evento.key === 'Escape') setEditandoId(null)
                      }}
                      maxLength={60}
                      aria-label={`Nombre de ${fila.nombre}`}
                      className="h-8 w-full max-w-xs rounded-[3px] border-2 border-tinta bg-crema px-2 text-sm font-semibold text-tinta"
                    />
                  ) : (
                    fila.nombre
                  )
                }
                acciones={
                  escritura &&
                  !enEdicion && (
                    <>
                      <AccionFila
                        etiqueta="Renombrar"
                        onClick={() => {
                          setEditandoId(fila[campoId])
                          setBorradorNombre(fila.nombre)
                        }}
                      >
                        <IconoEditar className="size-4" />
                      </AccionFila>
                      <AccionFila etiqueta="Dar de baja" peligrosa onClick={() => setBorrando(fila)}>
                        <IconoQuitar className="size-4" />
                      </AccionFila>
                    </>
                  )
                }
              />
            )
          })}
        </Listado>
      )}

      <Confirmar
        abierto={borrando !== null}
        alCerrar={() => setBorrando(null)}
        alConfirmar={confirmarBaja}
        trabajando={trabajando}
        titulo={`Dar de baja ${borrando?.nombre ?? ''}`}
        // La base usa ON DELETE RESTRICT: si hay productos colgando, no se
        // puede. Decirlo antes evita el error técnico.
        detalle="Si todavía hay productos usándola, el sistema no va a dejar darla de baja."
        textoAccion="Dar de baja"
      />
    </section>
  )
}

export const Clasificaciones = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CATALOGO_STOCK')

  return (
    <div className="grid gap-6">
      <div className="grid gap-8 lg:grid-cols-2">
        <Coleccion
          titulo="Categorías"
          singular="categoría"
          campoId="idCategoria"
          cargar={listarCategorias}
          crear={registrarCategoria}
          editar={modificarCategoria}
          borrar={darDeBajaCategoria}
          escritura={escritura}
        />

        <Coleccion
          titulo="Marcas"
          singular="marca"
          campoId="idMarca"
          cargar={listarMarcas}
          crear={registrarMarca}
          editar={modificarMarca}
          borrar={darDeBajaMarca}
          escritura={escritura}
        />
      </div>
    </div>
  )
}
