// El filete es el unico ornamento del sistema y aparece unicamente como
// remate de un encabezado de seccion. Si empieza a decorar bordes, tarjetas o
// separadores, deja de ser sistema y pasa a ser disfraz.

export const Filete = ({ className = '' }) => (
  <div className={`filete filete-terminal ${className}`} aria-hidden="true" />
)

export const Titulo = ({ nivel = 2, children, className = '' }) => {
  const Etiqueta = `h${nivel}`
  return (
    <Etiqueta
      className={`font-[family-name:var(--font-cartel)] uppercase leading-[0.95] tracking-tight ${className}`}
    >
      {children}
    </Etiqueta>
  )
}

/** Encabezado de seccion: titulo, su filete, y lo que vaya a la derecha. */
export const Encabezado = ({ titulo, nivel = 2, tamano = 'text-2xl', derecha, className = '' }) => (
  <div className={className}>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <Titulo nivel={nivel} className={tamano}>
        {titulo}
      </Titulo>
      {derecha}
    </div>
    <Filete className="mt-2" />
  </div>
)

/**
 * La chapa pintada: esquina viva, borde de tinta, relieve solido.
 * `as` permite que el panel entero sea el control cuando lo es de verdad,
 * en vez de dejar un boton chico adentro fingiendo que el resto no responde.
 */
export const Panel = ({ as: Etiqueta = 'div', oscuro = false, children, className = '', ...resto }) => (
  <Etiqueta {...resto} className={`${oscuro ? 'panel-oscuro' : 'panel'} ${className}`}>
    {children}
  </Etiqueta>
)

/**
 * Precio. El ambar existe en este sistema solo para esto y para el total.
 * `tono="tinta"` para cuando va sobre el crema de un panel.
 */
export const Precio = ({ monto, tamano = 'text-2xl', tono = 'ambar', className = '' }) => {
  const numero = Number(monto ?? 0)
  const formateado = numero.toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <span
      className={`numeral font-[family-name:var(--font-cartel)] ${tamano} ${
        tono === 'ambar' ? 'text-ambar' : 'text-tinta'
      } ${className}`}
    >
      <span className="align-[0.18em] text-[0.55em] font-normal opacity-70">$</span>
      {formateado}
    </span>
  )
}
