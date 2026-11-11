import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { cargarArchivo } from '../../../api/cliente.js'
import {
  eliminarRecepcion,
  actualizarLineasRecepcion,
  buscarRecepcion,
  confirmarRecepcion,
  rutaImagenComprobante,
} from '../recepciones.api.js'
import {
  ESTADOS_RECEPCION,
  ORIGENES_RECEPCION,
  TONOS_RECEPCION,
  calcularTotalRecepcion,
  esLecturaDudosa,
  todasConProducto,
} from '../recepciones.reglas.js'
import { ElegirProducto } from '../../existencias/componentes/ElegirProducto.jsx'
import { DialogoProductoRapido } from '../componentes/DialogoProductoRapido.jsx'
import { fechaHora, pesos } from '../../servicio/servicio.reglas.js'
import { useSesion } from '../../../app/sesion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Marca } from '../../../ui/Listado.jsx'
import { Cargando, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { IconoMas, IconoQuitar } from '../../../ui/Iconos.jsx'

export const ValidacionRecepcion = () => {
  const { id } = useParams()
  const navegar = useNavigate()
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CATALOGO_STOCK')

  const [recepcion, setRecepcion] = useState(null)
  const [lineas, setLineas] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const [urlImagen, setUrlImagen] = useState(null)
  const [zoom, setZoom] = useState(100)
  const [verTextoOcr, setVerTextoOcr] = useState(false)

  const [guardando, setGuardando] = useState(false)
  const [mensajeOk, setMensajeOk] = useState(null)
  const [errorAccion, setErrorAccion] = useState(null)
  const [lineaParaCrear, setLineaParaCrear] = useState(null) // { indice, linea }

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { datos } = await buscarRecepcion(id)
      setRecepcion(datos)
      setLineas(
        (datos.lineas ?? []).map((l) => ({
          idProducto: l.idProducto ?? null,
          producto: l.producto ?? null,
          descripcionOriginal: l.descripcionOriginal ?? '',
          cantidad: l.cantidad,
          precioCosto: l.precioCosto,
        })),
      )
    } catch (fallo) {
      setError(fallo)
    } finally {
      setCargando(false)
    }
  }, [id])

  useEffect(() => {
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!recepcion?.tieneImagen) {
      setUrlImagen(null)
      return undefined
    }

    let revocar = null
    let activo = true
    cargarArchivo(rutaImagenComprobante(recepcion.idRecepcion))
      .then((url) => {
        if (!activo) {
          URL.revokeObjectURL(url)
          return
        }
        revocar = url
        setUrlImagen(url)
      })
      .catch(() => {
        if (activo) setUrlImagen(null)
      })

    return () => {
      activo = false
      if (revocar) URL.revokeObjectURL(revocar)
    }
  }, [recepcion?.idRecepcion, recepcion?.tieneImagen])

  const actualizarLinea = (indice, patch) => {
    setMensajeOk(null)
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...patch } : l)))
  }

  const quitarLinea = (indice) => {
    setMensajeOk(null)
    setLineas((prev) => prev.filter((_, i) => i !== indice))
  }

  const agregarLinea = () => {
    setMensajeOk(null)
    setLineas((prev) => [
      ...prev,
      { idProducto: null, producto: null, descripcionOriginal: '', cantidad: 1, precioCosto: 0 },
    ])
  }

  const normalizarLineas = () =>
    lineas.map((l) => ({
      idProducto: l.idProducto || null,
      descripcionOriginal: l.descripcionOriginal?.trim() || null,
      cantidad: Number(l.cantidad) || 0,
      precioCosto: Number(l.precioCosto) || 0,
    }))

  const guardarBorrador = async () => {
    setGuardando(true)
    setErrorAccion(null)
    setMensajeOk(null)
    try {
      const { datos } = await actualizarLineasRecepcion(recepcion.idRecepcion, normalizarLineas())
      setRecepcion(datos)
      setMensajeOk('Cambios guardados en el borrador.')
    } catch (fallo) {
      setErrorAccion(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  const confirmar = async () => {
    setGuardando(true)
    setErrorAccion(null)
    setMensajeOk(null)
    try {
      await actualizarLineasRecepcion(recepcion.idRecepcion, normalizarLineas())
      const { datos } = await confirmarRecepcion(recepcion.idRecepcion)
      setRecepcion(datos)
      setLineas(
        (datos.lineas ?? []).map((l) => ({
          idProducto: l.idProducto ?? null,
          producto: l.producto ?? null,
          descripcionOriginal: l.descripcionOriginal ?? '',
          cantidad: l.cantidad,
          precioCosto: l.precioCosto,
        })),
      )
      setMensajeOk('Ingreso confirmado: se actualizaron existencias y precios de costo.')
    } catch (fallo) {
      setErrorAccion(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  // La recepcion se borra y su numero de comprobante queda libre para volver
  // a cargarla; lo que tenia queda registrado en la bitacora.
  const eliminar = async () => {
    if (!window.confirm('¿Eliminar esta recepción pendiente? Queda registrada en la bitácora y su número de comprobante se puede volver a cargar.')) return
    setGuardando(true)
    setErrorAccion(null)
    setMensajeOk(null)
    try {
      await eliminarRecepcion(recepcion.idRecepcion)
      navegar('/productos/recepciones')
    } catch (fallo) {
      setErrorAccion(fallo.message)
      setGuardando(false)
    }
  }

  if (error) return <Fallo error={error} reintentar={cargar} />
  if (cargando && !recepcion) return <Cargando filas={6} etiqueta="Abriendo recepción" />
  if (!recepcion) return null

  const editable = escritura && recepcion.estado === 'PENDIENTE_VALIDACION'
  const lineasNormalizadas = normalizarLineas()
  const totalCalculado = calcularTotalRecepcion(lineasNormalizadas)
  const puedeConfirmar = editable && todasConProducto(lineasNormalizadas) && !guardando
  const dudaOcr = esLecturaDudosa(recepcion.extraccion)

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-black bg-azul-hondo p-4">
        <div>
          <Link
            to="/productos/recepciones"
            className="text-xs font-bold uppercase tracking-wider text-ambar hover:underline"
          >
            ← Volver a recepciones
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <h2 className="font-[family-name:var(--font-cartel)] text-2xl uppercase text-crema">
              {recepcion.proveedor?.nombre} · {recepcion.tipoComprobante}{' '}
              {recepcion.numeroComprobante || `#${recepcion.idRecepcion}`}
            </h2>
            <Marca tono={TONOS_RECEPCION[recepcion.estado] ?? 'neutro'}>
              {ESTADOS_RECEPCION[recepcion.estado] ?? recepcion.estado}
            </Marca>
          </div>
          <p className="mt-1 text-xs text-crema/65">
            {ORIGENES_RECEPCION[recepcion.origenCarga] ?? recepcion.origenCarga}
            {' · '}Registrada {fechaHora(recepcion.fechaRegistro)}
            {recepcion.usuario?.nombreUsuario ? ` por ${recepcion.usuario.nombreUsuario}` : ''}
            {recepcion.fechaConfirmacion ? ` · Confirmada ${fechaHora(recepcion.fechaConfirmacion)}` : ''}
          </p>
        </div>

        <div className="text-right">
          <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
            Total comprobante
          </span>
          <span className="numeral font-[family-name:var(--font-cartel)] text-3xl text-ambar">
            ${pesos(totalCalculado)}
          </span>
        </div>
      </div>

      {recepcion.extraccion && (
        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-crema/20 bg-azul-hondo px-4 py-3 text-xs text-crema">
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-bold uppercase tracking-wider text-crema/75">
                {recepcion.extraccion.motorOcr || 'OCR'}
              </span>
              {recepcion.extraccion.confianzaPromedio !== null && (
                <Marca tono={dudaOcr ? 'alerta' : 'destacado'}>
                  Confianza: {recepcion.extraccion.confianzaPromedio}%
                </Marca>
              )}
              <span className="text-crema/60">
                Estado extracción: {recepcion.extraccion.estado}
              </span>
            </div>

            {recepcion.extraccion.textoExtraido && (
              <button
                type="button"
                onClick={() => setVerTextoOcr((v) => !v)}
                className="font-bold uppercase tracking-wider text-ambar hover:underline"
              >
                {verTextoOcr ? 'Ocultar texto leído' : 'Ver texto leído'}
              </button>
            )}
          </div>

          {recepcion.extraccion.estado === 'ERROR' && (
            <Aviso tono="mal">
              El OCR no pudo leer la imagen ({recepcion.extraccion.mensajeError}). Podés cargar las líneas manualmente.
            </Aviso>
          )}

          {dudaOcr && (
            <Aviso tono="mal">
              Revisá con cuidado: la lectura fue dudosa (confianza {recepcion.extraccion.confianzaPromedio}%).
            </Aviso>
          )}

          {verTextoOcr && recepcion.extraccion.textoExtraido && (
            <pre className="max-h-56 overflow-auto border-2 border-black bg-tinta/70 p-3 text-xs text-crema/85">
              {recepcion.extraccion.textoExtraido}
            </pre>
          )}
        </div>
      )}

      {mensajeOk && <Aviso tono="bien">{mensajeOk}</Aviso>}
      {errorAccion && <Aviso tono="mal">{errorAccion}</Aviso>}

      <div className={recepcion.tieneImagen ? 'grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:items-start' : 'grid gap-6'}>
        {recepcion.tieneImagen && (
          <section className="border-2 border-black bg-azul-hondo p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-crema/75">
                Comprobante adjunto
              </h3>
              <div className="flex items-center gap-1.5 text-xs">
                <Boton tamano="chico" tono="papel" onClick={() => setZoom((z) => Math.max(100, z - 50))}>
                  −
                </Boton>
                <span className="numeral w-12 text-center font-bold text-crema">{zoom}%</span>
                <Boton tamano="chico" tono="papel" onClick={() => setZoom((z) => Math.min(250, z + 50))}>
                  +
                </Boton>
              </div>
            </div>

            <div className="max-h-[70vh] overflow-auto border-2 border-crema/15 bg-tinta/60 p-2">
              {urlImagen ? (
                <img
                  src={urlImagen}
                  alt="Imagen del comprobante de recepción"
                  style={{ width: `${zoom}%`, maxWidth: 'none' }}
                  className="block h-auto"
                />
              ) : (
                <p className="py-10 text-center text-xs text-crema/60">Cargando comprobante…</p>
              )}
            </div>
          </section>
        )}

        <section className="grid gap-4 border-2 border-black bg-azul-hondo p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-crema/75">
              Líneas del ingreso ({lineas.length})
            </h3>
            {editable && (
              <Boton tamano="chico" tono="papel" onClick={agregarLinea} disabled={guardando}>
                <IconoMas /> Agregar línea
              </Boton>
            )}
          </div>

          {lineas.length === 0 ? (
            <p className="border-2 border-dashed border-crema/20 px-4 py-8 text-center text-sm text-crema/60">
              No hay líneas cargadas todavía. Usá «Agregar línea» para asociar los productos del comprobante.
            </p>
          ) : (
            <div className="grid gap-3">
              {lineas.map((linea, indice) => (
                <div
                  key={indice}
                  className={`grid gap-3 border-2 p-3 ${
                    !linea.idProducto ? 'border-escarlata/70 bg-escarlata/10' : 'border-crema/15 bg-tinta/35'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-crema/65">
                      Línea #{indice + 1}
                    </span>
                    {editable && (
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() => quitarLinea(indice)}
                        className="inline-flex items-center gap-1 text-xs text-crema/55 hover:text-escarlata"
                      >
                        <IconoQuitar className="size-3.5" /> Quitar
                      </button>
                    )}
                  </div>

                  {linea.descripcionOriginal && (
                    <p className="border-l-2 border-ambar/60 pl-2.5 text-xs text-crema/80">
                      <span className="font-semibold text-ambar">Original OCR:</span>{' '}
                      {linea.descripcionOriginal}
                    </p>
                  )}

                  {editable ? (
                    <div className="grid gap-2">
                      <ElegirProducto
                        etiqueta="Producto del catálogo"
                        elegido={linea.producto}
                        enfocar={false}
                        deshabilitado={guardando}
                        alElegir={(prod) =>
                          actualizarLinea(indice, {
                            idProducto: prod?.idProducto ?? null,
                            producto: prod,
                          })
                        }
                      />
                      {!linea.idProducto && (
                        <div>
                          <button
                            type="button"
                            disabled={guardando}
                            onClick={() => setLineaParaCrear({ indice, linea })}
                            className="text-xs font-bold uppercase tracking-wider text-ambar hover:underline"
                          >
                            + No está en el catálogo: crear o buscar parecidos
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm font-semibold text-crema">
                      {linea.producto
                        ? `${linea.producto.codigoInterno} · ${linea.producto.denominacion}`
                        : 'Sin producto asociado'}
                    </p>
                  )}

                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-crema/65">
                        Cantidad
                      </label>
                      {editable ? (
                        <input
                          type="number"
                          min="1"
                          max="999999"
                          disabled={guardando}
                          value={linea.cantidad}
                          onChange={(e) => actualizarLinea(indice, { cantidad: e.target.value })}
                          className="numeral h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
                        />
                      ) : (
                        <span className="numeral text-sm font-semibold text-crema">
                          {linea.cantidad}
                        </span>
                      )}
                    </div>

                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase text-crema/65">
                        Costo comprobante ($)
                      </label>
                      {editable ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          disabled={guardando}
                          value={linea.precioCosto}
                          onChange={(e) => actualizarLinea(indice, { precioCosto: e.target.value })}
                          className="numeral h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
                        />
                      ) : (
                        <span className="numeral text-sm font-semibold text-crema">
                          ${pesos(linea.precioCosto)}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <span className="mb-1 block text-[11px] font-semibold uppercase text-crema/65">
                        Subtotal
                      </span>
                      <span className="numeral inline-block pt-1.5 text-base font-bold text-ambar">
                        ${pesos((Number(linea.cantidad) || 0) * (Number(linea.precioCosto) || 0))}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {editable && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-crema/15 pt-4">
              <Boton tono="papel" onClick={eliminar} disabled={guardando}>
                Eliminar recepción
              </Boton>

              <div className="flex flex-wrap gap-2">
                <Boton tono="papel" onClick={guardarBorrador} disabled={guardando}>
                  Guardar borrador
                </Boton>
                <Boton
                  onClick={confirmar}
                  cargando={guardando}
                  disabled={!puedeConfirmar}
                >
                  Confirmar ingreso
                </Boton>
              </div>
            </div>
          )}
        </section>
      </div>

      <DialogoProductoRapido
        linea={lineaParaCrear?.linea ?? null}
        alCerrar={() => setLineaParaCrear(null)}
        alAsociarExistente={(prod) => {
          actualizarLinea(lineaParaCrear.indice, {
            idProducto: prod.idProducto,
            producto: prod,
          })
          setLineaParaCrear(null)
        }}
        alCrearYAsociar={(prod) => {
          actualizarLinea(lineaParaCrear.indice, {
            idProducto: prod.idProducto,
            producto: prod,
          })
          setMensajeOk(`Producto "${prod.denominacion}" creado (${prod.codigoInterno}) y asociado a la línea.`)
          setLineaParaCrear(null)
        }}
      />
    </div>
  )
}

