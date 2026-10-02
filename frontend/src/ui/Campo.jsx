import { useId } from 'react'

// Todo campo lleva etiqueta visible. Un marcador de posicion que hace de
// etiqueta desaparece cuando el usuario empieza a escribir, que es
// exactamente cuando mas falta hace saber que se estaba cargando.

const ENTRADA = [
  'w-full bg-crema text-tinta',
  'border-2 border-tinta rounded-[3px]',
  'px-3 placeholder:text-tinta/40',
  'disabled:bg-crema-sombra disabled:opacity-60',
].join(' ')

export const Campo = ({
  etiqueta,
  ayuda,
  error,
  tamano = 'normal',
  className = '',
  id,
  ...resto
}) => {
  const generado = useId()
  const idCampo = id ?? generado
  const idAyuda = `${idCampo}-ayuda`
  const idError = `${idCampo}-error`

  const alto = tamano === 'cartel' ? 'h-16 text-2xl font-semibold' : 'h-11 text-base'

  return (
    <div className={className}>
      <label
        htmlFor={idCampo}
        className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
      >
        {etiqueta}
      </label>

      <input
        id={idCampo}
        {...resto}
        aria-invalid={error ? true : undefined}
        aria-describedby={[error && idError, ayuda && idAyuda].filter(Boolean).join(' ') || undefined}
        className={`${ENTRADA} ${alto} ${error ? 'border-escarlata ring-2 ring-escarlata' : ''}`}
      />

      {ayuda && !error && (
        <p id={idAyuda} className="mt-1.5 text-xs text-crema/60">
          {ayuda}
        </p>
      )}

      {error && (
        <p id={idError} role="alert" className="mt-1.5 text-xs font-semibold text-ambar">
          {error}
        </p>
      )}
    </div>
  )
}
