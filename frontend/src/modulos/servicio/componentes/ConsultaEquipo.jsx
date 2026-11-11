import { Link } from 'react-router'
import { nombreEquipo, nombreEstado, soloFecha, diasRestantes, fechaCorta } from '../servicio.reglas.js'
import { Marca } from '../../../ui/Listado.jsx'

// RF24.2 — "consultar la vigencia de la garantía de una reparación previa al
// reingresar un dispositivo". Y RF25.2 — el historial del equipo.
//
// Aparece apenas se carga el IMEI, con el cliente todavía adelante: enterarse de
// que el equipo tenía garantía después de que se fue es enterarse tarde.

export const ConsultaEquipo = ({ consulta, vincular, alVincular }) => {
  if (!consulta?.dispositivo) return null

  const { dispositivo, ordenes, garantia, ordenConGarantia } = consulta

  // Hay garantía en juego solo si hubo una reparación entregada con vencimiento.
  const conGarantia = Boolean(ordenConGarantia)

  return (
    <div className="grid gap-3 border-2 border-crema/25 bg-crema/5 px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-crema">
          Este equipo ya pasó por el taller
          <span className="ms-2 font-normal text-crema/60">{nombreEquipo(dispositivo)}</span>
        </p>
        <span className="text-xs text-crema/55">
          {ordenes.length === 1 ? '1 orden anterior' : `${ordenes.length} órdenes anteriores`}
        </span>
      </div>

      {conGarantia && (
        <div
          role="status"
          className={`border-2 px-3 py-2.5 ${
            garantia.vigente ? 'border-ambar bg-ambar/10' : 'border-escarlata/70 bg-escarlata/10'
          }`}
        >
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-crema">
            <Marca tono={garantia.vigente ? 'destacado' : 'alerta'}>
              {garantia.vigente ? 'Garantía vigente' : 'Sin garantía'}
            </Marca>
            Reparación {ordenConGarantia.numeroOrden}
            <span className="font-normal text-crema/70">
              {garantia.motivo === 'VENCIDA'
                ? `venció el ${soloFecha(ordenConGarantia.fechaVencGarantia)}`
                : `vence el ${soloFecha(ordenConGarantia.fechaVencGarantia)} · ${diasRestantes(garantia.diasRestantes)}`}
            </span>
          </p>

          {!garantia.vigente && <p className="mt-1.5 text-xs leading-relaxed text-crema/75">{garantia.mensaje}</p>}

          {/* RF24.3 — solo se ofrece vincular cuando la garantia vale: un
              reingreso "por garantia" que no la tiene seria una etiqueta falsa. */}
          {garantia.vigente && (
            <label className="mt-2.5 flex cursor-pointer items-start gap-2.5 text-sm text-crema">
              <input
                type="checkbox"
                checked={vincular}
                onChange={(evento) => alVincular(evento.target.checked)}
                className="mt-0.5 size-4 shrink-0 accent-escarlata"
              />
              <span>
                Es un reingreso por esa reparación
                <span className="block text-xs text-crema/60">
                  Queda vinculado a {ordenConGarantia.numeroOrden} y se atiende bajo garantía.
                </span>
              </span>
            </label>
          )}
        </div>
      )}

      <ul className="grid gap-1 text-xs text-crema/70">
        {ordenes.slice(0, 4).map((orden) => (
          <li key={orden.idOrden} className="flex flex-wrap items-baseline gap-x-2">
            <Link to={`/servicio/${orden.idOrden}`} className="numeral font-semibold text-crema underline-offset-2 hover:underline">
              {orden.numeroOrden}
            </Link>
            <span>{fechaCorta(orden.fechaIngreso)}</span>
            <span className="min-w-0 truncate">{orden.fallaDeclarada}</span>
            <span className="text-crema/50">· {nombreEstado(orden.estado)}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
