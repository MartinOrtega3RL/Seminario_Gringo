import { useEffect, useState } from 'react'
import {
  listarCategorias,
  listarMarcas,
  listarProductos,
  registrarProducto,
} from '../../catalogo/catalogo.api.js'
import { inferirClasificacion, palabrasParecidas } from '../recepciones.reglas.js'
import { pesos } from '../../servicio/servicio.reglas.js'
import { useSesion } from '../../../app/sesion.jsx'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

const redondearPrecio = (costo, porcentaje) =>
  Math.round(Number(costo || 0) * (1 + porcentaje / 100))

// Alta rapida desde una linea de recepcion sin salir de la validacion.
// Muestra productos parecidos ya existentes en catalogo para evitar duplicados.
export const DialogoProductoRapido = ({
  linea,
  alCerrar,
  alAsociarExistente,
  alCrearYAsociar,
}) => {
  const { puedeLeer } = useSesion()
  const verCostos = puedeLeer('REPORTES')

  const [denominacion, setDenominacion] = useState('')
  const [idCategoria, setIdCategoria] = useState('')
  const [idMarca, setIdMarca] = useState('')
  const [precioMinorista, setPrecioMinorista] = useState('')
  const [precioMayorista, setPrecioMayorista] = useState('')

  const [categorias, setCategorias] = useState([])
  const [marcas, setMarcas] = useState([])
  const [parecidos, setParecidos] = useState([])
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState(null)

  const abierto = Boolean(linea)
  const costoComprobante = Number(linea?.precioCosto ?? 0)

  useEffect(() => {
    if (!linea) return
    const textoInicial = linea.descripcionOriginal || ''
    setDenominacion(textoInicial)
    setPrecioMinorista('')
    setPrecioMayorista('')
    setError(null)
    setGuardando(false)

    Promise.all([listarCategorias(), listarMarcas()])
      .then(([catsRes, marcasRes]) => {
        const cats = catsRes.datos ?? []
        const mrcs = marcasRes.datos ?? []
        setCategorias(cats)
        setMarcas(mrcs)
        const inferido = inferirClasificacion(textoInicial, cats, mrcs)
        setIdCategoria(String(inferido.idCategoria))
        setIdMarca(String(inferido.idMarca))
      })
      .catch(() => {})
  }, [linea])

  useEffect(() => {
    if (!abierto) return undefined
    const consulta = palabrasParecidas(denominacion)
    if (!consulta) {
      setParecidos([])
      return undefined
    }

    let activo = true
    const reloj = setTimeout(() => {
      listarProductos({ texto: consulta, tamano: 4 })
        .then(({ datos }) => {
          if (activo) setParecidos(datos ?? [])
        })
        .catch(() => {
          if (activo) setParecidos([])
        })
    }, 220)

    return () => {
      activo = false
      clearTimeout(reloj)
    }
  }, [abierto, denominacion])

  const guardar = async (evento) => {
    evento.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const payload = {
        denominacion: denominacion.trim(),
        idCategoria: Number(idCategoria),
        idMarca: Number(idMarca),
        precioMinorista: Number(precioMinorista),
        precioMayorista: Number(precioMayorista),
        stockInicial: 0,
        stockMinimo: 0,
      }
      if (verCostos) payload.precioCosto = costoComprobante

      const { datos } = await registrarProducto(payload)
      alCrearYAsociar(datos)
    } catch (fallo) {
      setError(fallo.message)
      setGuardando(false)
    }
  }

  const aplicarMargen = (porcentajeMin, porcentajeMay) => {
    if (costoComprobante <= 0) return
    setPrecioMinorista(String(redondearPrecio(costoComprobante, porcentajeMin)))
    setPrecioMayorista(String(redondearPrecio(costoComprobante, porcentajeMay)))
  }

  const valido =
    denominacion.trim().length >= 2 &&
    Boolean(idCategoria) &&
    Boolean(idMarca) &&
    precioMinorista !== '' &&
    precioMayorista !== '' &&
    Number(precioMinorista) >= 0 &&
    Number(precioMayorista) >= 0

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={() => !guardando && alCerrar()}
      titulo="Crear o asociar producto"
      descripcion="Verificá si ya existe un producto parecido para no duplicarlo, o completá los precios de venta para darlo de alta con stock 0 (el stock se suma al confirmar la recepción)."
      pie={
        <div className="flex justify-end gap-2">
          <Boton type="button" tono="papel" disabled={guardando} onClick={alCerrar}>
            Cancelar
          </Boton>
          <Boton type="submit" form="form-producto-rapido" cargando={guardando} disabled={!valido}>
            Crear y asociar
          </Boton>
        </div>
      }
    >
      {linea && (
        <form id="form-producto-rapido" onSubmit={guardar} className="grid gap-4">
          {parecidos.length > 0 && (
            <div className="border-2 border-ambar/60 bg-ambar/10 p-3">
              <p className="text-[11px] font-bold uppercase tracking-wider text-ambar">
                Ya hay productos parecidos en el catálogo — ¿es alguno de estos?
              </p>
              <ul className="mt-2 grid gap-1.5">
                {parecidos.map((p) => (
                  <li
                    key={p.idProducto}
                    className="flex items-center justify-between gap-2 border border-crema/15 bg-azul-hondo px-2.5 py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate text-crema">
                      <span className="numeral text-crema/55">{p.codigoInterno}</span> · {p.denominacion}
                    </span>
                    <button
                      type="button"
                      onClick={() => alAsociarExistente(p)}
                      className="shrink-0 border border-ambar px-2 py-0.5 text-[11px] font-bold uppercase text-ambar hover:bg-ambar hover:text-tinta"
                    >
                      Usar este
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <label
              htmlFor="rapido-nombre"
              className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
            >
              Nombre en el catálogo
            </label>
            <input
              id="rapido-nombre"
              type="text"
              maxLength={150}
              disabled={guardando}
              value={denominacion}
              onChange={(e) => setDenominacion(e.target.value)}
              className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-sm font-semibold text-tinta"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="rapido-cat"
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
              >
                Categoría (detectada)
              </label>
              <select
                id="rapido-cat"
                value={idCategoria}
                disabled={guardando}
                onChange={(e) => setIdCategoria(e.target.value)}
                className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
              >
                {categorias.map((c) => (
                  <option key={c.idCategoria} value={c.idCategoria}>{c.nombre}</option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="rapido-marca"
                className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75"
              >
                Marca (detectada)
              </label>
              <select
                id="rapido-marca"
                value={idMarca}
                disabled={guardando}
                onChange={(e) => setIdMarca(e.target.value)}
                className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
              >
                {marcas.map((m) => (
                  <option key={m.idMarca} value={m.idMarca}>{m.nombre}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="border-2 border-crema/15 bg-tinta/35 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-crema/70">
                Costo del comprobante:{' '}
                <strong className="numeral text-ambar">${pesos(costoComprobante)}</strong>
              </span>
              {costoComprobante > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => aplicarMargen(50, 30)}
                    className="border border-crema/30 px-2 py-0.5 text-[11px] font-semibold text-crema hover:border-ambar hover:text-ambar"
                  >
                    +50% / +30%
                  </button>
                  <button
                    type="button"
                    onClick={() => aplicarMargen(80, 50)}
                    className="border border-crema/30 px-2 py-0.5 text-[11px] font-semibold text-crema hover:border-ambar hover:text-ambar"
                  >
                    +80% / +50%
                  </button>
                </div>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="rapido-min"
                  className="mb-1 block text-[11px] font-semibold uppercase text-crema/75"
                >
                  Precio minorista ($)
                </label>
                <input
                  id="rapido-min"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={guardando}
                  value={precioMinorista}
                  onChange={(e) => setPrecioMinorista(e.target.value)}
                  placeholder="0.00"
                  className="numeral h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
                />
              </div>

              <div>
                <label
                  htmlFor="rapido-may"
                  className="mb-1 block text-[11px] font-semibold uppercase text-crema/75"
                >
                  Precio mayorista ($)
                </label>
                <input
                  id="rapido-may"
                  type="number"
                  min="0"
                  step="0.01"
                  disabled={guardando}
                  value={precioMayorista}
                  onChange={(e) => setPrecioMayorista(e.target.value)}
                  placeholder="0.00"
                  className="numeral h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
                />
              </div>
            </div>
          </div>

          {error && <Aviso tono="mal">{error}</Aviso>}
        </form>
      )}
    </Dialogo>
  )
}

