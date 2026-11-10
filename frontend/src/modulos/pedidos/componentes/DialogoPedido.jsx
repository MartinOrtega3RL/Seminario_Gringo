import { useEffect, useState } from 'react'
import { registrarPedido } from '../pedidos.api.js'
import { ElegirCliente } from '../../servicio/componentes/ElegirCliente.jsx'
import { ElegirProducto } from '../../existencias/componentes/ElegirProducto.jsx'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto, Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

/**
 * RF19.1 — alta reutilizable de un pedido pendiente.
 * Admite recibir `productoInicial` (cuando se abre desde el punto de venta ante
 * falta de stock) y `clienteInicial`.
 */
export const DialogoPedido = ({
  abierto,
  productoInicial = null,
  clienteInicial = null,
  alCerrar,
  alGuardar,
}) => {
  const [cliente, setCliente] = useState(null)
  const [producto, setProducto] = useState(null)
  const [descripcion, setDescripcion] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [observacion, setObservacion] = useState('')
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setCliente(clienteInicial ?? null)
    setProducto(productoInicial ?? null)
    setDescripcion('')
    setCantidad('1')
    setObservacion('')
    setErrores({})
    setError(null)
    setGuardando(false)
  }, [abierto, productoInicial, clienteInicial])

  const validar = () => {
    const fallos = {}
    if (!cliente) fallos.cliente = 'Elegí o registrá el cliente que hace el pedido.'
    if (!producto && !descripcion.trim()) {
      fallos.descripcion = 'Elegí un producto del catálogo o describí qué pidió.'
    }
    const cant = Number(cantidad)
    if (!Number.isInteger(cant) || cant < 1) {
      fallos.cantidad = 'La cantidad tiene que ser al menos 1.'
    }
    setErrores(fallos)
    return Object.keys(fallos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!validar()) return

    setGuardando(true)
    setError(null)

    try {
      const { datos } = await registrarPedido({
        idCliente: cliente.idCliente,
        idProducto: producto?.idProducto ?? null,
        descripcionPedido: descripcion.trim() || null,
        cantidad: Number(cantidad),
        observacion: observacion.trim() || null,
      })
      alGuardar?.(datos)
      alCerrar()
    } catch (fallo) {
      setError(fallo.message)
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Registrar pedido pendiente"
      descripcion="Queda anotado para avisar al cliente por WhatsApp cuando entre mercadería."
      ancho="max-w-xl"
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton form="form-pedido" type="submit" cargando={guardando}>
            Guardar pedido
          </Boton>
        </div>
      }
    >
      <form id="form-pedido" onSubmit={enviar} noValidate className="grid gap-4">
        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
            Cliente <span className="text-escarlata">*</span>
          </span>
          <ElegirCliente
            cliente={cliente}
            alElegir={(elegido) => {
              setCliente(elegido)
              setErrores((prev) => ({ ...prev, cliente: undefined }))
            }}
            error={errores.cliente}
            deshabilitado={guardando}
          />
          {errores.cliente && <p className="mt-1 text-xs text-escarlata">{errores.cliente}</p>}
        </div>

        <ElegirProducto
          etiqueta="Producto del catálogo (opcional)"
          elegido={producto}
          alElegir={(elegido) => {
            setProducto(elegido)
            setErrores((prev) => ({ ...prev, descripcion: undefined }))
          }}
          deshabilitado={guardando}
          enfocar={false}
        />

        <Texto
          etiqueta={producto ? 'Detalle adicional (opcional)' : 'Descripción del pedido'}
          obligatorio={!producto}
          value={descripcion}
          onChange={(evento) => {
            setDescripcion(evento.target.value)
            setErrores((prev) => ({ ...prev, descripcion: undefined }))
          }}
          error={errores.descripcion}
          placeholder="Ej. Funda reforzada iPhone 16 Pro Max negra"
          maxLength={200}
          disabled={guardando}
        />

        <Texto
          etiqueta="Cantidad"
          obligatorio
          type="number"
          min="1"
          step="1"
          value={cantidad}
          onChange={(evento) => {
            setCantidad(evento.target.value)
            setErrores((prev) => ({ ...prev, cantidad: undefined }))
          }}
          error={errores.cantidad}
          disabled={guardando}
        />

        <Area
          etiqueta="Observación"
          value={observacion}
          onChange={(evento) => setObservacion(evento.target.value)}
          maxLength={300}
          disabled={guardando}
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}

