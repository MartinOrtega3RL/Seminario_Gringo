import { LineaVenta } from './LineaVenta.jsx'
import { SelectorCliente } from './SelectorCliente.jsx'
import { CondicionesVenta } from './CondicionesVenta.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { Filete } from '../../../ui/Panel.jsx'
import { aPesos } from '../ganchos/useVenta.js'

// El mostrador. El total es el objeto mas grande de la pantalla porque lo tiene
// que poder leer el cliente parado del otro lado, sin que se lo giren.
// Debajo del total va el unico control primario de toda la pantalla.

export const PanelVenta = ({
  lineas,
  unidades,
  totalCentavos,
  lista,
  cliente,
  alElegirCliente,
  mediosPago,
  condiciones,
  alCambiarCondiciones,
  errorDomicilio,
  alCambiarCantidad,
  alQuitar,
  alVaciar,
  alConfirmar,
  confirmando,
  error,
}) => {
  const vacia = lineas.length === 0

  return (
    <aside
      aria-label="Venta en curso"
      className="flex max-h-[calc(100dvh-7rem)] flex-col border-2 border-black bg-azul-hondo lg:sticky lg:top-6"
    >
      <div className="border-b-2 border-crema/12 px-4 pb-3 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight text-crema">
            La venta
          </h2>
          {!vacia && (
            <span className="numeral text-xs font-semibold text-crema/60">
              {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
            </span>
          )}
        </div>
        <Filete className="mt-2" />

        <div className="mt-3">
          <SelectorCliente
            cliente={cliente}
            alElegir={alElegirCliente}
            deshabilitado={confirmando}
          />
        </div>

        {/* RF16.5 — cambiar de cliente recalcula toda la venta, y se avisa: un
            total que cambia solo, sin explicacion, es un total que no se cree. */}
        {lista === 'MAYORISTA' && !vacia && (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-wider text-ambar">
            Precios mayoristas aplicados
          </p>
        )}
      </div>

      {vacia ? (
        <div className="grid flex-1 place-items-center px-6 py-10 text-center">
          <div>
            <p className="font-[family-name:var(--font-cartel)] text-sm uppercase tracking-wide text-crema/70">
              Todavia no cargaste nada
            </p>
            <p className="mt-2 text-xs leading-relaxed text-crema/50">
              Busca el producto arriba y tocalo para sumarlo a la venta.
            </p>
          </div>
        </div>
      ) : (
        <ul className="flex-1 overflow-y-auto">
          {lineas.map((linea) => (
            <LineaVenta
              key={linea.idProducto}
              linea={linea}
              alCambiar={alCambiarCantidad}
              alQuitar={alQuitar}
            />
          ))}
        </ul>
      )}

      <div className="border-t-2 border-crema/12 px-4 pb-4 pt-3">
        <CondicionesVenta
          mediosPago={mediosPago}
          condiciones={condiciones}
          alCambiar={alCambiarCondiciones}
          deshabilitado={confirmando}
          errorDomicilio={errorDomicilio}
        />

        {/* El total. Ambar sobre azul, el cuerpo mas grande de la pantalla. */}
        <div className="mt-4 flex items-end justify-between gap-3 border-t-2 border-dashed border-crema/25 pt-3">
          <span className="pb-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-crema/70">
            Total
          </span>
          <span className="numeral font-[family-name:var(--font-cartel)] text-[40px] leading-[0.85] text-ambar">
            <span className="align-[0.3em] text-[0.42em] font-normal opacity-75">$</span>
            {aPesos(totalCentavos)}
          </span>
        </div>

        {error && (
          <div className="mt-3">
            <Aviso tono="mal">{error}</Aviso>
          </div>
        )}

        <Boton
          tamano="cartel"
          className="mt-4"
          cargando={confirmando}
          disabled={vacia || !condiciones.idMedioPago}
          onClick={alConfirmar}
        >
          {confirmando ? 'Registrando' : 'Confirmar venta'}
        </Boton>

        {!vacia && (
          <button
            type="button"
            onClick={alVaciar}
            disabled={confirmando}
            className="mt-2 w-full py-1.5 text-xs font-semibold uppercase tracking-wide text-crema/50 hover:text-escarlata disabled:opacity-40"
          >
            Vaciar la venta
          </button>
        )}
      </div>
    </aside>
  )
}
