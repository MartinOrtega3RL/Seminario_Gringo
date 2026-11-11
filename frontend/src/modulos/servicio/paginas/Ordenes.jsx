import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarOrdenes, rutaOrden } from '../servicio.api.js'
import { abrirDocumento } from '../../../api/cliente.js'
import { nombreEquipo, nombreEstado, tonoDeEstado, fechaCorta, hoyIso, haceDiasIso } from '../servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoBuscar, IconoImprimir, IconoMas, IconoCampana } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF25.1 — consultar y filtrar las órdenes por estado, cliente o período.
// RF23.2 — identificar las que superaron el plazo de retiro.
//
// Es la pantalla del técnico: lo primero que ve al entrar es qué hay en el
// taller y en qué punto está cada equipo.

const FILTRO = 'h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta'
const ROTULO = 'mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60'

const PERIODOS = [
  ['Todo', () => ['', '']],
  ['Hoy', () => [hoyIso(), hoyIso()]],
  ['7 días', () => [haceDiasIso(7), hoyIso()]],
  ['30 días', () => [haceDiasIso(30), hoyIso()]],
]

const resumirFalla = (texto) => (texto.length > 70 ? `${texto.slice(0, 70).trimEnd()}…` : texto)

export const Ordenes = () => {
  const { puedeEscribir } = useSesion()
  const navegar = useNavigate()
  const escritura = puedeEscribir('SERVICIO_TECNICO')

  const [estado, setEstado] = useState('')
  const [soloNoRetiradas, setSoloNoRetiradas] = useState(false)
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [errorDocumento, setErrorDocumento] = useState(null)

  const listado = useListadoPaginado(listarOrdenes, {
    tamano: 20,
    filtros: {
      estado: estado || undefined,
      soloNoRetiradas: soloNoRetiradas || undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
    },
  })

  const { datos: ordenes, paginacion, resumen, cargando, error } = listado
  const hayFiltros = Boolean(estado || soloNoRetiradas || desde || hasta || listado.texto)

  const limpiar = () => {
    setEstado('')
    setSoloNoRetiradas(false)
    setDesde('')
    setHasta('')
    listado.escribir('')
  }

  const imprimir = async (idOrden) => {
    setErrorDocumento(null)
    try {
      await abrirDocumento(rutaOrden(idOrden))
    } catch (fallo) {
      setErrorDocumento(fallo.message)
    }
  }

  const total = resumen?.porEstado.reduce((suma, fila) => suma + fila.cantidad, 0) ?? 0

  return (
    <div className="grid gap-5">
      <Encabezado
        titulo="Servicio técnico"
        tamano="text-3xl"
        derecha={
          escritura && (
            <Boton onClick={() => navegar('/servicio/nueva')}>
              <IconoMas />
              Recibir equipo
            </Boton>
          )
        }
      />

      {/* RF23.2 — es lo único de la pantalla que pide una decisión del
          comercio: un equipo que el cliente no retira corre con recargo. */}
      {resumen?.noRetiradas > 0 && (
        <button
          type="button"
          onClick={() => {
            setSoloNoRetiradas(!soloNoRetiradas)
            setEstado('')
          }}
          aria-pressed={soloNoRetiradas}
          className={`flex w-full items-center gap-3 border-2 px-4 py-3 text-left transition-colors ${
            soloNoRetiradas ? 'border-escarlata bg-escarlata/20' : 'border-escarlata/60 bg-escarlata/10 hover:bg-escarlata/15'
          }`}
        >
          <IconoCampana className="size-5 shrink-0 text-escarlata" />
          <span className="min-w-0 flex-1 text-sm text-crema">
            <strong className="font-semibold">
              {resumen.noRetiradas === 1
                ? '1 equipo lleva'
                : `${resumen.noRetiradas} equipos llevan`}{' '}
              más de {resumen.plazoRetiroDias} días sin retirar.
            </strong>{' '}
            <span className="text-crema/70">Corre el recargo por demora.</span>
          </span>
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-crema/70">
            {soloNoRetiradas ? 'Ver todas' : 'Ver cuáles'}
          </span>
        </button>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-64 flex-1">
          <label htmlFor="buscar-ordenes" className="sr-only">
            Buscar por número de orden, cliente, WhatsApp o IMEI
          </label>
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
          <input
            id="buscar-ordenes"
            type="search"
            value={listado.texto}
            onChange={(evento) => listado.escribir(evento.target.value)}
            placeholder="Orden, cliente, WhatsApp o IMEI…"
            className="h-12 w-full max-w-xl rounded-[3px] border-2 border-tinta bg-crema pl-11 pr-3 text-base text-tinta shadow-[4px_4px_0_var(--color-azul-hondo)] placeholder:text-tinta/40"
          />
        </div>

        <div>
          <label htmlFor="orden-desde" className={ROTULO}>Ingresó desde</label>
          <input id="orden-desde" type="date" value={desde} max={hasta || hoyIso()} onChange={(e) => setDesde(e.target.value)} className={FILTRO} />
        </div>
        <div>
          <label htmlFor="orden-hasta" className={ROTULO}>Hasta</label>
          <input id="orden-hasta" type="date" value={hasta} min={desde} max={hoyIso()} onChange={(e) => setHasta(e.target.value)} className={FILTRO} />
        </div>

        <div className="flex gap-1.5 pb-0.5">
          {PERIODOS.map(([texto, calcular]) => {
            const [d, h] = calcular()
            const activo = desde === d && hasta === h
            return (
              <button
                key={texto}
                type="button"
                onClick={() => { setDesde(d); setHasta(h) }}
                className={`h-10 border-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                  activo
                    ? 'border-escarlata bg-escarlata/15 text-crema'
                    : 'border-crema/25 text-crema/70 hover:border-crema/60 hover:text-crema'
                }`}
              >
                {texto}
              </button>
            )
          })}
        </div>
      </div>

      {/* Una marca por estado, con cuantas hay: es el tablero del taller. */}
      {resumen && (
        <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-1.5">
          <ChipEstado activo={!estado} onClick={() => setEstado('')} texto="Todas" cantidad={total} />
          {resumen.porEstado
            .filter((fila) => fila.cantidad > 0 || fila.codigo === estado)
            .map((fila) => (
              <ChipEstado
                key={fila.codigo}
                activo={estado === fila.codigo}
                onClick={() => { setEstado(estado === fila.codigo ? '' : fila.codigo); setSoloNoRetiradas(false) }}
                texto={nombreEstado(fila)}
                cantidad={fila.cantidad}
              />
            ))}
        </div>
      )}

      {errorDocumento && <Aviso tono="mal">{errorDocumento}</Aviso>}
      {error && <Fallo error={error} reintentar={listado.recargar} />}

      {!error && cargando && ordenes.length === 0 && <Cargando filas={5} etiqueta="Buscando órdenes" />}

      {!error && !cargando && ordenes.length === 0 && (
        <Vacio
          titulo={hayFiltros ? 'Ninguna orden coincide' : 'Todavía no hay órdenes de servicio'}
          detalle={
            hayFiltros
              ? 'Probá con menos filtros, o buscá por el IMEI del equipo.'
              : 'Cada equipo que llega al taller se recibe acá y queda con su número de orden.'
          }
          accion={
            hayFiltros ? (
              <Boton tono="papel" onClick={limpiar}>Quitar los filtros</Boton>
            ) : (
              escritura && <Boton onClick={() => navegar('/servicio/nueva')}>Recibir el primer equipo</Boton>
            )
          }
        />
      )}

      {ordenes.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {ordenes.map((orden) => {
              const final = orden.estado.esFinal
              const falla = resumirFalla(orden.fallaDeclarada)

              return (
                <Fila
                  key={orden.idOrden}
                  atenuado={final}
                  alAbrir={() => navegar(`/servicio/${orden.idOrden}`)}
                  principal={
                    <>
                      <span className="numeral">{orden.numeroOrden}</span>
                      <span className="ms-2 font-normal text-crema/70">
                        {orden.cliente.persona.apellidoNombre}
                      </span>
                    </>
                  }
                  secundario={[
                    nombreEquipo(orden.dispositivo),
                    orden.dispositivo.imeiSerie ?? 'sin IMEI',
                    `ingresó ${fechaCorta(orden.fechaIngreso)}`,
                    falla,
                  ].join(' · ')}
                  derecha={
                    <span className="flex items-center gap-2">
                      {orden.idOrdenAnterior && <Marca>Reingreso</Marca>}
                      <Marca tono={tonoDeEstado(orden.estado.codigo, orden.noRetirada)}>
                        {orden.noRetirada ? 'Sin retirar' : nombreEstado(orden.estado)}
                      </Marca>
                    </span>
                  }
                  acciones={
                    <AccionFila etiqueta="Imprimir la orden" onClick={() => imprimir(orden.idOrden)}>
                      <IconoImprimir className="size-4" />
                    </AccionFila>
                  }
                />
              )
            })}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}
    </div>
  )
}

const ChipEstado = ({ activo, onClick, texto, cantidad }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activo}
    className={`inline-flex h-9 items-center gap-2 border-2 px-3 text-xs font-semibold uppercase tracking-wide transition-colors ${
      activo
        ? 'border-escarlata bg-escarlata/15 text-crema'
        : 'border-crema/25 text-crema/70 hover:border-crema/60 hover:text-crema'
    }`}
  >
    {texto}
    <span className="numeral text-crema/55">{cantidad}</span>
  </button>
)
