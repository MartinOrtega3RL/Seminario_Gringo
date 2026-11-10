import { useState } from 'react'
import { agregarRepuesto, quitarRepuesto, registrarTarea } from '../servicio.api.js'
import { fechaHora } from '../servicio.reglas.js'
import { ElegirProducto } from '../../existencias/componentes/ElegirProducto.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { Titulo, Precio } from '../../../ui/Panel.jsx'
import { Listado, Fila, AccionFila } from '../../../ui/Listado.jsx'
import { IconoQuitar, IconoMas } from '../../../ui/Iconos.jsx'

// RF22.4 — repuestos usados, afectando las existencias.
// RF22.5 — tareas efectivamente realizadas.
//
// Las tareas no son un trámite: son lo que delimita qué cubre la garantía (H07).
// Una reparación dada por hecha sin tareas dejaría una garantía sin alcance, por
// eso el servidor no deja pasar a "reparado" sin al menos una.

export const PanelReparacion = ({ orden, alActualizar }) => {
  const puedeRepuestos = orden.operaciones.includes('repuestos')
  const puedeTareas = orden.operaciones.includes('tareas')

  const [producto, setProducto] = useState(null)
  const [cantidad, setCantidad] = useState('1')
  const [tarea, setTarea] = useState('')
  const [trabajando, setTrabajando] = useState(null)
  const [error, setError] = useState(null)

  const ejecutar = async (clave, accion) => {
    setTrabajando(clave)
    setError(null)
    try {
      const { datos } = await accion()
      alActualizar(datos)
      return true
    } catch (fallo) {
      setError(fallo.message)
      return false
    } finally {
      setTrabajando(null)
    }
  }

  const cargarRepuesto = async (evento) => {
    evento.preventDefault()
    const unidades = Number(cantidad)

    if (!producto) return setError('Elegí el repuesto que se usó.')
    if (!Number.isInteger(unidades) || unidades < 1) return setError('Indicá cuántas unidades se usaron.')
    if (unidades > producto.stockActual) {
      return setError(`Solo hay ${producto.stockActual} en stock de ese repuesto.`)
    }

    const cargado = await ejecutar('repuesto', () => agregarRepuesto(orden.idOrden, producto.idProducto, unidades))
    if (cargado) {
      setProducto(null)
      setCantidad('1')
    }
  }

  const cargarTarea = async (evento) => {
    evento.preventDefault()
    if (tarea.trim().length < 3) return setError('Describí qué se hizo.')

    const cargada = await ejecutar('tarea', () => registrarTarea(orden.idOrden, tarea.trim()))
    if (cargada) setTarea('')
  }

  const sinNada = orden.repuestos.length === 0 && orden.tareas.length === 0
  if (sinNada && !puedeRepuestos && !puedeTareas) return null

  return (
    <section className="panel-oscuro grid gap-6 p-5" aria-label="Reparación">
      <div className="grid gap-3">
        <Titulo nivel={3} className="text-base">Repuestos usados</Titulo>

        {orden.repuestos.length === 0 && (
          <p className="text-sm text-crema/60">
            {puedeRepuestos ? 'Todavía no se usó ningún repuesto.' : 'No se usaron repuestos.'}
          </p>
        )}

        {orden.repuestos.length > 0 && (
          <Listado>
            {orden.repuestos.map((repuesto) => (
              <Fila
                key={repuesto.idRepuestoUtilizado}
                principal={repuesto.producto.denominacion}
                secundario={`${repuesto.producto.codigoInterno} · ${repuesto.cantidad} × $${Number(repuesto.precioUnitario).toLocaleString('es-AR')}`}
                derecha={<Precio monto={repuesto.subtotal} tamano="text-lg" />}
                acciones={
                  puedeRepuestos && (
                    <AccionFila
                      etiqueta="Quitar el repuesto: la unidad vuelve al stock"
                      peligrosa
                      disabled={trabajando !== null}
                      onClick={() => ejecutar('quitar', () => quitarRepuesto(orden.idOrden, repuesto.idRepuestoUtilizado))}
                    >
                      <IconoQuitar className="size-4" />
                    </AccionFila>
                  )
                }
              />
            ))}
          </Listado>
        )}

        {puedeRepuestos && (
          <form onSubmit={cargarRepuesto} noValidate className="grid gap-3 border-2 border-crema/15 p-3">
            <ElegirProducto etiqueta="Repuesto" elegido={producto} alElegir={setProducto} deshabilitado={trabajando !== null} enfocar={false} />

            {producto && (
              <div className="flex flex-wrap items-end gap-3">
                <Texto
                  etiqueta="Unidades"
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={(evento) => setCantidad(evento.target.value)}
                  disabled={trabajando !== null}
                  className="w-32"
                />
                <Boton type="submit" cargando={trabajando === 'repuesto'}>
                  <IconoMas />
                  Cargar el repuesto
                </Boton>
                <p className="min-w-48 flex-1 text-xs leading-relaxed text-crema/60">
                  Descuenta del stock ({producto.stockActual} disponibles) y se cobra a la lista del cliente.
                </p>
              </div>
            )}
          </form>
        )}
      </div>

      <div className="grid gap-3">
        <Titulo nivel={3} className="text-base">Tareas realizadas</Titulo>

        {orden.tareas.length === 0 && (
          <p className="text-sm text-crema/60">
            {puedeTareas
              ? 'Todavía no hay tareas. Anotá lo que vas haciendo: es lo que cubre la garantía.'
              : 'No se registraron tareas.'}
          </p>
        )}

        {orden.tareas.length > 0 && (
          <Listado>
            {orden.tareas.map((item) => (
              <Fila
                key={item.idTarea}
                principal={<span className="whitespace-normal font-medium">{item.descripcion}</span>}
                secundario={`${item.usuario.nombreUsuario} · ${fechaHora(item.fechaHora)}`}
              />
            ))}
          </Listado>
        )}

        {puedeTareas && (
          <form onSubmit={cargarTarea} noValidate className="flex flex-wrap items-end gap-3">
            <Texto
              etiqueta="Qué se hizo"
              value={tarea}
              onChange={(evento) => setTarea(evento.target.value)}
              maxLength={2000}
              disabled={trabajando !== null}
              placeholder="Cambio de pin de carga. Prueba de carga completa."
              className="min-w-64 flex-1"
            />
            <Boton type="submit" tono="papel" cargando={trabajando === 'tarea'}>
              Anotar la tarea
            </Boton>
          </form>
        )}
      </div>

      {error && <Aviso tono="mal">{error}</Aviso>}
    </section>
  )
}
