import { useState } from 'react'
import { Link } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarVentas, anularVenta, rutaComprobante } from '../ventas.api.js'
import { abrirDocumento } from '../../../api/cliente.js'
import { DialogoAnulacion } from '../componentes/DialogoAnulacion.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoImprimir, IconoQuitar, IconoVenta } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF18.1 — historial con filtros por período y por cliente.
// RF18.2 — anulación.

const MODALIDADES = {
  CONTADO: 'Contado',
  FINANCIACION_PROPIA: 'Financiación del comercio',
  TARJETA_CUOTAS: 'Tarjeta en cuotas',
  GO_CUOTAS: 'Go Cuotas',
}

const FILTRO = 'h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta'

const hoy = () => new Date().toISOString().slice(0, 10)
const haceDias = (dias) => new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)

export const HistorialVentas = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('VENTAS')

  const [desde, setDesde] = useState(haceDias(30))
  const [hasta, setHasta] = useState(hoy())
  const [estado, setEstado] = useState('')

  const listado = useListadoPaginado(listarVentas, {
    tamano: 25,
    filtros: { desde, hasta, estado: estado || undefined },
  })

  const [anulando, setAnulando] = useState(null)
  const [errorDocumento, setErrorDocumento] = useState(null)

  const verComprobante = async (idVenta) => {
    setErrorDocumento(null)
    try {
      await abrirDocumento(rutaComprobante(idVenta))
    } catch (fallo) {
      setErrorDocumento(fallo.message)
    }
  }

  // Que se vendio, resumido para el renglon: el primer articulo y cuantos mas.
  // Abrir cada venta para saber que salio es lo que hace inutil un historial.
  const queSeVendio = (venta) => {
    const lineas = venta.detalle ?? []
    if (lineas.length === 0) return null

    const unidades = lineas.reduce((suma, l) => suma + l.cantidad, 0)
    const primero = lineas[0].producto?.denominacion ?? 'Producto dado de baja'
    const resto = lineas.length - 1

    return `${unidades} u. · ${primero}${resto > 0 ? ` y ${resto} más` : ''}`
  }

  const confirmarAnulacion = async (motivo) => {
    await anularVenta(anulando.idVenta, motivo)
    setAnulando(null)
    listado.recargar()
  }

  const { datos: ventas, paginacion, cargando, error } = listado

  const total = ventas
    .filter((venta) => venta.estado === 'CONFIRMADA')
    .reduce((suma, venta) => suma + Number(venta.montoTotal) + Number(venta.recargoFinanciacion ?? 0), 0)

  return (
    <div className="grid gap-5">
      <Encabezado
        titulo="Ventas"
        tamano="text-3xl"
        derecha={
          <Link
            to="/venta"
            className="inline-flex h-11 items-center gap-2 rounded-[3px] border-2 border-crema/35 px-4 text-sm font-semibold uppercase tracking-wide text-crema hover:border-crema hover:bg-crema/10"
          >
            <IconoVenta />
            Nueva venta
          </Link>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="desde" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
            Desde
          </label>
          <input id="desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} className={FILTRO} />
        </div>

        <div>
          <label htmlFor="hasta" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
            Hasta
          </label>
          <input id="hasta" type="date" value={hasta} min={desde} max={hoy()} onChange={(e) => setHasta(e.target.value)} className={FILTRO} />
        </div>

        <div>
          <label htmlFor="estado" className="mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
            Estado
          </label>
          <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={FILTRO}>
            <option value="">Todas</option>
            <option value="CONFIRMADA">Confirmadas</option>
            <option value="ANULADA">Anuladas</option>
          </select>
        </div>

        <div className="flex gap-1.5 pb-0.5">
          {[
            ['Hoy', hoy()],
            ['7 días', haceDias(7)],
            ['30 días', haceDias(30)],
          ].map(([texto, valor]) => (
            <button
              key={texto}
              type="button"
              onClick={() => {
                setDesde(valor)
                setHasta(hoy())
              }}
              className={`h-10 border-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                desde === valor && hasta === hoy()
                  ? 'border-escarlata bg-escarlata/15 text-crema'
                  : 'border-crema/25 text-crema/70 hover:border-crema/60 hover:text-crema'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </div>

      {/* El total del período va arriba y en ámbar, como cualquier otro total
          del sistema: es el número que se busca al abrir esta pantalla. */}
      {ventas.length > 0 && (
        <div className="flex items-baseline justify-between gap-4 border-y-2 border-crema/15 py-3">
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-crema/65">
            Confirmado en el período
          </span>
          <span className="numeral font-[family-name:var(--font-cartel)] text-[32px] leading-none text-ambar">
            <span className="align-[0.3em] text-[0.45em] font-normal opacity-75">$</span>
            {total.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
          </span>
        </div>
      )}

      {errorDocumento && <Aviso tono="mal">{errorDocumento}</Aviso>}

      {error && <Fallo error={error} reintentar={listado.recargar} />}

      {!error && cargando && ventas.length === 0 && <Cargando filas={5} etiqueta="Buscando ventas" />}

      {!error && !cargando && ventas.length === 0 && (
        <Vacio
          titulo="No hay ventas en ese período"
          detalle="Probá ampliando las fechas, o revisá si el filtro de estado está dejando algo afuera."
          accion={
            <Boton tono="papel" onClick={() => { setDesde(haceDias(30)); setHasta(hoy()); setEstado('') }}>
              Ver los últimos 30 días
            </Boton>
          }
        />
      )}

      {ventas.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {ventas.map((venta) => {
              const anulada = venta.estado === 'ANULADA'

              return (
                <Fila
                  key={venta.idVenta}
                  atenuado={anulada}
                  principal={
                    <>
                      <span className="numeral">{venta.numeroComprobante}</span>
                      <span className="ms-2 font-normal text-crema/70">
                        {venta.cliente?.persona?.apellidoNombre ?? 'Consumidor final'}
                      </span>
                    </>
                  }
                  secundario={
                    [
                      queSeVendio(venta),
                      new Date(venta.fechaHora).toLocaleString('es-AR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      }),
                      venta.vendedor?.nombreUsuario,
                      MODALIDADES[venta.modalidadPago] +
                        (venta.cantidadCuotas ? ` en ${venta.cantidadCuotas}` : ''),
                      venta.pago?.medioPago?.nombre,
                      anulada && venta.motivoAnulacion,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  }
                  derecha={
                    <span className="flex items-center gap-3">
                      {anulada && <Marca tono="alerta">Anulada</Marca>}
                      {venta.listaPrecioAplicada === 'MAYORISTA' && <Marca tono="destacado">Mayorista</Marca>}
                      <span
                        className={`numeral text-base font-bold ${anulada ? 'text-crema/40 line-through' : 'text-ambar'}`}
                      >
                        $
                        {(Number(venta.montoTotal) + Number(venta.recargoFinanciacion ?? 0)).toLocaleString(
                          'es-AR',
                          { minimumFractionDigits: 2 },
                        )}
                      </span>
                    </span>
                  }
                  acciones={
                    <>
                      <AccionFila
                        etiqueta="Ver comprobante"
                        onClick={() => verComprobante(venta.idVenta)}
                      >
                        <IconoImprimir className="size-4" />
                      </AccionFila>
                      {escritura && (
                        <AccionFila
                          etiqueta={anulada ? 'Ya está anulada' : 'Anular'}
                          peligrosa
                          disabled={anulada}
                          onClick={() => setAnulando(venta)}
                        >
                          <IconoQuitar className="size-4" />
                        </AccionFila>
                      )}
                    </>
                  }
                />
              )
            })}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <DialogoAnulacion
        abierto={anulando !== null}
        venta={anulando}
        alCerrar={() => setAnulando(null)}
        alAnular={confirmarAnulacion}
      />
    </div>
  )
}
