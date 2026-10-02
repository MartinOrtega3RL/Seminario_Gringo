import { useEffect, useRef, useState } from 'react'
import { listarProveedores } from '../../proveedores/proveedores.api.js'
import { IconoBuscar, IconoQuitar } from '../../../ui/Iconos.jsx'

// RF06.7 — a qué proveedores se les compra este producto.
//
// Solo la asociación: ni el código con el que el proveedor lo identifica ni el
// precio de compra. Contesta «¿a quién le pido esto?» y nada más.
//
// No se da de alta un proveedor desde acá: se elige de los que ya existen. Un
// alta al paso, con el nombre escrito apurado, es cómo termina habiendo tres
// «Tecnomóvil» distintos en el padrón.

export const ProveedoresDelProducto = ({ elegidos, alCambiar, deshabilitado }) => {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const peticion = useRef(0)

  useEffect(() => {
    const propia = ++peticion.current
    const reloj = setTimeout(async () => {
      if (!texto.trim()) {
        if (propia === peticion.current) setResultados([])
        return
      }
      setBuscando(true)
      try {
        const { datos } = await listarProveedores({ texto: texto.trim(), tamano: 6 })
        if (propia === peticion.current) setResultados(datos)
      } catch {
        if (propia === peticion.current) setResultados([])
      } finally {
        if (propia === peticion.current) setBuscando(false)
      }
    }, 250)

    return () => clearTimeout(reloj)
  }, [texto])

  const sumar = (proveedor) => {
    if (!elegidos.some((p) => p.idProveedor === proveedor.idProveedor)) {
      alCambiar([...elegidos, proveedor])
    }
    setTexto('')
    setResultados([])
  }

  const nombre = (proveedor) => proveedor.persona?.apellidoNombre ?? 'Sin nombre'

  return (
    <div>
      <label
        htmlFor="buscar-proveedor-producto"
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
      >
        Proveedores
      </label>

      <div className="relative">
        <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
        <input
          id="buscar-proveedor-producto"
          type="search"
          value={texto}
          disabled={deshabilitado}
          onChange={(evento) => setTexto(evento.target.value)}
          placeholder="Buscar a quién se le compra…"
          className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema pl-10 pr-3 text-base text-tinta placeholder:text-tinta/40"
        />
      </div>

      {texto.trim() && (
        <ul className="mt-2 max-h-40 overflow-y-auto border-2 border-crema/20" aria-live="polite">
          {buscando && resultados.length === 0 && (
            <li className="px-3 py-3 text-xs text-crema/55">Buscando…</li>
          )}
          {!buscando && resultados.length === 0 && (
            <li className="px-3 py-3 text-xs leading-relaxed text-crema/55">
              Ningún proveedor coincide. Se dan de alta en Clientes y proveedores.
            </li>
          )}
          {resultados.map((proveedor) => (
            <li key={proveedor.idProveedor}>
              <button
                type="button"
                onClick={() => sumar(proveedor)}
                className="flex w-full items-baseline justify-between gap-3 border-b border-crema/10 px-3 py-2 text-left hover:bg-crema/10"
              >
                <span className="truncate text-sm text-crema">{nombre(proveedor)}</span>
                {proveedor.persona?.telefonoWhatsapp && (
                  <span className="numeral shrink-0 text-xs text-crema/50">
                    {proveedor.persona.telefonoWhatsapp}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-1.5 text-xs leading-relaxed text-crema/60">
        Para saber a quién pedirle reposición cuando el stock baja.
      </p>

      {elegidos.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {elegidos.map((proveedor) => (
            <li key={proveedor.idProveedor}>
              <button
                type="button"
                disabled={deshabilitado}
                onClick={() => alCambiar(elegidos.filter((p) => p.idProveedor !== proveedor.idProveedor))}
                className="inline-flex items-center gap-1 border border-crema/30 px-1.5 py-0.5 text-[11px] font-semibold text-crema/75 hover:border-escarlata hover:text-escarlata disabled:opacity-40"
                aria-label={`Quitar ${nombre(proveedor)}`}
              >
                {nombre(proveedor)}
                <IconoQuitar className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
