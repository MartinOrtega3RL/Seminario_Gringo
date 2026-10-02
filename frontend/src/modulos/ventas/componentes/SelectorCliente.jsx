import { useEffect, useRef, useState } from 'react'
import { listarClientes } from '../../clientes/clientes.api.js'
import { IconoBuscar, IconoQuitar } from '../../../ui/Iconos.jsx'

// RF16.4 — asociar un cliente a la venta. Sin cliente la venta es de mostrador
// y rige la lista minorista, que es el caso mas frecuente: por eso el control
// arranca cerrado y no estorba, en vez de pedir un cliente que casi nunca hay.
//
// H11: el WhatsApp es el dato de contacto que el comercio pide siempre, asi
// que la busqueda tambien entra por ahi, no solo por nombre.

const ETIQUETA_LISTA = { MINORISTA: 'Minorista', MAYORISTA: 'Mayorista' }

export const SelectorCliente = ({ cliente, alElegir, deshabilitado }) => {
  const [abierto, setAbierto] = useState(false)
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)

  const entrada = useRef(null)
  const peticion = useRef(0)

  useEffect(() => {
    if (!abierto) return
    entrada.current?.focus()
  }, [abierto])

  useEffect(() => {
    if (!abierto) return

    const propia = ++peticion.current
    const reloj = setTimeout(async () => {
      setBuscando(true)
      try {
        const { datos } = await listarClientes({ texto: texto.trim() || undefined, tamano: 6 })
        if (propia === peticion.current) setResultados(datos)
      } catch {
        if (propia === peticion.current) setResultados([])
      } finally {
        if (propia === peticion.current) setBuscando(false)
      }
    }, texto ? 250 : 0)

    return () => clearTimeout(reloj)
  }, [texto, abierto])

  const elegir = (elegido) => {
    alElegir(elegido)
    setAbierto(false)
    setTexto('')
  }

  if (cliente) {
    return (
      <div className="flex items-start justify-between gap-2 border-2 border-crema/25 bg-crema/5 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-crema">
            {cliente.persona.apellidoNombre}
          </p>
          <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-ambar">
            {ETIQUETA_LISTA[cliente.tipoCliente.listaPrecioAplicable]}
            {cliente.persona.telefonoWhatsapp && (
              <span className="numeral ms-2 font-normal normal-case tracking-normal text-crema/50">
                {cliente.persona.telefonoWhatsapp}
              </span>
            )}
          </p>
        </div>

        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => alElegir(null)}
          aria-label="Quitar el cliente de la venta"
          className="shrink-0 p-1 text-crema/45 hover:text-escarlata disabled:opacity-40"
        >
          <IconoQuitar className="size-4" />
        </button>
      </div>
    )
  }

  if (!abierto) {
    return (
      <button
        type="button"
        disabled={deshabilitado}
        onClick={() => setAbierto(true)}
        className="flex w-full items-center justify-between gap-2 border-2 border-dashed border-crema/30 px-3 py-2 text-left text-sm text-crema/70 hover:border-crema/60 hover:text-crema disabled:opacity-40"
      >
        <span>
          Consumidor final
          <span className="ms-2 text-[11px] uppercase tracking-wider text-crema/45">Minorista</span>
        </span>
        <IconoBuscar className="size-4 shrink-0" />
      </button>
    )
  }

  return (
    <div className="border-2 border-crema/30">
      <div className="relative">
        <IconoBuscar className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-tinta/45" />
        <label className="sr-only" htmlFor="buscar-cliente">
          Buscar cliente por nombre, documento o WhatsApp
        </label>
        <input
          id="buscar-cliente"
          ref={entrada}
          type="search"
          value={texto}
          onChange={(evento) => setTexto(evento.target.value)}
          onKeyDown={(evento) => evento.key === 'Escape' && setAbierto(false)}
          placeholder="Nombre, documento o WhatsApp…"
          className="h-10 w-full border-b-2 border-tinta bg-crema pl-8 pr-3 text-sm text-tinta placeholder:text-tinta/40"
        />
      </div>

      <ul className="max-h-44 overflow-y-auto" aria-live="polite">
        {buscando && resultados.length === 0 && (
          <li className="px-3 py-3 text-xs text-crema/55">Buscando…</li>
        )}

        {!buscando && resultados.length === 0 && (
          <li className="px-3 py-3 text-xs leading-relaxed text-crema/55">
            {texto
              ? 'Ningun cliente coincide. Podes seguir sin asociar uno.'
              : 'Todavia no hay clientes cargados.'}
          </li>
        )}

        {resultados.map((posible) => (
          <li key={posible.idCliente}>
            <button
              type="button"
              onClick={() => elegir(posible)}
              className="flex w-full items-baseline justify-between gap-2 border-b border-crema/10 px-3 py-2 text-left hover:bg-crema/10"
            >
              <span className="min-w-0 truncate text-sm text-crema">
                {posible.persona.apellidoNombre}
              </span>
              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider text-ambar">
                {ETIQUETA_LISTA[posible.tipoCliente.listaPrecioAplicable]}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="w-full border-t border-crema/15 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-crema/50 hover:text-crema"
      >
        Seguir sin cliente
      </button>
    </div>
  )
}
