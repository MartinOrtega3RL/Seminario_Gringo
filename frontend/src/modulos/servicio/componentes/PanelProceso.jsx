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
import { IconoTilde, IconoFlecha } from '../../../ui/Iconos.jsx'
import { momentoDeOrden } from '../servicio.reglas.js'

// RF22.1, RF22.2, RF22.3 y RF22.6 — el recorrido de la orden.
//
// Lo que se puede hacer en cada estado lo decide el servidor y llega en
// `orden.operaciones` y `orden.cambios`: este panel dibuja eso y nada más. Si
// mañana el comercio agrega un paso al ciclo de vida, se cambia en un solo lugar.

// Cada cambio manual con su texto de botón. Los que llevan motivo abren el
// diálogo; el resto es un clic. Lo que no está acá se muestra con el nombre del
// estado, para que un estado nuevo no quede sin botón.
const CAMBIOS = {
  EN_DIAGNOSTICO: { texto: 'Tomar la orden', principal: true },
  EN_REPARACION: { texto: 'Empezar la reparación', principal: true },
  REPARADO: { texto: 'Dar por reparado', principal: true },
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
  // Qué se está corrigiendo de lo ya guardado: 'diagnostico', 'monto' o nada.
  const [corrigiendo, setCorrigiendo] = useState(null)

  // Al cambiar de orden o de estado el formulario vuelve a lo que dice la orden.
  useEffect(() => {
    setDiagnostico(orden.diagnosticoTecnico ?? '')
    setMonto(orden.montoPresupuestado ? String(Number(orden.montoPresupuestado)) : '')
    setRespuesta('')
    setErrores({})
    setError(null)
    setCorrigiendo(null)
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
    return ejecutar('diagnostico', () => registrarDiagnostico(orden.idOrden, diagnostico.trim())).then(() => setCorrigiendo(null))
  }

  const guardarPresupuesto = (evento) => {
    evento.preventDefault()
    const importe = Number(monto.replace(',', '.'))
    if (!(importe > 0)) return setErrores({ monto: 'El presupuesto tiene que ser mayor que cero.' })
    setErrores({})
    return ejecutar('presupuesto', () => registrarPresupuesto(orden.idOrden, importe)).then(() => setCorrigiendo(null))
  }

  const sinPasos = !puede('diagnosticar') && !puede('presupuestar') && !puede('responder')
    && cambios.length === 0 && !puede('notificar') && !puede('entregar')

  const momento = momentoDeOrden(estado.codigo)
  const cabecera = (
    <Encabezado
      titulo={momento.que}
      tamano="text-xl sm:text-2xl"
      derecha={momento.turno && <Turno quien={momento.turno} />}
    />
  )

  if (sinPasos) {
    return (
      <section className="panel-oscuro p-5" aria-label="Qué sigue">
        {cabecera}
      </section>
    )
  }

  // RF22.6 — para dar por reparado hace falta al menos una tarea: son las que
  // definen qué cubre la garantía. Se muestra como lista de lo que falta, en vez
  // de dejar que el técnico lo descubra por un error al apretar el botón.
  const enReparacion = estado.codigo === 'EN_REPARACION'
  const sinTareas = orden.tareas.length === 0

  const principales = cambios.filter((c) => CAMBIOS[c.codigo]?.principal)
  const secundarios = cambios.filter((c) => !CAMBIOS[c.codigo]?.principal)

  const ejecutarCambio = (cambio) => {
    const definicion = CAMBIOS[cambio.codigo]
    if (definicion?.motivo) return setMotivoDe(cambio.codigo)
    return ejecutar(cambio.codigo, () => cambiarEstado(orden.idOrden, cambio.codigo, null))
  }

  return (
    <section className="panel-oscuro grid gap-6 p-5" aria-label="Qué sigue">
      {cabecera}

      {/* Al diagnosticar se trabaja contra lo que contó el cliente: se tiene a
          la vista en vez de tener que bajar a buscarlo en la ficha. */}
      {puede('diagnosticar') && (
        <blockquote className="border-2 border-crema/20 bg-crema/5 px-4 py-3">
          <p className="text-xs font-semibold text-crema/60">Lo que dijo el cliente</p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-crema">{orden.fallaDeclarada}</p>
        </blockquote>
      )}

      {enReparacion && (
        <ol className="grid gap-3" aria-label="Para terminar la reparación">
          <Requisito
            hecho={!sinTareas}
            texto="Anotá cada tarea que hacés"
            detalle={sinTareas ? 'Es lo que cubre la garantía. Hace falta al menos una.' : `${orden.tareas.length} anotada${orden.tareas.length === 1 ? '' : 's'}.`}
          />
          <Requisito
            hecho={orden.repuestos.length > 0}
            opcional
            texto="Cargá los repuestos que uses"
            detalle={orden.repuestos.length > 0
              ? `${orden.repuestos.length} cargado${orden.repuestos.length === 1 ? '' : 's'}, descontado${orden.repuestos.length === 1 ? '' : 's'} del stock.`
              : 'Solo si usaste alguno: se descuenta del stock.'}
          />
        </ol>
      )}

      {/* Antes de diagnosticar, alguien toma la orden: queda a su nombre. Es un
          solo botón; el diagnóstico aparece recién después. */}
      {estado.codigo === 'RECIBIDO' && (
        <p className="max-w-prose text-sm leading-relaxed text-crema/70">
          Al tomarla, la orden queda a tu nombre y pasa a diagnóstico. Ahí anotás qué encontraste y cuánto sale.
        </p>
      )}

      {/* RF22.1 y RF22.2 — el diagnóstico va en dos pasos: primero qué se
          encontró, después cuánto sale. Sin diagnóstico no hay qué presupuestar. */}
      {estado.codigo === 'EN_DIAGNOSTICO' && (
        <ol className="grid gap-5" aria-label="Diagnóstico y presupuesto">
          <PasoInterno numero={1} titulo="Qué encontraste" hecho={Boolean(orden.diagnosticoTecnico)}>
            {orden.diagnosticoTecnico && corrigiendo !== 'diagnostico' ? (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="max-w-prose whitespace-pre-wrap text-sm leading-relaxed text-crema/85">{orden.diagnosticoTecnico}</p>
                <Boton tono="papel" tamano="chico" onClick={() => setCorrigiendo('diagnostico')}>Corregir</Boton>
              </div>
            ) : (
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
                />
                <div className="flex flex-wrap gap-3">
                  <Boton type="submit" cargando={trabajando === 'diagnostico'}>Guardar el diagnóstico</Boton>
                  {corrigiendo === 'diagnostico' && (
                    <Boton tono="desnudo" onClick={() => { setCorrigiendo(null); setDiagnostico(orden.diagnosticoTecnico ?? '') }}>
                      Cancelar
                    </Boton>
                  )}
                </div>
              </form>
            )}
          </PasoInterno>

          <PasoInterno numero={2} titulo="Cuánto sale" bloqueado={!orden.diagnosticoTecnico}>
            {orden.diagnosticoTecnico
              ? (
        <form onSubmit={guardarPresupuesto} noValidate className="flex flex-wrap items-end gap-3">
          <Texto
            etiqueta="Presupuesto"
            obligatorio
            prefijo="$"
            inputMode="decimal"
            value={monto}
            onChange={(evento) => { setMonto(evento.target.value); setErrores({}) }}
            error={errores.monto}
            disabled={trabajando !== null}
            className="w-48"
            ayuda="Mano de obra. Los repuestos se suman aparte."
          />
          <Boton type="submit" tono="accion" cargando={trabajando === 'presupuesto'}>Registrar el presupuesto</Boton>
        </form>
              )
              : <p className="text-sm text-crema/50">Primero guardá el diagnóstico.</p>}
          </PasoInterno>
        </ol>
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

      {/* Corregir el monto ya pasado es la excepción: queda detrás de un botón
          chico para no competir con la respuesta del cliente. */}
      {estado.codigo === 'PRESUPUESTADO' && puede('presupuestar') && (
        corrigiendo === 'monto'
          ? (
        <form onSubmit={guardarPresupuesto} noValidate className="flex flex-wrap items-end gap-3">
          <Texto
            etiqueta="Presupuesto"
            obligatorio
            prefijo="$"
            inputMode="decimal"
            value={monto}
            onChange={(evento) => { setMonto(evento.target.value); setErrores({}) }}
            error={errores.monto}
            disabled={trabajando !== null}
            className="w-48"
            ayuda="Mano de obra. Los repuestos se suman aparte."
          />
          <Boton type="submit" tono="papel" cargando={trabajando === 'presupuesto'}>Guardar el monto nuevo</Boton>
          <Boton tono="desnudo" onClick={() => { setCorrigiendo(null); setMonto(String(Number(orden.montoPresupuestado))) }}>Cancelar</Boton>
        </form>
          )
          : (
            <div>
              <Boton tono="desnudo" tamano="chico" onClick={() => setCorrigiendo('monto')}>
                Corregir el monto del presupuesto
              </Boton>
            </div>
          )
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

      {/* RF22.6 — el paso que sigue en el camino normal. */}
      {principales.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {principales.map((cambio) => {
            const trabado = cambio.codigo === 'REPARADO' && sinTareas
            return (
              <Boton
                key={cambio.codigo}
                cargando={trabajando === cambio.codigo}
                disabled={trabajando !== null || trabado}
                title={trabado ? 'Primero anotá al menos una tarea' : undefined}
                onClick={() => ejecutarCambio(cambio)}
              >
                {CAMBIOS[cambio.codigo]?.texto ?? cambio.nombre}
              </Boton>
            )
          })}
        </div>
      )}

      {/* Las salidas del camino normal (sin arreglo, anular) van aparte, abajo
          y más chicas: no compiten con lo que hay que hacer. */}
      {secundarios.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 border-t-2 border-crema/10 pt-4">
          <span className="text-xs text-crema/55">¿No se puede seguir?</span>
          {secundarios.map((cambio) => (
            <Boton
              key={cambio.codigo}
              tono="papel"
              tamano="chico"
              cargando={trabajando === cambio.codigo}
              disabled={trabajando !== null}
              onClick={() => ejecutarCambio(cambio)}
            >
              {CAMBIOS[cambio.codigo]?.texto ?? cambio.nombre}
            </Boton>
          ))}
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

/** A quién le toca mover la orden: el técnico, el mostrador o el cliente. */
const Turno = ({ quien }) => (
  <span className="inline-flex items-center border-2 border-crema/60 px-2.5 py-1 text-xs font-bold uppercase tracking-[0.14em] text-crema">
    Le toca al {quien.toLowerCase()}
  </span>
)

/**
 * Un paso de la lista para cerrar la reparación, con su estado a la vista. Lo
 * que falta lleva un enlace a donde se carga, que está más abajo en la ficha.
 */
const Requisito = ({ hecho, opcional = false, texto, detalle }) => (
  <li className="flex items-start gap-3">
    <span
      aria-hidden="true"
      className={`mt-0.5 grid size-6 shrink-0 place-items-center border-2 ${
        hecho ? 'border-crema bg-crema text-tinta' : opcional ? 'border-dashed border-crema/40' : 'border-escarlata'
      }`}
    >
      {hecho && <IconoTilde className="size-4" />}
    </span>
    <span className="grid gap-0.5">
      <span className="text-sm font-semibold text-crema">
        {texto}
        {opcional && <span className="ms-2 text-xs font-normal text-crema/55">opcional</span>}
        <span className="sr-only">{hecho ? ': listo' : ': falta'}</span>
      </span>
      <span className="text-xs leading-relaxed text-crema/65">
        {detalle}
        {!hecho && (
          <a href="#reparacion" className="ms-2 inline-flex items-center gap-1 font-semibold text-crema underline underline-offset-2 hover:no-underline">
            Ir a cargarlo <IconoFlecha className="size-3.5" />
          </a>
        )}
      </span>
    </span>
  </li>
)

/** Un paso dentro del diagnóstico: número, título y lo que se carga. */
const PasoInterno = ({ numero, titulo, hecho = false, bloqueado = false, children }) => (
  <li className="grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 gap-y-2">
    <span
      aria-hidden="true"
      className={`grid size-7 place-items-center border-2 text-xs font-bold ${
        hecho ? 'border-crema bg-crema text-tinta' : bloqueado ? 'border-crema/25 text-crema/40' : 'border-escarlata text-crema'
      }`}
    >
      {hecho ? <IconoTilde className="size-4" /> : <span className="numeral">{numero}</span>}
    </span>
    <p className={`self-center text-sm font-semibold ${bloqueado ? 'text-crema/45' : 'text-crema'}`}>
      {titulo}
      <span className="sr-only">{hecho ? ': listo' : bloqueado ? ': todavía no' : ': ahora'}</span>
    </p>
    <div className="col-start-2">{children}</div>
  </li>
)
