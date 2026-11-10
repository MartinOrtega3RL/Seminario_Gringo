import { useEffect, useState } from 'react'
import {
  registrarDiagnostico, registrarPresupuesto, responderPresupuesto, cambiarEstado,
  notificarCliente, entregarEquipo,
} from '../servicio.api.js'
import { DialogoMotivo } from './DialogoMotivo.jsx'
import { DialogoNotificar } from './DialogoNotificar.jsx'
import { DialogoEntrega } from './DialogoEntrega.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto, Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { Encabezado, Precio } from '../../../ui/Panel.jsx'

// RF22.1, RF22.2, RF22.3 y RF22.6 — el recorrido de la orden.
//
// Lo que se puede hacer en cada estado lo decide el servidor y llega en
// `orden.operaciones` y `orden.cambios`: este panel dibuja eso y nada más. Si
// mañana el comercio agrega un paso al ciclo de vida, se cambia en un solo lugar.

// Cada cambio manual con su texto de botón. Los que llevan motivo abren el
// diálogo; el resto es un clic. Lo que no está acá se muestra con el nombre del
// estado, para que un estado nuevo no quede sin botón.
const CAMBIOS = {
  EN_DIAGNOSTICO: { texto: 'Tomar la orden', ayuda: 'Pasa a diagnóstico y queda a tu nombre.' },
  EN_REPARACION: { texto: 'Empezar la reparación' },
  REPARADO: { texto: 'Dar por reparado', ayuda: 'Necesita al menos una tarea registrada.', principal: true },
  NO_REPARABLE: { texto: 'No tiene arreglo', motivo: 'Por qué no tiene arreglo', accion: 'Marcar sin arreglo', suave: true },
  ANULADA: { texto: 'Anular la orden', motivo: 'Por qué se anula', accion: 'Anular la orden', suave: true },
}

