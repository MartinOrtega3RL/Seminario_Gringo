import { fechaHora, nombreEstado, MEDIOS_NOTIFICACION } from '../servicio.reglas.js'

// RF22.6 / RF23.1 — todo lo que le pasó a la orden, y quién lo hizo. Lo más
// reciente arriba: lo que se quiere saber al abrir una ficha es en qué quedó,
// no cómo empezó.

export const LineaDeTiempo = ({ historial }) => {
  const pasos = [...historial].reverse()

  return (
    <ol className="relative grid gap-0" aria-label="Historial de la orden">
      {pasos.map((paso, indice) => {
        const actual = indice === 0

        return (
          <li key={paso.idHistorial} className="relative flex gap-3 pb-4 last:pb-0">
            {/* La columna: un hilo que une los pasos, con un cuadrado por paso.
                El actual va relleno; los anteriores, vacios. */}
            <span className="relative flex w-3 shrink-0 justify-center" aria-hidden="true">
              {indice < pasos.length - 1 && <span className="absolute top-3 bottom-[-1rem] w-0.5 bg-crema/15" />}
              <span
                className={`relative mt-1 size-3 border-2 ${
                  actual ? 'border-escarlata bg-escarlata' : 'border-crema/50 bg-azul-hondo'
                }`}
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className={`text-sm font-semibold ${actual ? 'text-crema' : 'text-crema/80'}`}>
                {nombreEstado(paso.estado)}
                {paso.medioNotificacion && (
                  <span className="ms-2 text-xs font-normal text-crema/60">
                    por {MEDIOS_NOTIFICACION[paso.medioNotificacion]}
                  </span>
                )}
              </p>
              <p className="numeral text-xs text-crema/50">
                {fechaHora(paso.fechaHora)} · {paso.usuario.nombreUsuario}
              </p>
              {paso.observacion && (
                <p className="mt-1 text-xs leading-relaxed text-crema/70">{paso.observacion}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
