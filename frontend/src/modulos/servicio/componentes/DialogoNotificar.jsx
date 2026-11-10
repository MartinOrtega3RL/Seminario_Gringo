import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { MEDIOS_NOTIFICACION } from '../servicio.reglas.js'

// RF23.1 — "registrar la notificación al cliente, consignando fecha, medio y
// usuario responsable". La fecha y el usuario los pone el servidor; acá se elige
// el medio. Es lo que inicia el plazo de retiro (H08): si no queda registrado,
// no hay desde cuándo contar los diez días.

export const DialogoNotificar = ({ abierto, orden, alCerrar, alNotificar }) => {
  const [medio, setMedio] = useState('WHATSAPP')
  const [observacion, setObservacion] = useState('')
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setMedio('WHATSAPP')
    setObservacion('')
    setError(null)
    setTrabajando(false)
  }, [abierto])

  const reaviso = orden?.estado.codigo === 'NOTIFICADO'
  const whatsapp = orden?.cliente.persona.telefonoWhatsapp

  const enviar = async (evento) => {
    evento.preventDefault()
    setTrabajando(true)
    setError(null)
    try {
      await alNotificar(medio, observacion.trim() || null)
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={reaviso ? 'Avisar de nuevo' : 'Avisar al cliente'}
      descripcion={
        reaviso
          ? 'La fecha del último aviso es la que cuenta para el plazo de retiro.'
          : `Desde el aviso, el cliente tiene ${orden?.reglas.plazoRetiroDias} días para retirar el equipo antes de que corra el recargo.`
      }
      ancho="max-w-md"
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton form="form-notificar" type="submit" cargando={trabajando}>
            Registrar el aviso
          </Boton>
        </div>
      }
    >
      <form id="form-notificar" onSubmit={enviar} className="grid gap-4">
        <fieldset disabled={trabajando}>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
            ¿Por qué medio se le avisó?
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(MEDIOS_NOTIFICACION).map(([valor, texto]) => (
              <label
                key={valor}
                className={`flex cursor-pointer items-center gap-2 border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  medio === valor ? 'border-crema bg-crema/10 text-crema' : 'border-crema/25 text-crema/65 hover:border-crema/55'
                }`}
              >
                <input type="radio" name="medio" value={valor} checked={medio === valor} onChange={() => setMedio(valor)} className="size-4 accent-escarlata" />
                {texto}
              </label>
            ))}
          </div>
          {medio === 'WHATSAPP' && (
            <p className="mt-2 text-xs text-crema/60">
              {whatsapp ? `WhatsApp del cliente: ${whatsapp}` : 'Este cliente no tiene WhatsApp cargado.'}
            </p>
          )}
        </fieldset>

        <Texto
          etiqueta="Observación"
          value={observacion}
          onChange={(evento) => setObservacion(evento.target.value)}
          maxLength={300}
          placeholder="No atendió, se dejó mensaje…"
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
