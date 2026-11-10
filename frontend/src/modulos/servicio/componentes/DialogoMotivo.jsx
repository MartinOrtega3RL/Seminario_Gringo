import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

// Los dos cambios de estado que no se pueden deshacer y que el servidor exige
// explicar: marcar un equipo como sin arreglo y anular una orden. El motivo
// queda en el historial, junto al usuario y la fecha.

export const DialogoMotivo = ({ abierto, titulo, descripcion, etiqueta, textoAccion, alCerrar, alConfirmar }) => {
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setMotivo('')
    setErrores({})
    setError(null)
    setTrabajando(false)
  }, [abierto])

  const enviar = async (evento) => {
    evento.preventDefault()

    if (motivo.trim().length < 5) {
      setErrores({ motivo: 'Escribí el motivo, aunque sea en una frase.' })
      return
    }

    setTrabajando(true)
    setError(null)
    try {
      await alConfirmar(motivo.trim())
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={titulo}
      descripcion={descripcion}
      ancho="max-w-md"
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando} autoFocus>
            Cancelar
          </Boton>
          <Boton form="form-motivo" type="submit" cargando={trabajando}>
            {textoAccion}
          </Boton>
        </div>
      }
    >
      <form id="form-motivo" onSubmit={enviar} noValidate className="grid gap-4">
        <Area
          etiqueta={etiqueta}
          obligatorio
          filas={3}
          value={motivo}
          onChange={(evento) => { setMotivo(evento.target.value); setErrores({}) }}
          error={errores.motivo}
          maxLength={300}
          disabled={trabajando}
        />
        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
