import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { Precio } from '../../../ui/Panel.jsx'

// RF23.4 — entrega: fecha y conformidad del cliente. Es el único momento en que
// se cobra, así que el diálogo pone el monto adelante ANTES de confirmar: quien
// entrega tiene que poder decirle al cliente cuánto es sin salir a calcularlo.
//
// El recargo (RF23.3) se muestra aparte y con su motivo. Un total más alto que
// el presupuesto sin explicación es la forma más rápida de una discusión.

export const DialogoEntrega = ({ abierto, orden, alCerrar, alEntregar }) => {
  const [conformidad, setConformidad] = useState(null)
  const [observacion, setObservacion] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setConformidad(null)
    setObservacion('')
    setErrores({})
    setError(null)
    setTrabajando(false)
  }, [abierto])

  if (!orden) return null

  const { liquidacion, noRetirada, diasDesdeNotificacion, reglas } = orden
  const reparado = orden.historial.some((paso) => paso.estado.codigo === 'REPARADO')
  const conRecargo = Number(liquidacion.recargo) > 0

  const enviar = async (evento) => {
    evento.preventDefault()
    if (conformidad === null) {
      setErrores({ conformidad: 'Indicá si el cliente se lleva el equipo conforme.' })
      return
    }

    setTrabajando(true)
    setError(null)
    try {
      await alEntregar(conformidad, observacion.trim() || null)
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Entregar el equipo"
      descripcion="Pedile al cliente la orden: es la condición para retirar el equipo (H09)."
      ancho="max-w-md"
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton form="form-entrega" type="submit" cargando={trabajando}>
            Confirmar la entrega
          </Boton>
        </div>
      }
    >
      <form id="form-entrega" onSubmit={enviar} noValidate className="grid gap-4">
        <div className="grid gap-1 border-2 border-crema/25 bg-crema/5 px-4 py-3">
          {reparado ? (
            <>
              <Linea texto="Presupuesto y repuestos" monto={liquidacion.reparacion} />
              {conRecargo && (
                <div>
                  <Linea texto="Recargo por demora" monto={liquidacion.recargo} />
                  <p className="mt-0.5 text-xs leading-relaxed text-crema/60">
                    Lleva {diasDesdeNotificacion} días sin retirar: el plazo es de {reglas.plazoRetiroDias} y el
                    recargo es del {reglas.recargoPct}% sobre la reparación.
                  </p>
                </div>
              )}
              {!conRecargo && noRetirada === false && orden.fechaNotificacion && (
                <p className="text-xs text-crema/60">En plazo de retiro: sin recargo.</p>
              )}
            </>
          ) : (
            <p className="text-sm leading-relaxed text-crema/80">
              El equipo no se reparó, así que no hay nada que cobrar y no corre garantía.
            </p>
          )}

          <div className="mt-2 flex items-baseline justify-between gap-3 border-t-2 border-crema/20 pt-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-crema/70">Total a cobrar</span>
            <Precio monto={liquidacion.total} tamano="text-3xl" />
          </div>
        </div>

        {reparado && (
          <p className="text-xs leading-relaxed text-crema/65">
            La garantía de {reglas.garantiaDias} días corridos empieza hoy y cubre lo que figura en las tareas
            realizadas. Se anula si el equipo vuelve con los sellos rotos o cortados.
          </p>
        )}

        <fieldset disabled={trabajando}>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
            Conformidad del cliente
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {[[true, 'Conforme'], [false, 'No conforme']].map(([valor, texto]) => (
              <label
                key={texto}
                className={`flex cursor-pointer items-center gap-2 border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  conformidad === valor ? 'border-crema bg-crema/10 text-crema' : 'border-crema/25 text-crema/65 hover:border-crema/55'
                }`}
              >
                <input
                  type="radio"
                  name="conformidad"
                  checked={conformidad === valor}
                  onChange={() => { setConformidad(valor); setErrores({}) }}
                  className="size-4 accent-escarlata"
                />
                {texto}
              </label>
            ))}
          </div>
          {errores.conformidad && (
            <p role="alert" className="mt-1.5 text-xs font-semibold text-ambar">{errores.conformidad}</p>
          )}
        </fieldset>

        <Texto
          etiqueta="Observación"
          value={observacion}
          onChange={(evento) => setObservacion(evento.target.value)}
          maxLength={300}
          disabled={trabajando}
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}

const Linea = ({ texto, monto }) => (
  <div className="flex items-baseline justify-between gap-3">
    <span className="text-sm text-crema/85">{texto}</span>
    <Precio monto={monto} tamano="text-lg" />
  </div>
)
