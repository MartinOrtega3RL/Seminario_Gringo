import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

// RF18.2 — anulación de una venta registrada.
//
// No borra nada: marca la venta como anulada, restituye las existencias
// (RF11.4) y deja registrado quién la anuló y por qué. El motivo es obligatorio
// porque una anulación sin explicación es plata que se fue sin rastro.

export const DialogoAnulacion = ({ abierto, venta, alCerrar, alAnular }) => {
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState(null)
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setMotivo('')
    setErrorMotivo(null)
    setError(null)
  }, [abierto])

  const enviar = async (evento) => {
    evento.preventDefault()

    if (motivo.trim().length < 5) {
      setErrorMotivo('Escribí por qué se anula. Queda en el registro de la venta.')
      return
    }

    setTrabajando(true)
    setError(null)
    try {
      await alAnular(motivo.trim())
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={`Anular ${venta?.numeroComprobante ?? 'la venta'}`}
      descripcion="Las existencias vuelven al stock y la venta queda marcada como anulada. El comprobante sigue existiendo."
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando} autoFocus>
            Cancelar
          </Boton>
          <Boton form="form-anulacion" type="submit" cargando={trabajando}>
            Anular la venta
          </Boton>
        </div>
      }
    >
      <form id="form-anulacion" onSubmit={enviar} noValidate className="grid gap-4">
        {venta && (
          <div className="border-2 border-crema/20 px-3 py-2">
            <p className="numeral text-sm text-crema">
              {venta.numeroComprobante} ·{' '}
              <strong className="text-ambar">
                ${Number(venta.montoTotal).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </strong>
            </p>
            <p className="mt-0.5 text-xs text-crema/55">
              {venta.cliente?.persona?.apellidoNombre ?? 'Consumidor final'} ·{' '}
              {new Date(venta.fechaHora).toLocaleString('es-AR')}
            </p>
          </div>
        )}

        <Area
          etiqueta="Motivo de la anulación"
          obligatorio
          autoFocus
          value={motivo}
          onChange={(evento) => {
            setMotivo(evento.target.value)
            setErrorMotivo(null)
          }}
          error={errorMotivo}
          maxLength={300}
          disabled={trabajando}
          ayuda="Queda registrado con tu usuario y la fecha."
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
