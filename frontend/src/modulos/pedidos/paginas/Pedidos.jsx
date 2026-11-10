import { useCallback, useEffect, useRef, useState } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarClientes } from '../../clientes/clientes.api.js'
import { listarPedidos, actualizarEstadoPedido } from '../pedidos.api.js'
import {
  ETIQUETAS_ESTADO,
  ACCIONES_ESTADO,
  tonoEstadoPedido,
  nombrePedido,
  enlaceWhatsapp,
  mensajePedidoDisponible,
} from '../pedidos.reglas.js'
import { fechaHora } from '../../servicio/servicio.reglas.js'
import { DialogoPedido } from '../componentes/DialogoPedido.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Area } from '../../../ui/Formulario.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoBuscar, IconoMas, IconoQuitar } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

const ESTADOS_FILTRO = [
  ['', 'Por resolver'],
  ['PENDIENTE', 'Pendientes'],
  ['DISPONIBLE', 'Disponibles'],
  ['ENTREGADO', 'Entregados'],
  ['CANCELADO', 'Cancelados'],
  ['TODOS', 'Todos'],
]

// RF19 — gestion de pedidos pendientes por falta de existencias.
export const Pedidos = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('VENTAS')

  const [estado, setEstado] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState(null)
  const [textoCliente, setTextoCliente] = useState('')
  const [sugerenciasCliente, setSugerenciasCliente] = useState([])
  const peticionCliente = useRef(0)

  const [abiertoAlta, setAbiertoAlta] = useState(false)
  const [cambio, setCambio] = useState(null) // { pedido, nuevoEstado }
  const [observacionCambio, setObservacionCambio] = useState('')
  const [guardandoCambio, setGuardandoCambio] = useState(false)
  const [errorCambio, setErrorCambio] = useState(null)
  const [avisoDisponible, setAvisoDisponible] = useState(null)

  const consultar = useCallback(
    (parametros) => listarPedidos({ ...parametros, texto: undefined }),
    [],
  )

  const listado = useListadoPaginado(consultar, {
    tamano: 25,
    filtros: {
      estado: estado || undefined,
      idCliente: clienteFiltro?.idCliente ?? undefined,
    },
  })

  useEffect(() => {
    const limpio = textoCliente.trim()
    if (!limpio || clienteFiltro) {
      setSugerenciasCliente([])
      return undefined
    }

    const propia = ++peticionCliente.current
    const reloj = setTimeout(async () => {
      try {
        const { datos } = await listarClientes({ texto: limpio, tamano: 6 })
        if (propia === peticionCliente.current) setSugerenciasCliente(datos)
      } catch {
        if (propia === peticionCliente.current) setSugerenciasCliente([])
      }
    }, 250)

    return () => clearTimeout(reloj)
  }, [textoCliente, clienteFiltro])

  const abrirCambio = (pedido, nuevoEstado) => {
    setCambio({ pedido, nuevoEstado })
    setObservacionCambio(pedido.observacion ?? '')
    setErrorCambio(null)
    setGuardandoCambio(false)
  }

  const confirmarCambio = async (evento) => {
    evento.preventDefault()
    if (!cambio) return

    setGuardandoCambio(true)
    setErrorCambio(null)

    try {
      const { datos: actualizado } = await actualizarEstadoPedido(cambio.pedido.idPedido, {
        estado: cambio.nuevoEstado,
        observacion: observacionCambio.trim() || null,
      })
      setCambio(null)
      if (actualizado.estado === 'DISPONIBLE') {
        setAvisoDisponible(actualizado)
      }
      listado.recargar()
    } catch (fallo) {
      setErrorCambio(fallo.message)
      setGuardandoCambio(false)
    }
  }

  const { datos: pedidos, paginacion, cargando, error } = listado
  const hayFiltros = Boolean(estado || clienteFiltro)

  return (
    <div className="grid gap-5">
      <Encabezado
        titulo="Pedidos pendientes"
        tamano="text-3xl"
        derecha={
          escritura && (
            <Boton onClick={() => setAbiertoAlta(true)}>
              <IconoMas />
              Nuevo pedido
            </Boton>
          )
        }
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          {ESTADOS_FILTRO.map(([valor, texto]) => (
            <button
              key={valor || 'activos'}
              type="button"
              onClick={() => setEstado(valor)}
              aria-pressed={estado === valor}
              className={`h-10 border-2 px-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
                estado === valor
                  ? 'border-escarlata bg-escarlata/15 text-crema'
                  : 'border-crema/25 text-crema/70 hover:border-crema/60 hover:text-crema'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        <div className="relative min-w-64">
          {clienteFiltro ? (
            <div className="flex h-10 items-center justify-between gap-2 border-2 border-tinta bg-crema px-3 text-sm font-semibold text-tinta">
              <span className="truncate">{clienteFiltro.persona.apellidoNombre}</span>
              <button
                type="button"
                onClick={() => {
                  setClienteFiltro(null)
                  setTextoCliente('')
                }}
                aria-label="Quitar filtro de cliente"
                className="text-tinta/60 hover:text-escarlata"
              >
                <IconoQuitar className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <label htmlFor="filtrar-cliente-pedido" className="sr-only">
                Filtrar por cliente
              </label>
              <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-tinta/45" />
              <input
                id="filtrar-cliente-pedido"
                type="search"
                value={textoCliente}
                onChange={(evento) => setTextoCliente(evento.target.value)}
                placeholder="Filtrar por cliente…"
                className="h-10 w-full rounded-[3px] border-2 border-tinta bg-crema pl-9 pr-3 text-sm text-tinta placeholder:text-tinta/45"
              />
              {sugerenciasCliente.length > 0 && (
                <ul className="absolute right-0 top-full z-20 mt-1 max-h-56 w-full overflow-y-auto border-2 border-tinta bg-crema text-tinta shadow-[4px_4px_0_#000]">
                  {sugerenciasCliente.map((c) => (
                    <li key={c.idCliente} className="border-b border-tinta/15 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => {
                          setClienteFiltro(c)
                          setSugerenciasCliente([])
                        }}
                        className="block w-full px-3 py-2 text-left text-sm hover:bg-ambar/35"
                      >
                        <span className="block font-semibold">{c.persona.apellidoNombre}</span>
                        {c.persona.telefonoWhatsapp && (
                          <span className="numeral text-xs text-tinta/60">{c.persona.telefonoWhatsapp}</span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </div>

      {avisoDisponible && (
        <Aviso tono="bien">
          <span>
            <strong>{nombrePedido(avisoDisponible)}</strong> quedó disponible para{' '}
            <strong>{avisoDisponible.cliente?.apellidoNombre}</strong>.{' '}
          </span>
          {enlaceWhatsapp(
            avisoDisponible.cliente?.telefonoWhatsapp,
            mensajePedidoDisponible(avisoDisponible),
          ) ? (
            <a
              href={enlaceWhatsapp(
                avisoDisponible.cliente?.telefonoWhatsapp,
                mensajePedidoDisponible(avisoDisponible),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline"
            >
              Avisar por WhatsApp ({avisoDisponible.cliente.telefonoWhatsapp})
            </a>
          ) : (
            <span className="text-crema/75">El cliente no tiene WhatsApp cargado.</span>
          )}
        </Aviso>
      )}

      {error && <Fallo error={error} reintentar={listado.recargar} />}
      {!error && cargando && pedidos.length === 0 && (
        <Cargando filas={4} etiqueta="Buscando pedidos pendientes" />
      )}

      {!error && !cargando && pedidos.length === 0 && (
        <Vacio
          titulo={hayFiltros ? 'No hay pedidos con ese filtro' : 'No hay pedidos pendientes'}
          detalle={
            hayFiltros
              ? 'Probá viendo los resueltos o quitando el filtro de cliente.'
              : 'Cuando falte stock de algo que busca un cliente, registralo acá para avisarle apenas llegue.'
          }
          accion={
            hayFiltros ? (
              <Boton tono="papel" onClick={() => { setEstado(''); setClienteFiltro(null); setTextoCliente('') }}>
                Ver los activos
              </Boton>
            ) : (
              escritura && <Boton onClick={() => setAbiertoAlta(true)}>Registrar el primero</Boton>
            )
          }
        />
      )}

      {pedidos.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {pedidos.map((pedido) => {
              const wa = pedido.estado === 'DISPONIBLE'
                ? enlaceWhatsapp(pedido.cliente?.telefonoWhatsapp, mensajePedidoDisponible(pedido))
                : null

              return (
                <Fila
                  key={pedido.idPedido}
                  atenuado={pedido.esFinal}
                  principal={
                    <>
                      <span>{nombrePedido(pedido)}</span>
                      <span className="numeral ms-2 text-ambar">× {pedido.cantidad}</span>
                    </>
                  }
                  secundario={[
                    pedido.cliente?.apellidoNombre,
                    `pedido ${fechaHora(pedido.fechaSolicitud)}`,
                    pedido.fechaResolucion && `resuelto ${fechaHora(pedido.fechaResolucion)}`,
                    pedido.observacion,
                  ].filter(Boolean).join(' · ')}
                  derecha={
                    <span className="flex flex-wrap items-center justify-end gap-2">
                      {wa && (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="border-2 border-ambar px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-ambar hover:bg-ambar hover:text-tinta"
                        >
                          WhatsApp
                        </a>
                      )}
                      <Marca tono={tonoEstadoPedido(pedido.estado)}>
                        {ETIQUETAS_ESTADO[pedido.estado] ?? pedido.estado}
                      </Marca>
                    </span>
                  }
                  acciones={
                    escritura && !pedido.esFinal && (
                      <div className="flex flex-wrap gap-1.5">
                        {pedido.siguientesEstados.map((destino) => (
                          <Boton
                            key={destino}
                            tono={destino === 'CANCELADO' ? 'desnudo' : 'papel'}
                            tamano="chico"
                            onClick={() => abrirCambio(pedido, destino)}
                          >
                            {ACCIONES_ESTADO[destino] ?? destino}
                          </Boton>
                        ))}
                      </div>
                    )
                  }
                />
              )
            })}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <DialogoPedido
        abierto={abiertoAlta}
        alCerrar={() => setAbiertoAlta(false)}
        alGuardar={() => listado.recargar()}
      />

      <Dialogo
        abierto={cambio !== null}
        alCerrar={() => setCambio(null)}
        titulo={cambio ? ACCIONES_ESTADO[cambio.nuevoEstado] : ''}
        descripcion={
          cambio
            ? `${nombrePedido(cambio.pedido)} (×${cambio.pedido.cantidad}) para ${cambio.pedido.cliente?.apellidoNombre ?? ''}.`
            : ''
        }
        ancho="max-w-md"
        pie={
          <div className="flex justify-end gap-3">
            <Boton tono="desnudo" onClick={() => setCambio(null)} disabled={guardandoCambio}>
              Cancelar
            </Boton>
            <Boton form="form-cambio-pedido" type="submit" cargando={guardandoCambio}>
              Confirmar
            </Boton>
          </div>
        }
      >
        <form id="form-cambio-pedido" onSubmit={confirmarCambio} className="grid gap-3">
          <Area
            etiqueta="Observación (opcional)"
            value={observacionCambio}
            onChange={(evento) => setObservacionCambio(evento.target.value)}
            maxLength={300}
            disabled={guardandoCambio}
          />
          {errorCambio && <Aviso tono="mal">{errorCambio}</Aviso>}
        </form>
      </Dialogo>
    </div>
  )
}

