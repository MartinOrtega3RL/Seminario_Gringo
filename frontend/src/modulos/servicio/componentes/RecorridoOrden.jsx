import { etapasDeOrden, fechaCorta } from '../servicio.reglas.js'
import { IconoTilde } from '../../../ui/Iconos.jsx'

// El recorrido completo de la reparación, de punta a punta, en una sola tira:
// lo hecho, lo salteado, dónde está el trabajo ahora y lo que falta. El
// historial dice qué pasó; esto dice dónde está el equipo y cuánto le queda.

const MARCADOR = {
  hecha: 'border-crema bg-crema text-tinta',
  actual: 'border-escarlata bg-escarlata text-crema shadow-[0_0_0_5px_color-mix(in_srgb,var(--color-escarlata)_22%,transparent)]',
  salteada: 'border-dashed border-crema/35 text-crema/45',
  pendiente: 'border-crema/25 text-crema/45',
}

const Detalle = ({ etapa }) => {
  if (etapa.situacion === 'actual') {
    return <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-escarlata">Ahora</span>
  }
  if (etapa.situacion === 'salteada') {
    return <span className="text-xs text-crema/50">{etapa.desenlace ?? 'No se hizo'}</span>
  }
  if (etapa.situacion === 'hecha' && etapa.paso) {
    return (
      <span className="text-xs text-crema/60">
        {etapa.desenlace && <span className="font-semibold text-crema/85">{etapa.desenlace} · </span>}
        <span className="numeral">{fechaCorta(etapa.paso.fechaHora)}</span> · {etapa.paso.usuario.nombreUsuario}
      </span>
    )
  }
  return <span className="text-xs text-crema/35">Falta</span>
}

export const RecorridoOrden = ({ orden }) => {
  const etapas = etapasDeOrden(orden.estado.codigo, orden.historial)

  // Una orden anulada no tiene recorrido: se dice que se anuló y por qué.
  if (!etapas) {
    const anulacion = orden.historial.filter((paso) => paso.estado.codigo === 'ANULADA').at(-1)
    return (
      <section aria-label="Recorrido de la orden" className="border-2 border-escarlata bg-escarlata/15 px-5 py-4">
        <p className="text-sm font-semibold text-crema">Orden anulada. No admite más cambios.</p>
        {anulacion?.observacion && <p className="mt-1 text-sm text-crema/75">Motivo: {anulacion.observacion}</p>}
      </section>
    )
  }

  return (
    <section aria-label="Recorrido de la orden" className="panel-oscuro px-5 py-5">
      <ol className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 lg:gap-0">
        {etapas.map((etapa, indice) => {
          const siguiente = etapas[indice + 1]
          const alcanzada = siguiente && siguiente.situacion !== 'pendiente'

          return (
            <li
              key={etapa.clave}
              aria-current={etapa.situacion === 'actual' ? 'step' : undefined}
              className="relative flex items-start gap-3 lg:block lg:pr-4"
            >
              {/* El tramo hacia la etapa siguiente: lleno si ya se llegó. */}
              {siguiente && (
                <span
                  aria-hidden="true"
                  className={`absolute top-[1.0625rem] right-0 left-12 hidden h-0.5 lg:block ${alcanzada ? 'bg-crema/70' : 'bg-crema/15'}`}
                />
              )}

              <span
                className={`relative grid size-9 shrink-0 place-items-center border-2 text-sm font-bold ${MARCADOR[etapa.situacion]}`}
              >
                {etapa.situacion === 'hecha'
                  ? <IconoTilde className="size-5" />
                  : <span className="numeral">{indice + 1}</span>}
              </span>

              <span className="grid min-w-0 gap-0.5 lg:mt-2.5">
                <span
                  className={`text-sm font-semibold ${
                    etapa.situacion === 'actual' ? 'text-crema' : etapa.situacion === 'hecha' ? 'text-crema/90' : 'text-crema/50'
                  }`}
                >
                  {etapa.titulo}
                  <span className="sr-only">
                    {{ hecha: ': hecha', actual: ': ahora', salteada: ': no se hizo', pendiente: ': falta' }[etapa.situacion]}
                  </span>
                </span>
                <Detalle etapa={etapa} />
              </span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
