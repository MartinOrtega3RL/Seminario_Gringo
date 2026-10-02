import { Panel, Precio } from '../../../ui/Panel.jsx'
import { IconoMas } from '../../../ui/Iconos.jsx'

// Un producto es un cartel pintado: chapa con borde, denominacion arriba y el
// precio como el objeto mas grande del panel. No es una fila de tabla.
//
// El estado de existencias se dice con una MARCA, no con un color: una banda
// tachada para lo agotado y una esquina pintada para lo que llego al minimo.
// Asi se lee igual sin distinguir colores, y a un metro de distancia.

const Agotado = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden"
  >
    <span className="w-[140%] -rotate-[8deg] border-y-2 border-tinta bg-tinta/85 py-1 text-center font-[family-name:var(--font-cartel)] text-xs uppercase tracking-[0.3em] text-crema">
      Sin stock
    </span>
  </div>
)

const Esquina = () => (
  <span className="absolute -right-px -top-px border-b-2 border-l-2 border-tinta bg-escarlata px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-crema">
    Ultimas
  </span>
)

const Contenido = ({ producto, precio, agotado, interactivo }) => (
  <>
    <p className="pr-14 text-[11px] font-semibold uppercase tracking-[0.16em] text-tinta/55">
      {producto.marca?.nombre} · {producto.categoria?.nombre}
    </p>

    <p className="mt-1 text-base font-semibold leading-snug text-tinta">{producto.denominacion}</p>

    <p className="numeral mt-0.5 text-xs text-tinta/60">{producto.codigoInterno}</p>

    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
      <span className="block">
        <Precio monto={precio ?? producto.precioMinorista} tono="tinta" tamano="text-[26px]" />
        <span className="numeral mt-0.5 block text-xs font-medium text-tinta/60">
          {agotado ? 'Sin existencias' : `${producto.stockActual} en stock`}
        </span>
      </span>

      {/* Decorativo a proposito: el boton es el panel entero, no este cuadrito.
          Si fuera un boton adentro de otro boton, el HTML seria invalido y el
          teclado tendria dos paradas para una sola accion. */}
      {interactivo && (
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center border-2 border-tinta bg-escarlata text-crema shadow-[3px_3px_0_var(--color-azul-hondo)]"
        >
          <IconoMas />
        </span>
      )}
    </div>

    {/* RF04.2: el precio de costo llega solo cuando el perfil lo tiene
        habilitado. El servidor lo omite; aca no hay nada que ocultar. */}
    {producto.precioCosto !== undefined && (
      <span className="numeral mt-3 block border-t-2 border-dashed border-tinta/25 pt-2 text-xs text-tinta/65">
        Costo{' '}
        <span className="font-semibold">
          ${Number(producto.precioCosto).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
        </span>
      </span>
    )}
  </>
)

export const PanelProducto = ({ producto, precio, alSeleccionar, acciones }) => {
  const agotado = producto.stockActual <= 0
  const interactivo = Boolean(alSeleccionar) && !agotado

  const marco = `relative flex flex-col p-4 text-left ${agotado ? 'opacity-70' : ''}`

  // El panel ENTERO es el control. Antes solo lo era el bloque del titulo, y
  // tocar el precio o el signo mas no hacia nada: la afordancia mentia.
  if (interactivo) {
    return (
      <Panel
        as="button"
        type="button"
        onClick={() => alSeleccionar(producto)}
        aria-label={`Agregar ${producto.denominacion} a la venta`}
        className={`${marco} w-full cursor-pointer transition-transform hover:-translate-y-0.5 active:translate-y-0`}
      >
        {producto.bajoMinimo && <Esquina />}
        <Contenido producto={producto} precio={precio} agotado={false} interactivo />
      </Panel>
    )
  }

  return (
    <Panel className={marco}>
      {agotado && <Agotado />}
      {!agotado && producto.bajoMinimo && <Esquina />}
      <Contenido producto={producto} precio={precio} agotado={agotado} interactivo={false} />

      {/* Las acciones van fuera del contenido y solo en el panel que NO es un
          control: un botón adentro de otro botón es HTML inválido. */}
      {acciones && (
        <div className="relative mt-3 flex justify-end gap-1 border-t-2 border-dashed border-tinta/25 pt-2">
          {acciones}
        </div>
      )}
    </Panel>
  )
}
