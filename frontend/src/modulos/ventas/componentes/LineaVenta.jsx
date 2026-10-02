import { IconoMas, IconoMenos, IconoQuitar } from '../../../ui/Iconos.jsx'
import { aPesos } from '../ganchos/useVenta.js'

const PASO = [
  'grid size-8 place-items-center border-2 border-crema/35 text-crema',
  'hover:border-crema hover:bg-crema/10',
  'disabled:opacity-30 disabled:hover:border-crema/35 disabled:hover:bg-transparent',
].join(' ')

export const LineaVenta = ({ linea, alCambiar, alQuitar }) => {
  const subtotal = Math.round(Number(linea.precioUnitario) * 100) * linea.cantidad
  const enElTope = linea.cantidad >= linea.disponible

  return (
    <li className="border-b-2 border-crema/12 px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-snug text-crema">
            {linea.denominacion}
          </p>
          <p className="numeral mt-0.5 text-xs text-crema/55">{linea.codigoInterno}</p>
        </div>

        <button
          type="button"
          onClick={() => alQuitar(linea.idProducto)}
          aria-label={`Quitar ${linea.denominacion} de la venta`}
          className="shrink-0 p-1 text-crema/45 hover:text-escarlata"
        >
          <IconoQuitar className="size-4" />
        </button>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className={PASO}
            onClick={() => alCambiar(linea.idProducto, linea.cantidad - 1)}
            aria-label={`Quitar una unidad de ${linea.denominacion}`}
          >
            <IconoMenos className="size-4" />
          </button>

          <label className="sr-only" htmlFor={`cantidad-${linea.idProducto}`}>
            Cantidad de {linea.denominacion}
          </label>
          <input
            id={`cantidad-${linea.idProducto}`}
            type="number"
            min="1"
            max={linea.disponible}
            value={linea.cantidad}
            onChange={(evento) => alCambiar(linea.idProducto, Number(evento.target.value))}
            className="numeral h-8 w-14 border-2 border-crema/35 bg-transparent text-center text-sm font-semibold text-crema [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
          />

          <button
            type="button"
            className={PASO}
            disabled={enElTope}
            onClick={() => alCambiar(linea.idProducto, linea.cantidad + 1)}
            aria-label={`Agregar una unidad de ${linea.denominacion}`}
            title={enElTope ? `Solo hay ${linea.disponible} en stock` : undefined}
          >
            <IconoMas className="size-4" />
          </button>
        </div>

        <p className="numeral text-sm font-semibold text-crema">${aPesos(subtotal)}</p>
      </div>

      {enElTope && (
        <p className="numeral mt-1.5 text-[11px] font-medium text-ambar">
          Es todo lo que hay: {linea.disponible} en stock
        </p>
      )}
    </li>
  )
}
