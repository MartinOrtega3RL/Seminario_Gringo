import { useEffect, useRef, useState } from 'react'
import { listarClientes, listarTiposCliente, registrarCliente } from '../../clientes/clientes.api.js'
import { FormularioCliente } from '../../clientes/componentes/FormularioCliente.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { IconoBuscar, IconoMas, IconoQuitar } from '../../../ui/Iconos.jsx'

// RF21.2 — la orden se asocia a un cliente registrado.
//
// A diferencia del mostrador, acá el cliente NO es opcional: sin él no hay a quién
// avisarle que el equipo está listo (H11). Por eso el control arranca abierto y
// ofrece dar de alta ahí mismo: el cliente que llega por primera vez con el
// celular roto no puede obligar a quien lo atiende a salir a otra pantalla.

export const ElegirCliente = ({ cliente, alElegir, error, deshabilitado }) => {
  const [texto, setTexto] = useState('')
  const [resultados, setResultados] = useState([])
  const [buscando, setBuscando] = useState(false)
  const [tipos, setTipos] = useState([])
  const [creando, setCreando] = useState(false)

  const peticion = useRef(0)

  useEffect(() => {
    listarTiposCliente().then(({ datos }) => setTipos(datos)).catch(() => setTipos([]))
  }, [])

  useEffect(() => {
    if (cliente) return undefined

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
  }, [texto, cliente])

  const darDeAlta = async (datos) => {
    const nuevo = await registrarCliente(datos)
    setCreando(false)
    alElegir(nuevo.datos)
  }

  if (cliente) {
    return (
      <div className="flex items-start justify-between gap-3 border-2 border-crema/25 bg-crema/5 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-crema">{cliente.persona.apellidoNombre}</p>
          <p className="mt-0.5 text-xs text-crema/60">
            {[
              cliente.persona.numeroDocumento && `${cliente.persona.tipoDocumento} ${cliente.persona.numeroDocumento}`,
              cliente.persona.telefonoWhatsapp ? `WhatsApp ${cliente.persona.telefonoWhatsapp}` : null,
            ].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
          {!cliente.persona.telefonoWhatsapp && (
            <p className="mt-1 text-xs font-semibold text-ambar">
              Sin WhatsApp cargado: pedíselo, es con lo que se le avisa cuando el equipo esté listo.
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={deshabilitado}
          onClick={() => alElegir(null)}
          aria-label="Cambiar de cliente"
          className="shrink-0 p-1 text-crema/45 hover:text-escarlata disabled:opacity-40"
        >
          <IconoQuitar className="size-4" />
        </button>
      </div>
    )
  }

  return (
    <div>
      <div className={`border-2 ${error ? 'border-escarlata' : 'border-crema/30'}`}>
        <div className="relative">
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
          <label className="sr-only" htmlFor="buscar-cliente-orden">
            Buscar cliente por nombre, documento o WhatsApp
          </label>
          <input
            id="buscar-cliente-orden"
            type="search"
            value={texto}
            disabled={deshabilitado}
            onChange={(evento) => setTexto(evento.target.value)}
            placeholder="Nombre, documento o WhatsApp…"
            className="h-12 w-full border-b-2 border-tinta bg-crema pl-11 pr-3 text-base text-tinta placeholder:text-tinta/40"
          />
        </div>

        <ul className="max-h-52 overflow-y-auto" aria-live="polite">
          {buscando && resultados.length === 0 && <li className="px-3 py-3 text-xs text-crema/55">Buscando…</li>}

          {!buscando && resultados.length === 0 && (
            <li className="px-3 py-3 text-xs leading-relaxed text-crema/60">
              {texto ? 'Ningún cliente coincide. Podés darlo de alta acá abajo.' : 'Todavía no hay clientes cargados.'}
            </li>
          )}

          {resultados.map((posible) => (
            <li key={posible.idCliente}>
              <button
                type="button"
                onClick={() => alElegir(posible)}
                className="flex w-full items-baseline justify-between gap-3 border-b border-crema/10 px-3 py-2.5 text-left hover:bg-crema/10"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-crema">
                  {posible.persona.apellidoNombre}
                </span>
                <span className="numeral shrink-0 text-xs text-crema/55">
                  {posible.persona.telefonoWhatsapp ?? 'sin WhatsApp'}
                </span>
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t-2 border-crema/15 p-2">
          <Boton tono="papel" tamano="chico" onClick={() => setCreando(true)} disabled={deshabilitado}>
            <IconoMas className="size-4" />
            Dar de alta un cliente nuevo
          </Boton>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs font-semibold text-ambar">{error}</p>
      )}

      <FormularioCliente
        abierto={creando}
        cliente={null}
        tipos={tipos}
        alCerrar={() => setCreando(false)}
        alGuardar={darDeAlta}
      />
    </div>
  )
}
