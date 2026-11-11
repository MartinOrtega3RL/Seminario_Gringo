import { useEffect, useState } from 'react'
import {
  crearRecepcionManual,
  crearRecepcionOcr,
  listarProveedoresRecepcion,
} from '../recepciones.api.js'
import {
  TIPOS_COMPROBANTE,
  calcularTotalRecepcion,
  todasConProducto,
} from '../recepciones.reglas.js'
import { ElegirProducto } from '../../existencias/componentes/ElegirProducto.jsx'
import { pesos } from '../../servicio/servicio.reglas.js'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { IconoMas, IconoQuitar } from '../../../ui/Iconos.jsx'

const LINEA_VACIA = () => ({ idProducto: null, producto: null, cantidad: 1, precioCosto: '' })

export const DialogoNuevaRecepcion = ({ abierto, alCerrar, alCrear }) => {
  const [modo, setModo] = useState('MANUAL')
  const [proveedores, setProveedores] = useState([])
  const [idProveedor, setIdProveedor] = useState('')
  const [tipoComprobante, setTipoComprobante] = useState('FACTURA')
  const [numeroComprobante, setNumeroComprobante] = useState('')
  const [fechaComprobante, setFechaComprobante] = useState('')
  const [lineas, setLineas] = useState([LINEA_VACIA()])
  const [archivo, setArchivo] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!abierto) return
    setError(null)
    setEnviando(false)
    setLineas([LINEA_VACIA()])
    setArchivo(null)
    setNumeroComprobante('')
    setFechaComprobante('')
    listarProveedoresRecepcion()
      .then(({ datos }) => {
        setProveedores(datos ?? [])
        if (datos?.[0]) setIdProveedor((prev) => prev || String(datos[0].idProveedor))
      })
      .catch(() => setProveedores([]))
  }, [abierto])

  const actualizarLinea = (indice, patch) =>
    setLineas((prev) => prev.map((l, i) => (i === indice ? { ...l, ...patch } : l)))

  const quitarLinea = (indice) =>
    setLineas((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== indice) : prev))

  const lineasNormalizadas = lineas.map((l) => ({
    idProducto: l.idProducto,
    cantidad: Number(l.cantidad) || 0,
    precioCosto: Number(l.precioCosto === '' ? -1 : l.precioCosto),
  }))

  const manualValido = Boolean(idProveedor) && todasConProducto(lineasNormalizadas)
  const ocrValido = Boolean(idProveedor) && Boolean(archivo)

  const enviar = async (evento) => {
    evento.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      let respuesta
      if (modo === 'MANUAL') {
        respuesta = await crearRecepcionManual({
          idProveedor: Number(idProveedor),
          tipoComprobante,
          numeroComprobante: numeroComprobante.trim() || null,
          fechaComprobante: fechaComprobante || null,
          lineas: lineasNormalizadas,
        })
      } else {
        const formulario = new FormData()
        formulario.append('idProveedor', String(idProveedor))
        formulario.append('tipoComprobante', tipoComprobante)
        if (numeroComprobante.trim()) formulario.append('numeroComprobante', numeroComprobante.trim())
        if (fechaComprobante) formulario.append('fechaComprobante', fechaComprobante)
        formulario.append('imagen', archivo)
        respuesta = await crearRecepcionOcr(formulario)
      }
      alCrear(respuesta.datos)
    } catch (fallo) {
      setError(fallo.message)
      setEnviando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={() => !enviando && alCerrar()}
      titulo="Nueva recepción de mercadería"
      descripcion="Cargá el comprobante del proveedor a mano o digitalizándolo con OCR antes de impactar el stock."
      pie={
        <div className="flex justify-end gap-2">
          <Boton tono="papel" type="button" disabled={enviando} onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton
            type="submit"
            form="form-nueva-recepcion"
            cargando={enviando}
            disabled={modo === 'MANUAL' ? !manualValido : !ocrValido}
          >
            {modo === 'OCR' ? (enviando ? 'Procesando OCR…' : 'Subir y extraer') : 'Crear recepción'}
          </Boton>
        </div>
      }
    >
      <form id="form-nueva-recepcion" onSubmit={enviar} className="grid gap-4">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={enviando}
            onClick={() => setModo('MANUAL')}
            className={`border-2 px-3 py-2 text-xs font-bold uppercase tracking-wider ${
              modo === 'MANUAL'
                ? 'border-black bg-ambar text-tinta'
                : 'border-crema/25 bg-tinta/40 text-crema/75'
            }`}
          >
            Cargar a mano
          </button>
          <button
            type="button"
            disabled={enviando}
            onClick={() => setModo('OCR')}
            className={`border-2 px-3 py-2 text-xs font-bold uppercase tracking-wider ${
              modo === 'OCR'
                ? 'border-black bg-ambar text-tinta'
                : 'border-crema/25 bg-tinta/40 text-crema/75'
            }`}
          >
            Desde una foto del comprobante
          </button>
        </div>

        <div>
          <label
            htmlFor="rec-proveedor"
            className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
          >
            Proveedor
          </label>
          <select
            id="rec-proveedor"
            value={idProveedor}
            disabled={enviando || proveedores.length === 0}
            onChange={(e) => setIdProveedor(e.target.value)}
            className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-sm font-semibold text-tinta"
          >
            {proveedores.map((p) => (
              <option key={p.idProveedor} value={p.idProveedor}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <label
              htmlFor="rec-tipo"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
            >
              Tipo
            </label>
            <select
              id="rec-tipo"
              value={tipoComprobante}
              disabled={enviando}
              onChange={(e) => setTipoComprobante(e.target.value)}
              className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
            >
              {TIPOS_COMPROBANTE.map(([valor, texto]) => (
                <option key={valor} value={valor}>{texto}</option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="rec-numero"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
            >
              Nro. comprobante
            </label>
            <input
              id="rec-numero"
              type="text"
              maxLength={40}
              disabled={enviando}
              value={numeroComprobante}
              onChange={(e) => setNumeroComprobante(e.target.value)}
              placeholder="0001-00001234"
              className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm text-tinta"
            />
          </div>

          <div>
            <label
              htmlFor="rec-fecha"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
            >
              Fecha comp.
            </label>
            <input
              id="rec-fecha"
              type="date"
              disabled={enviando}
              value={fechaComprobante}
              onChange={(e) => setFechaComprobante(e.target.value)}
              className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm text-tinta"
            />
          </div>
        </div>

        {modo === 'MANUAL' ? (
          <div className="grid gap-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
                Artículos del comprobante
              </span>
              <span className="numeral text-sm font-bold text-ambar">
                Total: ${pesos(calcularTotalRecepcion(lineasNormalizadas.map((l) => ({
                  ...l,
                  precioCosto: l.precioCosto < 0 ? 0 : l.precioCosto,
                }))))}
              </span>
            </div>

            {lineas.map((linea, indice) => (
              <div key={indice} className="grid gap-2 border-2 border-crema/15 bg-tinta/35 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase text-crema/60">
                    Línea {indice + 1}
                  </span>
                  {lineas.length > 1 && (
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={() => quitarLinea(indice)}
                      className="inline-flex items-center gap-1 text-xs text-crema/55 hover:text-escarlata"
                    >
                      <IconoQuitar className="size-3.5" /> Quitar
                    </button>
                  )}
                </div>

                <ElegirProducto
                  etiqueta="Producto"
                  elegido={linea.producto}
                  enfocar={false}
                  deshabilitado={enviando}
                  alElegir={(prod) =>
                    actualizarLinea(indice, {
                      idProducto: prod?.idProducto ?? null,
                      producto: prod,
                    })
                  }
                />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-crema/70">
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="999999"
                      disabled={enviando}
                      value={linea.cantidad}
                      onChange={(e) => actualizarLinea(indice, { cantidad: e.target.value })}
                      className="numeral h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-semibold uppercase text-crema/70">
                      Costo unit. ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      disabled={enviando}
                      value={linea.precioCosto}
                      onChange={(e) => actualizarLinea(indice, { precioCosto: e.target.value })}
                      placeholder="0.00"
                      className="numeral h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
                    />
                  </div>
                </div>
              </div>
            ))}

            <Boton
              type="button"
              tono="papel"
              tamano="chico"
              disabled={enviando}
              onClick={() => setLineas((prev) => [...prev, LINEA_VACIA()])}
            >
              <IconoMas /> Agregar línea
            </Boton>
          </div>
        ) : (
          <div className="grid gap-3 border-2 border-crema/15 bg-tinta/35 p-3">
            <label
              htmlFor="rec-archivo"
              className="block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
            >
              Foto o imagen del comprobante (JPG, PNG o WebP, hasta 12 MB)
            </label>
            <input
              id="rec-archivo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={enviando}
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
              className="text-xs text-crema file:mr-3 file:border-2 file:border-black file:bg-crema file:px-3 file:py-1.5 file:text-xs file:font-bold file:uppercase file:text-tinta"
            />
            {enviando && (
              <Aviso tono="neutro">
                Procesando comprobante en español… puede tardar unos segundos.
              </Aviso>
            )}
          </div>
        )}

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}

