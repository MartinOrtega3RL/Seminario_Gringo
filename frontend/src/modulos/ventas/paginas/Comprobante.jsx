import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router'
import { buscarVenta, rutaComprobante } from '../ventas.api.js'
import { abrirDocumento } from '../../../api/cliente.js'
import { Boton } from '../../../ui/Boton.jsx'
import { Filete, Precio } from '../../../ui/Panel.jsx'
import { Cargando, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoImprimir, IconoVenta } from '../../../ui/Iconos.jsx'

// Pantalla de confirmacion, no el comprobante en si. El documento lo emite el
// backend a traves de su interfaz (S05 anuncia que algun dia sera fiscal), y
// mantenerlo en un solo lugar evita que existan dos comprobantes distintos.

export const Comprobante = () => {
  const { idVenta } = useParams()
  const [venta, setVenta] = useState(null)
  const [error, setError] = useState(null)
  const [errorDocumento, setErrorDocumento] = useState(null)
  const primerBoton = useRef(null)

  const imprimir = async () => {
    setErrorDocumento(null)
    try {
      await abrirDocumento(rutaComprobante(venta.idVenta))
    } catch (fallo) {
      setErrorDocumento(fallo.message)
    }
  }

  useEffect(() => {
    let vigente = true
    buscarVenta(idVenta)
      .then(({ datos }) => vigente && setVenta(datos))
      .catch((fallo) => vigente && setError(fallo))
    return () => {
      vigente = false
    }
  }, [idVenta])

  // El foco viaja al boton principal: quien viene de confirmar con el teclado
  // sigue con el teclado.
  useEffect(() => {
    if (venta) primerBoton.current?.focus()
  }, [venta])

  if (error) return <Fallo error={error} />
  if (!venta) return <Cargando filas={3} etiqueta="Buscando la venta" />

  const total = Number(venta.montoTotal) + Number(venta.recargoFinanciacion ?? 0)

  return (
    <div className="mx-auto max-w-xl">
      {/* Cartel de operacion registrada. La chapa amarilla es la misma del
          ingreso: es el mismo sistema, no una pantalla aparte. */}
      <div className="-rotate-1 border-[3px] border-tinta bg-ambar px-6 py-5 shadow-[6px_6px_0_var(--color-azul-hondo)]">
        <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-tinta/70">
          Venta registrada
        </p>
        <p className="numeral mt-1 font-[family-name:var(--font-cartel)] text-3xl uppercase leading-none tracking-tight text-tinta">
          {venta.numeroComprobante}
        </p>
        <Filete className="mt-3" />
        <p className="mt-2 text-xs font-semibold text-tinta/70">
          Lista {venta.listaPrecioAplicada.toLowerCase()} ·{' '}
          {venta.pago?.medioPago?.nombre ?? 'Sin medio de pago'}
        </p>
      </div>

      <div className="mt-6 border-2 border-black bg-azul-hondo">
        <ul className="divide-y-2 divide-crema/12">
          {venta.detalle.map((linea) => (
            <li key={linea.idDetalle} className="flex items-baseline justify-between gap-4 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm text-crema">
                  {linea.producto?.denominacion}
                </span>
                <span className="numeral text-xs text-crema/55">
                  {linea.cantidad} ×{' '}
                  {Number(linea.precioUnitario).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </span>
              <span className="numeral shrink-0 text-sm font-semibold text-crema">
                $
                {(Number(linea.precioUnitario) * linea.cantidad).toLocaleString('es-AR', {
                  minimumFractionDigits: 2,
                })}
              </span>
            </li>
          ))}
        </ul>

        <div className="flex items-end justify-between gap-4 border-t-2 border-dashed border-crema/25 px-4 py-4">
          <span className="pb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-crema/70">
            Total
          </span>
          <Precio monto={total} tamano="text-[40px]" className="leading-[0.85]" />
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Boton
          ref={primerBoton}
          tamano="normal"
          onClick={imprimir}
        >
          <IconoImprimir />
          Imprimir comprobante
        </Boton>

        <Link
          to="/venta"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border-2 border-crema/35 px-5 text-sm font-semibold uppercase tracking-wide text-crema hover:border-crema hover:bg-crema/10"
        >
          <IconoVenta />
          Otra venta
        </Link>
      </div>

      {errorDocumento && (
        <div className="mt-4">
          <Aviso tono="mal">{errorDocumento}</Aviso>
        </div>
      )}

      <p className="mt-4 text-center text-xs text-crema/50">
        El comprobante se abre en una pestaña nueva, listo para imprimir en A4.
      </p>
    </div>
  )
}
