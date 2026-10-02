import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto, Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { ElegirProducto } from './ElegirProducto.jsx'

// RF11.5 — ajuste manual de inventario.
//
// El motivo es obligatorio y la base lo exige con un CHECK: un ajuste sin
// explicación es un descuadre sin responsable. Y el responsable sale del token,
// nunca de un campo del formulario.

export const DialogoAjuste = ({ abierto, alCerrar, alRegistrar }) => {
  const [producto, setProducto] = useState(null)
  const [cantidad, setCantidad] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setProducto(null)
    setCantidad('')
    setMotivo('')
    setErrores({})
    setError(null)
  }, [abierto])

  const delta = Number(cantidad)
  const resultante = producto ? producto.stockActual + (Number.isFinite(delta) ? delta : 0) : null

  const validar = () => {
    const fallos = {}
    if (!producto) fallos.producto = 'Elegí el producto a ajustar.'
    if (cantidad === '' || !Number.isFinite(delta) || delta === 0) {
      fallos.cantidad = 'Cargá cuánto sumar o restar. Cero no es un ajuste.'
    } else if (resultante < 0) {
      fallos.cantidad = `No podés restar ${Math.abs(delta)}: hay ${producto.stockActual}.`
    }
    if (motivo.trim().length < 4) fallos.motivo = 'Escribí por qué se ajusta. Queda en el historial.'

    setErrores(fallos)
    return Object.keys(fallos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!validar()) return

    setTrabajando(true)
    setError(null)
    try {
      await alRegistrar({ idProducto: producto.idProducto, cantidad: delta, motivo: motivo.trim() })
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Ajuste manual"
      descripcion="Para corregir un descuadre: una rotura, un faltante de conteo, una devolución sin venta."
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton form="form-ajuste" type="submit" cargando={trabajando}>
            Registrar ajuste
          </Boton>
        </div>
      }
    >
      <form id="form-ajuste" onSubmit={enviar} noValidate className="grid gap-4">
        <ElegirProducto elegido={producto} alElegir={setProducto} deshabilitado={trabajando} />
        {errores.producto && (
          <p role="alert" className="-mt-2 text-xs font-semibold text-ambar">
            {errores.producto}
          </p>
        )}

        <Texto
          etiqueta="Cantidad"
          obligatorio
          type="number"
          step="1"
          value={cantidad}
          onChange={(evento) => setCantidad(evento.target.value)}
          error={errores.cantidad}
          ayuda="Positivo suma, negativo resta. Por ejemplo -1 por una rotura."
          disabled={trabajando}
        />

        {producto && Number.isFinite(delta) && delta !== 0 && resultante >= 0 && (
          <div className="border-2 border-ambar bg-ambar/10 px-3 py-2">
            <p className="numeral text-sm text-crema">
              {producto.stockActual} {delta > 0 ? '+' : '−'} {Math.abs(delta)} ={' '}
              <strong className="text-ambar">{resultante}</strong> en stock
            </p>
          </div>
        )}

        <Area
          etiqueta="Motivo"
          obligatorio
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          error={errores.motivo}
          maxLength={200}
          disabled={trabajando}
          ayuda="Queda registrado junto con tu usuario y la fecha."
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
