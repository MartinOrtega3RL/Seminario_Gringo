import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { buscarOrden, rutaOrden } from '../servicio.api.js'
import { abrirDocumento } from '../../../api/cliente.js'
import {
  nombreEquipo, tonoDeEstado, fechaHora, soloFecha, diasRestantes, SELLOS,
  nombreEstado, describirCambio, momentoDeOrden,
} from '../servicio.reglas.js'
import { RecorridoOrden } from '../componentes/RecorridoOrden.jsx'
import { PanelProceso } from '../componentes/PanelProceso.jsx'
import { PanelReparacion } from '../componentes/PanelReparacion.jsx'
import { GaleriaFotos } from '../componentes/GaleriaFotos.jsx'
import { LineaDeTiempo } from '../componentes/LineaDeTiempo.jsx'
import { Encabezado, Titulo, Precio } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoImprimir, IconoCampana, IconoTilde, IconoCerrar } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// La ficha de una orden de servicio: lo que antes era una hoja de papel por
// equipo (H05), con el recorrido de la reparación, la cuenta y la garantía.
//
// La parte de arriba a la izquierda es la ficha de ingreso, en el crema del papel:
// es lo que el cliente firmó y no cambia. Todo lo demás, que sí cambia, va sobre
// el azul.

const Dato = ({ rotulo, children, ancho = false }) => (
  <div className={ancho ? 'sm:col-span-2' : undefined}>
    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-tinta/55">{rotulo}</dt>
    <dd className="mt-0.5 text-sm font-semibold leading-snug text-tinta">{children}</dd>
  </div>
)

