import { useId } from 'react'

// Controles de formulario con la misma anatomia que Campo: etiqueta visible
// siempre, ayuda y error asociados por aria, y el mismo alto en todos.

const ENTRADA = 'w-full bg-crema text-tinta border-2 border-tinta rounded-[3px] px-3 disabled:bg-crema-sombra disabled:opacity-60'
const ROTULO = 'mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75'

const Envoltura = ({ idCampo, etiqueta, ayuda, error, obligatorio, className, children }) => (
  <div className={className}>
    <label htmlFor={idCampo} className={ROTULO}>
      {etiqueta}
      {obligatorio && (
        <span className="ms-1 text-escarlata" aria-hidden="true">
          *
        </span>
      )}
    </label>

    {children}

    {ayuda && !error && (
      <p id={`${idCampo}-ayuda`} className="mt-1.5 text-xs leading-relaxed text-crema/60">
        {ayuda}
      </p>
    )}
    {error && (
      <p id={`${idCampo}-error`} role="alert" className="mt-1.5 text-xs font-semibold text-ambar">
        {error}
      </p>
    )}
  </div>
)

const describir = (idCampo, ayuda, error) =>
  [error && `${idCampo}-error`, ayuda && `${idCampo}-ayuda`].filter(Boolean).join(' ') || undefined

export const Select = ({ etiqueta, ayuda, error, obligatorio, opciones = [], vacio, className, id, ...resto }) => {
  const generado = useId()
  const idCampo = id ?? generado

  return (
    <Envoltura {...{ idCampo, etiqueta, ayuda, error, obligatorio, className }}>
      <select
        id={idCampo}
        {...resto}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(idCampo, ayuda, error)}
        className={`${ENTRADA} h-11 text-sm font-semibold ${error ? 'border-escarlata' : ''}`}
      >
        {vacio && <option value="">{vacio}</option>}
        {opciones.map(({ valor, texto }) => (
          <option key={valor} value={valor}>
            {texto}
          </option>
        ))}
      </select>
    </Envoltura>
  )
}

export const Texto = ({ etiqueta, ayuda, error, obligatorio, prefijo, className, id, ...resto }) => {
  const generado = useId()
  const idCampo = id ?? generado

  return (
    <Envoltura {...{ idCampo, etiqueta, ayuda, error, obligatorio, className }}>
      <div className="relative">
        {prefijo && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-tinta/45">
            {prefijo}
          </span>
        )}
        <input
          id={idCampo}
          {...resto}
          aria-invalid={error ? true : undefined}
          aria-describedby={describir(idCampo, ayuda, error)}
          className={`${ENTRADA} h-11 text-base ${prefijo ? 'ps-8' : ''} ${
            resto.type === 'number' ? 'numeral [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none' : ''
          } ${error ? 'border-escarlata' : ''}`}
        />
      </div>
    </Envoltura>
  )
}

export const Area = ({ etiqueta, ayuda, error, obligatorio, className, id, filas = 3, ...resto }) => {
  const generado = useId()
  const idCampo = id ?? generado

  return (
    <Envoltura {...{ idCampo, etiqueta, ayuda, error, obligatorio, className }}>
      <textarea
        id={idCampo}
        rows={filas}
        {...resto}
        aria-invalid={error ? true : undefined}
        aria-describedby={describir(idCampo, ayuda, error)}
        className={`${ENTRADA} resize-y py-2 text-sm leading-relaxed ${error ? 'border-escarlata' : ''}`}
      />
    </Envoltura>
  )
}

/** Fila de formulario: dos columnas en pantalla ancha, una en angosta. */
export const Par = ({ children, className = '' }) => (
  <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>{children}</div>
)
