import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { buscarCliente, listarClientes } from '../../clientes/clientes.api.js'
import { cobrarCuota, listarCuotas, listarMediosPago } from '../ventas.api.js'
import { formatearFechaCuota } from '../cuotas.reglas.js'
import { enlaceWhatsapp } from '../../pedidos/pedidos.reglas.js'
import { pesos } from '../../servicio/servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoBuscar, IconoQuitar } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

const ESTADOS = [
  ['POR_COBRAR', 'Por cobrar'],
  ['VENCIDA', 'Vencidas'],
  ['PENDIENTE', 'Pendientes'],
  ['COBRADA', 'Cobradas'],
  ['TODAS', 'Todas'],
]

const TONO_ESTADO = {
  VENCIDA: 'alerta',
  PENDIENTE: 'destacado',
  COBRADA: 'neutro',
}

const TarjetaResumen = ({ rotulo, valor, destacado = false }) => (
  <div className="border-2 border-black bg-azul-hondo p-4">
    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">{rotulo}</p>
    <p
      className={`numeral mt-2 font-[family-name:var(--font-cartel)] text-3xl leading-none ${
        destacado ? 'text-escarlata' : 'text-crema'
      }`}
    >
      {valor}
    </p>
  </div>
)

// RF20.2 y RF20.3 — gestion de cartera de cuotas de financiacion propia.
export const Cuotas = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('VENTAS')
  const [parametrosUrl, setParametrosUrl] = useSearchParams()
  const idClienteInicial = Number(parametrosUrl.get('idCliente')) || null

  const [estado, setEstado] = useState('POR_COBRAR')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [clienteFiltro, setClienteFiltro] = useState(
    idClienteInicial ? { idCliente: idClienteInicial, apellidoNombre: `Cliente #${idClienteInicial}` } : null,
  )
  const [textoCliente, setTextoCliente] = useState('')
  const [sugerenciasCliente, setSugerenciasCliente] = useState([])
  const peticionCliente = useRef(0)

  const [mediosPago, setMediosPago] = useState([])
  const [cobro, setCobro] = useState(null)
  const [idMedioPago, setIdMedioPago] = useState('')
  const [cobrando, setCobrando] = useState(false)
  const [errorCobro, setErrorCobro] = useState(null)
  const [avisoCobro, setAvisoCobro] = useState(null)

  useEffect(() => {
    if (!idClienteInicial) return
    buscarCliente(idClienteInicial)
      .then(({ datos }) => {
        if (datos) setClienteFiltro(datos)
      })
      .catch(() => {})
  }, [idClienteInicial])

  useEffect(() => {
    listarMediosPago()
      .then(({ datos }) => {
        setMediosPago(datos ?? [])
        if (datos?.[0]) setIdMedioPago(String(datos[0].idMedioPago))
      })
      .catch(() => setMediosPago([]))
  }, [])

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

  const consultar = useCallback(
    (parametros) => listarCuotas({ ...parametros, texto: undefined }),
    [],
  )

  const listado = useListadoPaginado(consultar, {
    tamano: 25,
    filtros: {
      estado,
      idCliente: clienteFiltro?.idCliente ?? undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
    },
  })

  const seleccionarCliente = (cliente) => {
    setClienteFiltro(cliente)
    setTextoCliente('')
    setSugerenciasCliente([])
  }

  const quitarCliente = () => {
    setClienteFiltro(null)
    if (parametrosUrl.has('idCliente')) {
      const nuevos = new URLSearchParams(parametrosUrl)
      nuevos.delete('idCliente')
      setParametrosUrl(nuevos, { replace: true })
    }
  }

  const abrirCobro = (cuota) => {
    setCobro(cuota)
    setErrorCobro(null)
    setCobrando(false)
    if (!idMedioPago && mediosPago[0]) setIdMedioPago(String(mediosPago[0].idMedioPago))
  }

  const confirmarCobro = async (evento) => {
    evento.preventDefault()
    if (!cobro || !idMedioPago) return

    setCobrando(true)
    setErrorCobro(null)

    try {
      await cobrarCuota(cobro.idCuota, Number(idMedioPago))
      setAvisoCobro(
        `Se registró el cobro de la cuota ${cobro.numeroCuota}/${cobro.venta.cantidadCuotas} de ${cobro.cliente.apellidoNombre}.`,
      )
      setCobro(null)
      listado.recargar()
    } catch (fallo) {
      setErrorCobro(fallo.message)
      setCobrando(false)
    }
  }

  const resumen = listado.resumen ?? { saldoAdeudado: 0, saldoVencido: 0, clientesConDeuda: 0 }
  const cuotas = listado.datos

  return (
    <div className="grid gap-6">
      <Encabezado
        titulo="Cuotas y financiación"
        bajada="Plan de cuotas propias, vencimientos, atrasos y registro de cobros."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <TarjetaResumen rotulo="Saldo adeudado" valor={`$${pesos(resumen.saldoAdeudado)}`} />
        <TarjetaResumen
          rotulo="Saldo vencido"
          valor={`$${pesos(resumen.saldoVencido)}`}
          destacado={resumen.saldoVencido > 0}
        />
        <TarjetaResumen rotulo="Clientes con deuda" valor={String(resumen.clientesConDeuda)} />
      </div>

      {avisoCobro && <Aviso tono="bien">{avisoCobro}</Aviso>}

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {ESTADOS.map(([valor, etiqueta]) => {
            const activo = estado === valor
            return (
              <button
                key={valor}
                type="button"
                onClick={() => setEstado(valor)}
                className={`border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                  activo
                    ? 'border-black bg-ambar text-tinta shadow-[2px_2px_0_0_#0B1220]'
                    : 'border-crema/25 bg-azul-hondo text-crema/75 hover:border-crema/50'
                }`}
              >
                {etiqueta}
              </button>
            )
          })}
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
          <div className="relative">
            {clienteFiltro ? (
              <div className="flex h-11 items-center justify-between gap-2 border-2 border-ambar/50 bg-azul-hondo px-3 text-sm text-crema">
                <span className="truncate font-semibold">
                  Cliente: {clienteFiltro.apellidoNombre}
                </span>
                <button
                  type="button"
                  onClick={quitarCliente}
                  aria-label="Quitar filtro de cliente"
                  className="text-crema/60 hover:text-ambar"
                >
                  <IconoQuitar className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div>
                <div className="relative">
                  <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta/45" />
                  <input
                    type="search"
                    value={textoCliente}
                    onChange={(evento) => setTextoCliente(evento.target.value)}
                    placeholder="Filtrar por cliente"
                    aria-label="Filtrar por cliente"
                    className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema pl-9 pr-3 text-sm text-tinta"
                  />
                </div>
                {sugerenciasCliente.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full border-2 border-black bg-azul-hondo shadow-lg">
                    {sugerenciasCliente.map((c) => (
                      <li key={c.idCliente} className="border-b border-crema/10 last:border-0">
                        <button
                          type="button"
                          onClick={() => seleccionarCliente(c)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-crema hover:bg-crema/10"
                        >
                          <span className="font-semibold">{c.apellidoNombre}</span>
                          <span className="text-crema/60">{c.telefonoWhatsapp}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cuotas-desde" className="text-xs font-semibold uppercase text-crema/65">
              Venc. desde
            </label>
            <input
              id="cuotas-desde"
              type="date"
              value={desde}
              onChange={(evento) => setDesde(evento.target.value)}
              className="h-11 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm text-tinta"
            />
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="cuotas-hasta" className="text-xs font-semibold uppercase text-crema/65">
              Hasta
            </label>
            <input
              id="cuotas-hasta"
              type="date"
              value={hasta}
              onChange={(evento) => setHasta(evento.target.value)}
              className="h-11 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm text-tinta"
            />
          </div>
        </div>
      </div>

      {listado.error && <Fallo error={listado.error} reintentar={listado.recargar} />}

      {!listado.error && listado.cargando && cuotas.length === 0 && (
        <Cargando filas={6} etiqueta="Cargando cuotas" />
      )}

      {!listado.error && !listado.cargando && cuotas.length === 0 && (
        <Vacio
          titulo="No hay cuotas para mostrar"
          detalle="Probá cambiando el filtro de estado, cliente o fechas."
        />
      )}

      {cuotas.length > 0 && (
        <>
          <Listado>
            {cuotas.map((cuota) => {
              const pendiente = cuota.estado !== 'COBRADA'
              const whatsapp = pendiente
                ? enlaceWhatsapp(
                    cuota.cliente.telefonoWhatsapp,
                    `Hola ${cuota.cliente.apellidoNombre}, te recordamos la cuota ${cuota.numeroCuota}/${cuota.venta.cantidadCuotas} por $${pesos(cuota.importe)} (venta ${cuota.venta.numeroComprobante}, vencimiento ${formatearFechaCuota(cuota.fechaVencimiento)}).`,
                  )
                : null

              const detalleSecundario = [
                `Venta ${cuota.venta.numeroComprobante}`,
                `Cuota ${cuota.numeroCuota}/${cuota.venta.cantidadCuotas}`,
                `Vence ${formatearFechaCuota(cuota.fechaVencimiento)}`,
                cuota.fechaCobro
                  ? `Cobrada el ${formatearFechaCuota(cuota.fechaCobro)}${cuota.medioPago ? ` (${cuota.medioPago})` : ''}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <Fila
                  key={cuota.idCuota}
                  atenuado={!pendiente}
                  principal={
                    <span className="inline-flex flex-wrap items-center gap-2">
                      <span>{cuota.cliente.apellidoNombre}</span>
                      <Marca tono={TONO_ESTADO[cuota.estado] ?? 'neutro'}>
                        {cuota.estado === 'VENCIDA'
                          ? `Vencida · ${cuota.diasAtraso} ${cuota.diasAtraso === 1 ? 'día' : 'días'}`
                          : cuota.estado === 'COBRADA'
                            ? 'Cobrada'
                            : 'Pendiente'}
                      </Marca>
                    </span>
                  }
                  secundario={detalleSecundario}
                  derecha={
                    <span className="numeral font-[family-name:var(--font-cartel)] text-xl text-ambar">
                      ${pesos(cuota.importe)}
                    </span>
                  }
                  acciones={
                    (whatsapp || (pendiente && escritura)) && (
                      <span className="flex items-center gap-2">
                        {whatsapp && (
                          <a
                            href={whatsapp}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex h-8 items-center border-2 border-crema/30 px-2.5 text-xs font-bold uppercase tracking-wider text-crema hover:border-ambar hover:text-ambar"
                          >
                            WhatsApp
                          </a>
                        )}
                        {pendiente && escritura && (
                          <Boton tamano="chico" onClick={() => abrirCobro(cuota)}>
                            Cobrar
                          </Boton>
                        )}
                      </span>
                    )
                  }
                />
              )
            })}
          </Listado>

          <Paginacion
            paginacion={listado.paginacion}
            alCambiar={listado.setPagina}
            cargando={listado.cargando}
          />
        </>
      )}

      <Dialogo
        abierto={Boolean(cobro)}
        alCerrar={() => !cobrando && setCobro(null)}
        titulo="Registrar cobro de cuota"
        descripcion={
          cobro
            ? `${cobro.cliente.apellidoNombre} · Venta ${cobro.venta.numeroComprobante} · Cuota ${cobro.numeroCuota}/${cobro.venta.cantidadCuotas}`
            : ''
        }
        pie={
          <div className="flex justify-end gap-2">
            <Boton tono="papel" type="button" disabled={cobrando} onClick={() => setCobro(null)}>
              Cancelar
            </Boton>
            <Boton type="submit" form="form-cobro-cuota" cargando={cobrando} disabled={!idMedioPago}>
              Confirmar cobro
            </Boton>
          </div>
        }
      >
        {cobro && (
          <form id="form-cobro-cuota" onSubmit={confirmarCobro} className="grid gap-4">
            <div className="border-2 border-crema/15 bg-tinta/40 p-3 text-sm">
              <div className="flex justify-between">
                <span className="text-crema/70">Importe a cobrar</span>
                <span className="numeral font-bold text-ambar">${pesos(cobro.importe)}</span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-crema/65">
                <span>Vencimiento</span>
                <span className="numeral">{formatearFechaCuota(cobro.fechaVencimiento)}</span>
              </div>
            </div>

            <div>
              <label
                htmlFor="medio-pago-cobro"
                className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
              >
                Medio de pago
              </label>
              <select
                id="medio-pago-cobro"
                value={idMedioPago}
                onChange={(evento) => setIdMedioPago(evento.target.value)}
                disabled={cobrando || mediosPago.length === 0}
                className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-sm font-semibold text-tinta"
              >
                {mediosPago.map((m) => (
                  <option key={m.idMedioPago} value={m.idMedioPago}>
                    {m.nombre}
                  </option>
                ))}
              </select>
            </div>

            <p className="text-xs text-crema/60">
              Las cuotas de un mismo plan se cobran en orden cronológico, empezando por la más antigua impaga.
            </p>

            {errorCobro && <Aviso tono="mal">{errorCobro}</Aviso>}
          </form>
        )}
      </Dialogo>
    </div>
  )
}