export const PanelProceso = ({ orden, alActualizar }) => {
  const { operaciones, cambios, estado } = orden

  const puede = (operacion) => operaciones.includes(operacion)

  const [diagnostico, setDiagnostico] = useState(orden.diagnosticoTecnico ?? '')
  const [monto, setMonto] = useState(orden.montoPresupuestado ? String(Number(orden.montoPresupuestado)) : '')
  const [respuesta, setRespuesta] = useState('')
  const [motivoDe, setMotivoDe] = useState(null)
  const [notificando, setNotificando] = useState(false)
  const [entregando, setEntregando] = useState(false)
  const [trabajando, setTrabajando] = useState(null)
  const [error, setError] = useState(null)
  const [errores, setErrores] = useState({})

  // Al cambiar de orden o de estado el formulario vuelve a lo que dice la orden.
  useEffect(() => {
    setDiagnostico(orden.diagnosticoTecnico ?? '')
    setMonto(orden.montoPresupuestado ? String(Number(orden.montoPresupuestado)) : '')
    setRespuesta('')
    setErrores({})
    setError(null)
  }, [orden.idOrden, orden.estado.codigo, orden.diagnosticoTecnico, orden.montoPresupuestado])

  const ejecutar = async (clave, accion) => {
    setTrabajando(clave)
    setError(null)
    try {
      const { datos } = await accion()
      alActualizar(datos)
      return datos
    } catch (fallo) {
      setError(fallo.message)
      return null
    } finally {
      setTrabajando(null)
    }
  }

  const guardarDiagnostico = (evento) => {
    evento.preventDefault()
    if (diagnostico.trim().length < 5) return setErrores({ diagnostico: 'Escribí qué se encontró en la revisión.' })
    setErrores({})
    return ejecutar('diagnostico', () => registrarDiagnostico(orden.idOrden, diagnostico.trim()))
  }

  const guardarPresupuesto = (evento) => {
    evento.preventDefault()
    const importe = Number(monto.replace(',', '.'))
    if (!(importe > 0)) return setErrores({ monto: 'El presupuesto tiene que ser mayor que cero.' })
    setErrores({})
    return ejecutar('presupuesto', () => registrarPresupuesto(orden.idOrden, importe))
  }

  const sinPasos = !puede('diagnosticar') && !puede('presupuestar') && !puede('responder')
    && cambios.length === 0 && !puede('notificar') && !puede('entregar')

  if (sinPasos) {
    return (
      <section className="panel-oscuro px-5 py-4" aria-label="Estado de la orden">
        <p className="text-sm text-crema/70">
          {estado.codigo === 'ENTREGADO' && 'El equipo ya se entregó. La orden está cerrada.'}
          {estado.codigo === 'ANULADA' && 'La orden fue anulada y no admite más cambios.'}
        </p>
      </section>
    )
  }

  const principales = cambios.filter((c) => CAMBIOS[c.codigo]?.principal)
  const secundarios = cambios.filter((c) => !CAMBIOS[c.codigo]?.principal)

  const ejecutarCambio = (cambio) => {
    const definicion = CAMBIOS[cambio.codigo]
    if (definicion?.motivo) return setMotivoDe(cambio.codigo)
    return ejecutar(cambio.codigo, () => cambiarEstado(orden.idOrden, cambio.codigo, null))
  }

  return (
    <section className="panel-oscuro grid gap-6 p-5" aria-label="Qué sigue">
      <Encabezado titulo="Qué sigue" tamano="text-xl" />

      {/* RF22.1 */}
      {puede('diagnosticar') && (
        <form onSubmit={guardarDiagnostico} noValidate className="grid gap-3">
          <Area
            etiqueta="Diagnóstico"
            obligatorio
            filas={3}
            value={diagnostico}
            onChange={(evento) => { setDiagnostico(evento.target.value); setErrores({}) }}
            error={errores.diagnostico}
            maxLength={4000}
            disabled={trabajando !== null}
            placeholder="Qué se encontró al revisar el equipo."
            ayuda={estado.codigo === 'RECIBIDO' ? 'Al guardarlo, la orden pasa a «En diagnóstico» y queda a tu nombre.' : undefined}
          />
          <div>
            <Boton type="submit" cargando={trabajando === 'diagnostico'}>
              {orden.diagnosticoTecnico ? 'Actualizar el diagnóstico' : 'Guardar el diagnóstico'}
            </Boton>
          </div>
        </form>
      )}

      {/* RF22.3 — la respuesta del cliente. Las dos salidas pesan igual. */}
      {puede('responder') && (
        <div className="grid gap-3 border-2 border-crema/25 bg-crema/5 p-4">
          <p className="flex flex-wrap items-baseline gap-x-3 text-sm text-crema">
            <span className="font-semibold">Esperando la respuesta del cliente al presupuesto de</span>
            <Precio monto={orden.montoPresupuestado} tamano="text-xl" />
          </p>
          <Texto
            etiqueta="Observación"
            value={respuesta}
            onChange={(evento) => setRespuesta(evento.target.value)}
            maxLength={300}
            disabled={trabajando !== null}
            placeholder="Lo que dijo el cliente, si hace falta."
          />
          <div className="flex flex-wrap gap-3">
            <Boton
              cargando={trabajando === 'aprobo'}
              disabled={trabajando !== null}
              onClick={() => ejecutar('aprobo', () => responderPresupuesto(orden.idOrden, true, respuesta.trim() || null))}
            >
              El cliente aprobó
            </Boton>
            <Boton
              tono="papel"
              cargando={trabajando === 'rechazo'}
              disabled={trabajando !== null}
              onClick={() => ejecutar('rechazo', () => responderPresupuesto(orden.idOrden, false, respuesta.trim() || null))}
            >
              El cliente rechazó
            </Boton>
          </div>
        </div>
      )}

      {/* RF22.2 — se arma sobre un diagnóstico: sin él no hay qué presupuestar. */}
      {puede('presupuestar') && (
        <form onSubmit={guardarPresupuesto} noValidate className="grid gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <Texto
              etiqueta={estado.codigo === 'PRESUPUESTADO' ? 'Corregir el presupuesto' : 'Presupuesto'}
              obligatorio
              prefijo="$"
              inputMode="decimal"
              value={monto}
              onChange={(evento) => { setMonto(evento.target.value); setErrores({}) }}
              error={errores.monto}
              disabled={trabajando !== null || !orden.diagnosticoTecnico}
              className="w-48"
              ayuda={!orden.diagnosticoTecnico ? 'Primero el diagnóstico.' : 'Mano de obra. Los repuestos se suman aparte.'}
            />
            <Boton
              type="submit"
              tono={estado.codigo === 'PRESUPUESTADO' ? 'papel' : 'accion'}
              cargando={trabajando === 'presupuesto'}
              disabled={!orden.diagnosticoTecnico}
            >
              {estado.codigo === 'PRESUPUESTADO' ? 'Corregir el monto' : 'Registrar el presupuesto'}
            </Boton>
          </div>
        </form>
      )}

      {/* RF23.1 y RF23.4 */}
      {(puede('notificar') || puede('entregar')) && (
        <div className="flex flex-wrap items-center gap-3">
          {puede('notificar') && (
            <Boton onClick={() => setNotificando(true)} tono={orden.estado.codigo === 'NOTIFICADO' ? 'papel' : 'accion'}>
              {orden.estado.codigo === 'NOTIFICADO' ? 'Avisar de nuevo' : 'Avisar al cliente'}
            </Boton>
          )}
          {puede('entregar') && (
            <Boton onClick={() => setEntregando(true)} tono={orden.estado.codigo === 'NOTIFICADO' ? 'accion' : 'papel'}>
              Entregar el equipo
            </Boton>
          )}
          {orden.estado.codigo !== 'NOTIFICADO' && puede('entregar') && (
            <span className="text-xs text-crema/60">
              Lo ideal es avisarle primero: desde el aviso corre el plazo de retiro.
            </span>
          )}
        </div>
      )}

      {/* RF22.6 — cambios de estado que se eligen directamente. */}
      {(principales.length > 0 || secundarios.length > 0) && (
        <div className="flex flex-wrap items-center gap-3">
          {principales.map((cambio) => (
            <Boton
              key={cambio.codigo}
              cargando={trabajando === cambio.codigo}
              disabled={trabajando !== null}
              onClick={() => ejecutarCambio(cambio)}
            >
              {CAMBIOS[cambio.codigo].texto}
            </Boton>
          ))}

          {secundarios.map((cambio) => {
            const definicion = CAMBIOS[cambio.codigo]
            return (
              <Boton
                key={cambio.codigo}
                tono="papel"
                tamano={definicion?.suave ? 'chico' : 'normal'}
                title={definicion?.ayuda}
                cargando={trabajando === cambio.codigo}
                disabled={trabajando !== null}
                onClick={() => ejecutarCambio(cambio)}
              >
                {definicion?.texto ?? cambio.nombre}
              </Boton>
            )
          })}
        </div>
      )}

      {error && <Aviso tono="mal">{error}</Aviso>}

      <DialogoMotivo
        abierto={motivoDe !== null}
        titulo={motivoDe ? CAMBIOS[motivoDe].accion : ''}
        descripcion="Queda en el historial de la orden, junto con tu usuario y la fecha."
        etiqueta={motivoDe ? CAMBIOS[motivoDe].motivo : ''}
        textoAccion={motivoDe ? CAMBIOS[motivoDe].accion : ''}
        alCerrar={() => setMotivoDe(null)}
        alConfirmar={async (motivo) => {
          const { datos } = await cambiarEstado(orden.idOrden, motivoDe, motivo)
          setMotivoDe(null)
          alActualizar(datos)
        }}
      />

      <DialogoNotificar
        abierto={notificando}
        orden={orden}
        alCerrar={() => setNotificando(false)}
        alNotificar={async (medio, observacion) => {
          const { datos } = await notificarCliente(orden.idOrden, medio, observacion)
          setNotificando(false)
          alActualizar(datos)
        }}
      />

      <DialogoEntrega
        abierto={entregando}
        orden={orden}
        alCerrar={() => setEntregando(false)}
        alEntregar={async (conformidad, observacion) => {
          const { datos } = await entregarEquipo(orden.idOrden, conformidad, observacion)
          setEntregando(false)
          alActualizar(datos)
        }}
      />
    </section>
  )
}
