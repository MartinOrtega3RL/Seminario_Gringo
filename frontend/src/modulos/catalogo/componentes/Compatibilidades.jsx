import { useEffect, useRef, useState } from 'react'
import { listarModelos, registrarModelo } from '../catalogo.api.js'
import { Boton } from '../../../ui/Boton.jsx'
import { IconoQuitar, IconoBuscar } from '../../../ui/Iconos.jsx'

// RF06.8 — modelos de dispositivo compatibles con el producto.
//
// Se eligen de una lista, no se escriben libres: si cada funda creara su propio
// "iPhone 13", buscar por modelo devolvería tres variantes escritas distinto y
// la compatibilidad no serviría para nada. Un modelo se da de alta una vez.
//
// Para qué existe esto: cuando falta el repuesto exacto, encontrar el que se
// adapta es lo que salva la venta (H23).

const SO = [
  { valor: '', texto: 'Sin especificar' },
  { valor: 'ANDROID', texto: 'Android' },
  { valor: 'IOS', texto: 'iOS' },
  { valor: 'OTRO', texto: 'Otro' },
]

export const Compatibilidades = ({ elegidos, alCambiar, marcas, idMarcaProducto, deshabilitado }) => {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [creando, setCreando] = useState(false)
  const [idMarcaNueva, setIdMarcaNueva] = useState('')
  const [soNuevo, setSoNuevo] = useState('')
  const [error, setError] = useState(null)
  const peticion = useRef(0)

  useEffect(() => {
    setIdMarcaNueva(String(idMarcaProducto ?? ''))
  }, [idMarcaProducto])

  useEffect(() => {
    const propia = ++peticion.current
    const reloj = setTimeout(async () => {
      if (!texto.trim()) {
        if (propia === peticion.current) setResultados([])
        return
      }
      setBuscando(true)
      try {
        const { datos } = await listarModelos(texto.trim())
        if (propia === peticion.current) setResultados(datos)
      } catch {
        if (propia === peticion.current) setResultados([])
      } finally {
        if (propia === peticion.current) setBuscando(false)
      }
    }, 250)

    return () => clearTimeout(reloj)
  }, [texto])

  const sumar = (modelo) => {
    if (!elegidos.some((m) => m.idModelo === modelo.idModelo)) alCambiar([...elegidos, modelo])
    setTexto('')
    setResultados([])
    setCreando(false)
  }

  const crear = async () => {
    setError(null)
    try {
      const { datos } = await registrarModelo({
        idMarca: Number(idMarcaNueva),
        denominacion: texto.trim(),
        sistemaOperativo: soNuevo || null,
      })
      sumar(datos)
    } catch (fallo) {
      setError(fallo.message)
    }
  }

  const sinCoincidencias = texto.trim() && !buscando && resultados.length === 0

  return (
    <div>
      <label htmlFor="buscar-modelo" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
        Modelos compatibles
      </label>

      <div className="relative">
        <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
        <input
          id="buscar-modelo"
          type="search"
          value={texto}
          disabled={deshabilitado}
          onChange={(evento) => {
            setTexto(evento.target.value)
            setCreando(false)
            setError(null)
          }}
          placeholder="iPhone 13, Galaxy A54…"
          className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema pl-10 pr-3 text-base text-tinta placeholder:text-tinta/40"
        />
      </div>

      {resultados.length > 0 && (
        <ul className="mt-2 max-h-40 overflow-y-auto border-2 border-crema/20">
          {resultados.map((modelo) => (
            <li key={modelo.idModelo}>
              <button
                type="button"
                onClick={() => sumar(modelo)}
                className="flex w-full items-baseline justify-between gap-3 border-b border-crema/10 px-3 py-2 text-left hover:bg-crema/10"
              >
                <span className="truncate text-sm text-crema">{modelo.denominacion}</span>
                <span className="shrink-0 text-[11px] uppercase tracking-wider text-crema/55">
                  {modelo.marca?.nombre}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {sinCoincidencias && !creando && (
        <div className="mt-2 flex items-center justify-between gap-3 border-2 border-dashed border-crema/25 px-3 py-2">
          <span className="text-xs text-crema/65">
            No existe «{texto.trim()}» todavía.
          </span>
          <Boton tono="papel" tamano="chico" onClick={() => setCreando(true)}>
            Darlo de alta
          </Boton>
        </div>
      )}

      {creando && (
        <div className="mt-2 grid gap-2 border-2 border-crema/25 p-3">
          <p className="text-xs text-crema/70">
            Alta de <strong className="text-crema">{texto.trim()}</strong>. El modelo queda
            disponible para todos los productos, no solo para este.
          </p>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-crema/65">
              Marca del equipo
              <select
                value={idMarcaNueva}
                onChange={(evento) => setIdMarcaNueva(evento.target.value)}
                className="mt-1 h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2 text-sm font-semibold normal-case tracking-normal text-tinta"
              >
                <option value="">Elegir…</option>
                {marcas.map((m) => (
                  <option key={m.idMarca} value={m.idMarca}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[11px] font-semibold uppercase tracking-wider text-crema/65">
              Sistema
              <select
                value={soNuevo}
                onChange={(evento) => setSoNuevo(evento.target.value)}
                className="mt-1 h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2 text-sm font-semibold normal-case tracking-normal text-tinta"
              >
                {SO.map(({ valor, texto: t }) => (
                  <option key={valor} value={valor}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error && <p role="alert" className="text-xs font-semibold text-ambar">{error}</p>}

          <div className="flex justify-end gap-2">
            <Boton tono="desnudo" tamano="chico" onClick={() => setCreando(false)}>
              Cancelar
            </Boton>
            <Boton tamano="chico" onClick={crear} disabled={!idMarcaNueva}>
              Dar de alta y agregar
            </Boton>
          </div>
        </div>
      )}

      <p className="mt-1.5 text-xs leading-relaxed text-crema/60">
        Sirve para encontrar un sustituto cuando falta el repuesto exacto.
      </p>

      {elegidos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {elegidos.map((modelo) => (
            <li key={modelo.idModelo}>
              <button
                type="button"
                disabled={deshabilitado}
                onClick={() => alCambiar(elegidos.filter((m) => m.idModelo !== modelo.idModelo))}
                className="inline-flex items-center gap-1 border border-crema/30 px-1.5 py-0.5 text-[11px] font-semibold text-crema/75 hover:border-escarlata hover:text-escarlata disabled:opacity-40"
                aria-label={`Quitar ${modelo.denominacion}`}
              >
                {modelo.denominacion}
                <IconoQuitar className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
