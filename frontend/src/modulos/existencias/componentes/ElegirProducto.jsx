import { useEffect, useRef, useState } from 'react'
import { listarProductos } from '../../catalogo/catalogo.api.js'
import { IconoBuscar } from '../../../ui/Iconos.jsx'

// Buscador compacto para elegir un producto dentro de un diálogo. No hay lector
// de códigos (S07): se tipea el nombre o el código interno, igual que en la venta.

export const ElegirProducto = ({ etiqueta = 'Producto', alElegir, elegido, deshabilitado }) => {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const peticion = useRef(0)

  useEffect(() => {
    if (elegido) return undefined

    const propia = ++peticion.current
    const reloj = setTimeout(async () => {
      if (!texto.trim()) {
        if (propia === peticion.current) setResultados([])
        return
      }

      setBuscando(true)
      try {
        const { datos } = await listarProductos({ texto: texto.trim(), tamano: 6 })
        if (propia === peticion.current) setResultados(datos)
      } catch {
        if (propia === peticion.current) setResultados([])
      } finally {
        if (propia === peticion.current) setBuscando(false)
      }
    }, 250)

    return () => clearTimeout(reloj)
  }, [texto, elegido])

  if (elegido) {
    return (
      <div>
        <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
          {etiqueta}
        </span>
        <div className="flex items-center justify-between gap-3 border-2 border-crema/25 bg-crema/5 px-3 py-2">
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-crema">
              {elegido.denominacion}
            </span>
            <span className="numeral mt-0.5 block text-xs text-crema/55">
              {elegido.codigoInterno} · {elegido.stockActual} en stock
            </span>
          </span>
          <button
            type="button"
            disabled={deshabilitado}
            onClick={() => {
              alElegir(null)
              setTexto('')
            }}
            className="shrink-0 text-xs font-semibold uppercase tracking-wide text-crema/50 hover:text-escarlata disabled:opacity-40"
          >
            Cambiar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <label htmlFor="elegir-producto" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
        {etiqueta}
      </label>

      <div className="relative">
        <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
        <input
          id="elegir-producto"
          type="search"
          autoFocus
          value={texto}
          disabled={deshabilitado}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Nombre o código interno…"
          className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema pl-10 pr-3 text-base text-tinta placeholder:text-tinta/40"
        />
      </div>

      {texto.trim() && (
        <ul className="mt-2 max-h-48 overflow-y-auto border-2 border-crema/20" aria-live="polite">
          {buscando && resultados.length === 0 && (
            <li className="px-3 py-3 text-xs text-crema/55">Buscando…</li>
          )}
          {!buscando && resultados.length === 0 && (
            <li className="px-3 py-3 text-xs text-crema/55">Ningún producto coincide.</li>
          )}
          {resultados.map((producto) => (
            <li key={producto.idProducto}>
              <button
                type="button"
                onClick={() => alElegir(producto)}
                className="flex w-full items-baseline justify-between gap-3 border-b border-crema/10 px-3 py-2 text-left hover:bg-crema/10"
              >
                <span className="min-w-0 truncate text-sm text-crema">{producto.denominacion}</span>
                <span className="numeral shrink-0 text-xs text-crema/55">
                  {producto.stockActual} en stock
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
