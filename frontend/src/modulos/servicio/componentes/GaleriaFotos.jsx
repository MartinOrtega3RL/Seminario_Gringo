import { useEffect, useRef, useState } from 'react'
import { cargarArchivo } from '../../../api/cliente.js'
import { subirFoto, rutaFoto } from '../servicio.api.js'
import { MOMENTOS_FOTO, fechaHora } from '../servicio.reglas.js'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { IconoFoto } from '../../../ui/Iconos.jsx'

// RF21.7 — fotografías del equipo. Se piden con la sesión y se muestran desde una
// URL de objeto: no son archivos públicos, así que un <img src> directo no
// llegaría con la cabecera de autorización.

const Miniatura = ({ idOrden, foto, grande = false, alAbrir }) => {
  const [url, setUrl] = useState(null)
  const [fallo, setFallo] = useState(false)

  useEffect(() => {
    let vigente = true
    let creada = null

    cargarArchivo(rutaFoto(idOrden, foto.idFoto))
      .then((direccion) => {
        creada = direccion
        if (vigente) setUrl(direccion)
        else URL.revokeObjectURL(direccion)
      })
      .catch(() => vigente && setFallo(true))

    return () => {
      vigente = false
      if (creada) URL.revokeObjectURL(creada)
    }
  }, [idOrden, foto.idFoto])

  const medida = grande ? 'max-h-[70vh] w-full object-contain' : 'size-full object-cover'

  if (fallo) {
    return <span className="grid size-full place-items-center p-1 text-center text-[10px] text-crema/50">No se pudo cargar</span>
  }
  if (!url) return <span className="block size-full animate-pulse bg-crema/10" aria-label="Cargando foto" />

  const imagen = <img src={url} alt={foto.descripcion ?? `Foto ${MOMENTOS_FOTO[foto.momentoCaptura].toLowerCase()}`} className={medida} />
  if (grande) return imagen

  return (
    <button type="button" onClick={() => alAbrir(foto, url)} className="block size-full" aria-label="Ver la foto en grande">
      {imagen}
    </button>
  )
}

export const GaleriaFotos = ({ idOrden, fotos, puedeAgregar, alActualizar }) => {
  const [momento, setMomento] = useState('INGRESO')
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState(null)
  const [ampliada, setAmpliada] = useState(null)
  const entrada = useRef(null)

  const subir = async (evento) => {
    const archivos = [...evento.target.files].filter((archivo) => archivo.type.startsWith('image/'))
    evento.target.value = ''
    if (archivos.length === 0) return

    setSubiendo(true)
    setError(null)
    try {
      let ultima = null
      for (const archivo of archivos) ultima = await subirFoto(idOrden, archivo, { momento })
      alActualizar(ultima.datos)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <div className="grid gap-3">
      {fotos.length === 0 && (
        <p className="text-sm leading-relaxed text-crema/60">
          No hay fotos de este equipo.
          {puedeAgregar && ' Una foto al ingresar respalda al comercio ante un reclamo.'}
        </p>
      )}

      {fotos.length > 0 && (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-3">
          {fotos.map((foto) => (
            <li key={foto.idFoto}>
              <div className="aspect-square overflow-hidden border-2 border-crema/30 bg-azul-hondo">
                <Miniatura idOrden={idOrden} foto={foto} alAbrir={(f, url) => setAmpliada({ foto: f, url })} />
              </div>
              <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-crema/55">
                {MOMENTOS_FOTO[foto.momentoCaptura]}
              </p>
            </li>
          ))}
        </ul>
      )}

      {puedeAgregar && (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="momento-foto" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
              Momento
            </label>
            <select
              id="momento-foto"
              value={momento}
              onChange={(evento) => setMomento(evento.target.value)}
              disabled={subiendo}
              className="h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
            >
              {Object.entries(MOMENTOS_FOTO).map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
          </div>

          <Boton tono="papel" cargando={subiendo} onClick={() => entrada.current?.click()}>
            <IconoFoto className="size-5" />
            Agregar foto
          </Boton>
          <input ref={entrada} type="file" accept="image/*" multiple onChange={subir} className="sr-only" tabIndex={-1} />
        </div>
      )}

      {error && <Aviso tono="mal">{error}</Aviso>}

      <Dialogo
        abierto={ampliada !== null}
        alCerrar={() => setAmpliada(null)}
        titulo={ampliada ? MOMENTOS_FOTO[ampliada.foto.momentoCaptura] : ''}
        descripcion={ampliada ? fechaHora(ampliada.foto.fechaHora) : undefined}
        ancho="max-w-3xl"
        pie={<div className="flex justify-end"><Boton tono="desnudo" onClick={() => setAmpliada(null)}>Cerrar</Boton></div>}
      >
        {ampliada && <img src={ampliada.url} alt="Foto del equipo, ampliada" className="max-h-[65vh] w-full object-contain" />}
      </Dialogo>
    </div>
  )
}
