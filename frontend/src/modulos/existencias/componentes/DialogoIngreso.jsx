import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { ElegirProducto } from './ElegirProducto.jsx'
import { IconoMas, IconoQuitar } from '../../../ui/Iconos.jsx'

// RF11.1 — ingreso de mercadería. Varias líneas en una sola operación, porque
// la mercadería llega en remitos de varios artículos y cargarlos de a uno es
// cuatro veces el trabajo.
//
// RF10 (recepción con OCR del remito) está diferido: acá se carga a mano, que
// es lo que el alcance de esta iteración permite.

export const DialogoIngreso = ({ abierto, alCerrar, alRegistrar }) => {
  const [producto, setProducto] = useState(null)
  const [cantidad, setCantidad] = useState('1')
  const [lineas, setLineas] = useState([])
  const [observaciones, setObservaciones] = useState('')
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    if (abierto) return
    setProducto(null)
    setCantidad('1')
    setLineas([])
    setObservaciones('')
    setError(null)
  }, [abierto])

  const sumar = () => {
    const unidades = Number(cantidad)
    if (!producto || !Number.isInteger(unidades) || unidades < 1) return

    setLineas((previas) => {
      const existente = previas.find((l) => l.idProducto === producto.idProducto)
      if (existente) {
        return previas.map((l) =>
          l.idProducto === producto.idProducto ? { ...l, cantidad: l.cantidad + unidades } : l,
        )
      }
      return [
        ...previas,
        {
          idProducto: producto.idProducto,
          denominacion: producto.denominacion,
          codigoInterno: producto.codigoInterno,
          stockActual: producto.stockActual,
          cantidad: unidades,
        },
      ]
    })

    setProducto(null)
    setCantidad('1')
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (lineas.length === 0) return

    setTrabajando(true)
    setError(null)
    try {
      await alRegistrar({
        lineas: lineas.map(({ idProducto, cantidad: unidades }) => ({ idProducto, cantidad: unidades })),
        observaciones: observaciones.trim() || null,
      })
    } catch (fallo) {
      setError(fallo.message)
      setTrabajando(false)
    }
  }

  const unidades = lineas.reduce((suma, l) => suma + l.cantidad, 0)

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="max-w-xl"
      titulo="Ingreso de mercadería"
      descripcion="Cargá todo lo que llegó en una sola operación: queda un movimiento por producto, a tu nombre."
      pie={
        <div className="flex items-center justify-between gap-3">
          <span className="numeral text-xs font-semibold text-crema/60">
            {lineas.length > 0 && `${unidades} ${unidades === 1 ? 'unidad' : 'unidades'} en ${lineas.length} ${lineas.length === 1 ? 'producto' : 'productos'}`}
          </span>
          <div className="flex gap-3">
            <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando}>
              Cancelar
            </Boton>
            <Boton form="form-ingreso" type="submit" cargando={trabajando} disabled={lineas.length === 0}>
              Registrar ingreso
            </Boton>
          </div>
        </div>
      }
    >
      <form id="form-ingreso" onSubmit={enviar} noValidate className="grid gap-4">
        <ElegirProducto elegido={producto} alElegir={setProducto} deshabilitado={trabajando} />

        {producto && (
          <div className="flex items-end gap-2">
            <div className="w-32">
              <label htmlFor="cantidad-ingreso" className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
                Cantidad
              </label>
              <input
                id="cantidad-ingreso"
                type="number"
                min="1"
                autoFocus
                value={cantidad}
                onChange={(evento) => setCantidad(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key !== 'Enter') return
                  evento.preventDefault()
                  sumar()
                }}
                className="numeral h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-base text-tinta [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <Boton onClick={sumar} disabled={Number(cantidad) < 1}>
              <IconoMas />
              Sumar al ingreso
            </Boton>
          </div>
        )}

        {lineas.length > 0 && (
          <ul className="border-2 border-crema/20">
            {lineas.map((linea) => (
              <li
                key={linea.idProducto}
                className="flex items-center justify-between gap-3 border-b border-crema/10 px-3 py-2 last:border-b-0"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm text-crema">{linea.denominacion}</span>
                  <span className="numeral mt-0.5 block text-xs text-crema/55">
                    {linea.codigoInterno} · {linea.stockActual} → {linea.stockActual + linea.cantidad}
                  </span>
                </span>

                <span className="flex shrink-0 items-center gap-2">
                  <span className="numeral text-sm font-semibold text-ambar">+{linea.cantidad}</span>
                  <button
                    type="button"
                    onClick={() => setLineas((previas) => previas.filter((l) => l.idProducto !== linea.idProducto))}
                    aria-label={`Quitar ${linea.denominacion} del ingreso`}
                    className="p-1 text-crema/45 hover:text-escarlata"
                  >
                    <IconoQuitar className="size-4" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <Area
          etiqueta="Observaciones"
          value={observaciones}
          onChange={(evento) => setObservaciones(evento.target.value)}
          maxLength={200}
          disabled={trabajando}
          ayuda="Opcional: el remito, el proveedor, lo que sirva para encontrarlo después."
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