export const FichaOrden = () => {
  const { idOrden } = useParams()
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('SERVICIO_TECNICO')

  const [orden, setOrden] = useState(null)
  const [error, setError] = useState(null)
  const [errorDocumento, setErrorDocumento] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)

  // Cada guardado se confirma en pantalla con lo que quedó registrado y, si la
  // orden avanzó, con lo que sigue. El técnico no tiene que adivinar si el clic
  // tomó.
  const actualizar = (nueva) => {
    const texto = describirCambio(orden, nueva)
    if (texto) {
      const avanzo = orden && nueva.estado.codigo !== orden.estado.codigo
      const sigue = avanzo ? momentoDeOrden(nueva.estado.codigo) : null
      setConfirmacion({ texto, sigue, clave: Date.now() })
    }
    setOrden(nueva)
  }

  useEffect(() => {
    if (!confirmacion) return undefined
    const reloj = setTimeout(() => setConfirmacion(null), 7000)
    return () => clearTimeout(reloj)
  }, [confirmacion])

  // Solo la primera visita despues de recibir el equipo muestra el aviso de la
  // orden recien creada: recargar la pagina no debe repetirlo.
  const [recien, setRecien] = useState(ubicacion.state?.recien ?? false)
  const fotosFallidas = ubicacion.state?.fotosFallidas ?? 0

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const { datos } = await buscarOrden(idOrden)
      setOrden(datos)
    } catch (fallo) {
      setError(fallo)
    }
  }, [idOrden])

  useEffect(() => {
    setOrden(null)
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!recien) return undefined
    // El estado de la navegacion se limpia para que un F5 no vuelva a mostrarlo.
    navegar(ubicacion.pathname, { replace: true, state: null })
    return undefined
    // Una sola vez al llegar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const imprimir = async () => {
    setErrorDocumento(null)
    try {
      await abrirDocumento(rutaOrden(orden.idOrden))
    } catch (fallo) {
      setErrorDocumento(fallo.message)
    }
  }

  if (error) {
    return error.estado === 404 ? (
      <Vacio
        titulo="Esa orden no existe"
        detalle="Puede que el número esté mal. Buscala en el listado de órdenes."
        accion={<Boton tono="papel" onClick={() => navegar('/servicio')}>Ir a las órdenes</Boton>}
      />
    ) : (
      <Fallo error={error} reintentar={cargar} />
    )
  }

  if (!orden) return <Cargando filas={4} etiqueta="Abriendo la orden" />

  const persona = orden.cliente.persona
  const liq = orden.liquidacion
  const hayCuenta = Number(orden.montoPresupuestado ?? 0) > 0 || orden.repuestos.length > 0

  return (
    <div className="grid gap-5">
      <div>
        <Link to="/servicio" className="text-xs font-semibold uppercase tracking-wide text-crema/60 hover:text-crema">
          ← Órdenes de servicio
        </Link>

        <Encabezado
          className="mt-2"
          titulo={orden.numeroOrden}
          tamano="text-4xl"
          derecha={
            <div className="flex flex-wrap items-center gap-3">
              <Marca tono={tonoDeEstado(orden.estado.codigo, orden.noRetirada)}>{nombreEstado(orden.estado)}</Marca>
              <Boton tono="papel" onClick={imprimir}>
                <IconoImprimir className="size-5" />
                Imprimir la orden
              </Boton>
            </div>
          }
        />
      </div>

      {recien && orden.estado.codigo === 'RECIBIDO' && orden.historial.length === 1 && (
        <Aviso tono="bien">
          Equipo recibido. Imprimí la orden y dásela al cliente: la necesita para retirar el equipo.
        </Aviso>
      )}
      {fotosFallidas > 0 && (
        <Aviso tono="mal">
          {fotosFallidas === 1 ? 'Una foto no se pudo subir.' : `${fotosFallidas} fotos no se pudieron subir.`}{' '}
          La orden quedó guardada: volvé a agregarlas abajo, en «Fotos».
        </Aviso>
      )}
      {errorDocumento && <Aviso tono="mal">{errorDocumento}</Aviso>}

      {orden.noRetirada && (
        <div role="status" className="flex items-start gap-3 border-2 border-escarlata bg-escarlata/15 px-4 py-3">
          <IconoCampana className="mt-0.5 size-5 shrink-0 text-escarlata" />
          <p className="text-sm text-crema">
            <strong className="font-semibold">
              Lleva {orden.diasDesdeNotificacion} días sin retirar: el plazo es de {orden.reglas.plazoRetiroDias}.
            </strong>{' '}
            <span className="text-crema/75">
              Al entregarlo se suma el recargo del {orden.reglas.recargoPct}% por demora.
            </span>
          </p>
        </div>
      )}

      <RecorridoOrden orden={orden} />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid gap-5">
          {escritura && <PanelProceso orden={orden} alActualizar={actualizar} />}

          <div id="reparacion" className="scroll-mt-4">
            <PanelReparacion orden={orden} alActualizar={actualizar} />
          </div>

          {/* Mientras se puede editar, el diagnostico vive en «Que sigue»; despues
              queda a la vista, de solo lectura. */}
          {orden.diagnosticoTecnico && !(escritura && orden.operaciones.includes('diagnosticar')) && (
            <section className="panel-oscuro p-5">
              <Titulo nivel={3} className="text-base">Diagnóstico</Titulo>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-crema/85">{orden.diagnosticoTecnico}</p>
            </section>
          )}

          {/* La ficha de ingreso: el papel. Lo que se firmo no cambia. */}
          <section className="panel p-5" aria-label="Ficha de ingreso">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              <Dato rotulo="Cliente">
                {persona.apellidoNombre}
                {persona.numeroDocumento && (
                  <span className="block text-xs font-normal text-tinta/65">
                    {persona.tipoDocumento} {persona.numeroDocumento}
                  </span>
                )}
              </Dato>
              <Dato rotulo="WhatsApp">{persona.telefonoWhatsapp ?? <span className="font-normal text-tinta/55">Sin cargar</span>}</Dato>

              <Dato rotulo="Equipo">
                {nombreEquipo(orden.dispositivo)}
                {orden.dispositivo.color && <span className="font-normal text-tinta/65"> · {orden.dispositivo.color}</span>}
              </Dato>
              <Dato rotulo="IMEI o n.º de serie">
                <span className="numeral">{orden.dispositivo.imeiSerie ?? <span className="font-normal text-tinta/55">No se pudo leer</span>}</span>
              </Dato>

              <Dato rotulo="Ingresó">
                <span className="numeral">{fechaHora(orden.fechaIngreso)}</span>
                <span className="block text-xs font-normal text-tinta/65">Recibió {orden.recibidoPor.nombreUsuario}</span>
              </Dato>
              <Dato rotulo="Técnico">
                {orden.tecnico?.nombreUsuario ?? <span className="font-normal text-tinta/55">Todavía sin asignar</span>}
              </Dato>

              <Dato rotulo="Falla declarada" ancho>
                <span className="whitespace-pre-wrap font-normal">{orden.fallaDeclarada}</span>
              </Dato>
              <Dato rotulo="Estado al ingresar" ancho>
                <span className="whitespace-pre-wrap font-normal">{orden.estadoIngreso}</span>
              </Dato>

              <Dato rotulo="Accesorios que dejó">{orden.accesoriosRecibidos ?? <span className="font-normal text-tinta/55">Ninguno</span>}</Dato>
              <Dato rotulo="Sellos del comercio">
                {SELLOS[orden.estadoSellos]}
                {orden.estadoSellos === 'VIOLADOS' && <span className="block text-xs font-normal text-escarlata">Anulan la garantía anterior</span>}
              </Dato>
            </dl>

            {/* RF24.3 — si es un reingreso, de que reparacion viene y como estaba
                su garantia el dia que volvio. */}
            {orden.ordenAnterior && (
              <div className="mt-4 border-t-2 border-tinta/15 pt-3 text-sm text-tinta">
                <span className="font-semibold">Reingreso por garantía de </span>
                <Link to={`/servicio/${orden.ordenAnterior.idOrden}`} className="numeral font-bold underline underline-offset-2">
                  {orden.ordenAnterior.numeroOrden}
                </Link>
                {orden.garantiaAlIngresar && (
                  <span className={orden.garantiaAlIngresar.vigente ? 'text-tinta/75' : 'font-semibold text-escarlata'}>
                    {' '}· {orden.garantiaAlIngresar.vigente
                      ? `la garantía estaba vigente (vencía el ${soloFecha(orden.garantiaAlIngresar.vence)})`
                      : orden.garantiaAlIngresar.mensaje}
                  </span>
                )}
              </div>
            )}
          </section>

          <section className="panel-oscuro grid gap-3 p-5" aria-label="Fotos">
            <Titulo nivel={3} className="text-base">Fotos</Titulo>
            <GaleriaFotos
              idOrden={orden.idOrden}
              fotos={orden.fotos}
              puedeAgregar={escritura && orden.estado.codigo !== 'ANULADA'}
              alActualizar={actualizar}
            />
          </section>
        </div>

        <aside className="grid gap-5 lg:sticky lg:top-4">
          {/* La cuenta: el total en ámbar y el cuerpo mayor de la columna, como
              en la venta. */}
          <section className="panel-oscuro grid gap-3 p-5" aria-label="Cuenta de la orden">
            <Titulo nivel={3} className="text-base">Cuenta</Titulo>

            {!hayCuenta && (
              <p className="text-sm text-crema/60">Todavía no hay presupuesto ni repuestos.</p>
            )}

            {hayCuenta && (
              <dl className="grid gap-1.5 text-sm">
                {Number(liq.presupuesto) > 0 && <Cuenta rotulo="Presupuesto" monto={liq.presupuesto} />}
                {Number(liq.repuestos) > 0 && <Cuenta rotulo="Repuestos" monto={liq.repuestos} />}
                {Number(liq.recargo) > 0 && (
                  <Cuenta rotulo={`Recargo por demora (${orden.reglas.recargoPct}%)`} monto={liq.recargo} />
                )}
              </dl>
            )}

            <div className="flex items-baseline justify-between gap-3 border-t-2 border-crema/20 pt-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-crema/70">
                {liq.definitiva ? 'Cobrado' : 'Total hasta ahora'}
              </span>
              <Precio monto={liq.total} tamano="text-3xl" />
            </div>
            {!liq.definitiva && Number(liq.total) > 0 && (
              <p className="text-xs leading-relaxed text-crema/55">Se cobra al entregar el equipo.</p>
            )}
            {liq.definitiva && Number(liq.total) === 0 && (
              <p className="text-xs leading-relaxed text-crema/55">No se reparó: no hay nada que cobrar.</p>
            )}
          </section>

          {/* RF24.1 / RF24.2 */}
          {orden.garantiaPropia && (
            <section className="panel-oscuro grid gap-2 p-5" aria-label="Garantía">
              <div className="flex items-center justify-between gap-3">
                <Titulo nivel={3} className="text-base">Garantía</Titulo>
                <Marca tono={orden.garantiaPropia.vigente ? 'destacado' : 'neutro'}>
                  {orden.garantiaPropia.vigente ? 'Vigente' : 'Vencida'}
                </Marca>
              </div>
              <p className="text-sm text-crema/85">
                {orden.garantiaPropia.vigente
                  ? `Hasta el ${soloFecha(orden.garantiaPropia.vence)} · ${diasRestantes(orden.garantiaPropia.diasRestantes)}.`
                  : `Venció el ${soloFecha(orden.garantiaPropia.vence)}.`}
              </p>
              <p className="text-xs leading-relaxed text-crema/55">
                {orden.reglas.garantiaDias} días corridos desde la entrega. Cubre lo que figura en las tareas
                realizadas, y se anula si el equipo vuelve con los sellos rotos.
              </p>
            </section>
          )}

          <section className="panel-oscuro grid gap-4 p-5" aria-label="Historial">
            <Titulo nivel={3} className="text-base">Historial</Titulo>
            <LineaDeTiempo historial={orden.historial} />
          </section>
        </aside>
      </div>

      {/* El aviso de lo guardado flota abajo: el técnico suele estar abajo de
          todo, anotando tareas, y un aviso arriba de la página no lo vería. */}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-4 bottom-4 z-40 flex justify-end sm:inset-x-auto sm:right-6 sm:bottom-6">
        {confirmacion && (
          <div
            key={confirmacion.clave}
            role="status"
            className="aviso-guardado pointer-events-auto flex w-full max-w-sm items-start gap-3 border-2 border-tinta bg-crema px-4 py-3 text-tinta shadow-[0_10px_30px_-8px_rgb(0_0_0/0.55)]"
          >
            <span className="mt-0.5 grid size-6 shrink-0 place-items-center bg-tinta text-crema" aria-hidden="true">
              <IconoTilde className="size-4" />
            </span>
            <span className="grid flex-1 gap-1">
              <span className="text-sm font-semibold leading-snug">{confirmacion.texto}</span>
              {confirmacion.sigue?.que && (
                <span className="text-xs leading-snug text-tinta/70">
                  Sigue: {confirmacion.sigue.que.toLowerCase()}
                  {confirmacion.sigue.turno && ` (le toca al ${confirmacion.sigue.turno.toLowerCase()})`}.
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => setConfirmacion(null)}
              aria-label="Cerrar el aviso"
              className="grid size-6 shrink-0 place-items-center text-tinta/60 hover:text-tinta"
            >
              <IconoCerrar className="size-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const Cuenta = ({ rotulo, monto }) => (
  <div className="flex items-baseline justify-between gap-3">
    <dt className="text-crema/75">{rotulo}</dt>
    <dd><Precio monto={monto} tamano="text-lg" /></dd>
  </div>
)
