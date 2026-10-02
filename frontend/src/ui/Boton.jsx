// El escarlata es el color de la accion y no aparece en ningun otro lado del
// sistema. Por eso un boton nunca se pinta de escarlata "para destacar": se
// pinta asi porque hace algo.

const BASE = [
  'inline-flex items-center justify-center gap-2',
  'font-semibold tracking-wide uppercase',
  'border-2 border-tinta rounded-[3px]',
  'transition-[transform,box-shadow,background-color] duration-100',
  'disabled:opacity-45 disabled:cursor-not-allowed disabled:shadow-none disabled:translate-none',
].join(' ')

// El boton se hunde al apretarse, como una chapa que cede. No hay sombra
// difusa en ningun lado: el relieve viene de un desplazamiento solido.
const RELIEVE = [
  'shadow-[3px_3px_0_var(--color-azul-hondo)]',
  'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',
].join(' ')

const TONOS = {
  accion: `bg-escarlata text-crema hover:bg-escarlata-hondo ${RELIEVE}`,
  papel: `bg-crema text-tinta hover:bg-crema-sombra ${RELIEVE}`,
  desnudo: 'bg-transparent text-crema border-transparent hover:border-crema/40 hover:bg-white/5',
}

const TAMANOS = {
  chico: 'h-9 px-3 text-xs',
  normal: 'h-11 px-5 text-sm',
  // El unico control primario de la pantalla de venta usa este tamano.
  cartel: 'h-16 px-6 text-lg w-full',
}

export const Boton = ({
  tono = 'accion',
  tamano = 'normal',
  cargando = false,
  hijos,
  children,
  className = '',
  ...resto
}) => (
  <button
    type="button"
    {...resto}
    disabled={resto.disabled || cargando}
    aria-busy={cargando || undefined}
    className={`${BASE} ${TONOS[tono]} ${TAMANOS[tamano]} ${className}`}
  >
    {cargando && <Rueda />}
    {children ?? hijos}
  </button>
)

const Rueda = () => (
  <svg
    className="size-4 animate-spin"
    viewBox="0 0 24 24"
    fill="none"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity="0.3" />
    <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="square" />
  </svg>
)
