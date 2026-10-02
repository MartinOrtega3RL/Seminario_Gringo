import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { ElegirProducto } from './ElegirProducto.jsx'

// RF11.3 — consumo de un repuesto en una reparación.
//
// Es la pantalla que reemplaza la planilla: «se descuentan y anotan en una
// planilla cada vez que se utiliza uno» (H29). No pide orden de servicio
// técnico porque ese módulo está diferido; el descuento y el registro ocurren
// igual, con su motivo y su responsable.

export const DialogoReparacion = ({ abierto, alCerrar, alRegistrar }) => {
  const [producto, setProducto] = useState(null)
  const [cantidad, setCantidad] = useState('1')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setProducto(null)
    setCantidad('1')
    setMotivo('')
    setErrores({})
    setError(null)
  }, [abierto])

  const unidades = Number(cantidad)
  const restante = producto ? producto.stockActual - (Number.isFinite(unidades) ? unidades : 0) : null

  const validar = () => {
    const fallos = {}
    if (!producto) fallos.producto = 'Elegí el repuesto que se usó.'
    if (!Number.isInteger(unidades) || unidades < 1) {
      fallos.cantidad = 'Indicá cuántas unidades se usaron.'
    } else if (producto && unidades > producto.stockActual) {
      fallos.cantidad = `Solo hay ${producto.stockActual} en stock.`
    }
    if (motivo.trim().length < 4) fallos.motivo = 'Escribí para qué reparación se usó.'

    setErrores(fallos)
    return Object.keys(fallos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!validar()) return

    setTrabajando(true)
    setError(null)
    try {
      await alRegistrar({ idProducto: producto.idProducto, cantidad: unidades, motivo: motivo.trim() })
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Repuesto usado en una reparación"
      descripcion="Descuenta del stock y deja el registro, igual que la planilla del taller."
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton form="form-reparacion" type="submit" cargando={trabajando}>
            Registrar consumo
          </Boton>
        </div>
      }
    >
      <form id="form-reparacion" onSubmit={enviar} noValidate className="grid gap-4">
        <ElegirProducto
          etiqueta="Repuesto"
          elegido={producto}
          alElegir={setProducto}
          deshabilitado={trabajando}
        />
        {errores.producto && (
          <p role="alert" className="-mt-2 text-xs font-semibold text-ambar">
            {errores.producto}
          </p>
        )}

        <Texto
          etiqueta="Unidades usadas"
          obligatorio
          type="number"
          min="1"
          value={cantidad}
          onChange={(evento) => setCantidad(evento.target.value)}
          error={errores.cantidad}
          disabled={trabajando}
        />

        {producto && Number.isInteger(unidades) && unidades >= 1 && restante >= 0 && (
          <div className="border-2 border-ambar bg-ambar/10 px-3 py-2">
            <p className="numeral text-sm text-crema">
              {producto.stockActual} − {unidades} = <strong className="text-ambar">{restante}</strong> en
              stock
            </p>
          </div>
        )}

        <Texto
          etiqueta="Reparación"
          obligatorio
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          error={errores.motivo}
          maxLength={200}
          disabled={trabajando}
          placeholder="Cambio de pin en Moto G54"
          ayuda="Qué se reparó. Queda junto a tu usuario y la fecha."
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
