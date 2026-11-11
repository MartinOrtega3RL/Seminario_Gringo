import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarProveedoresRecepcion, listarRecepciones } from '../recepciones.api.js'
import {
  ESTADOS_RECEPCION,
  ORIGENES_RECEPCION,
  TONOS_RECEPCION,
} from '../recepciones.reglas.js'
import { DialogoNuevaRecepcion } from '../componentes/DialogoNuevaRecepcion.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { fechaHora, pesos } from '../../servicio/servicio.reglas.js'
import { useSesion } from '../../../app/sesion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { IconoMas } from '../../../ui/Iconos.jsx'

const ESTADOS_FILTRO = [
  ['TODAS', 'Todas'],
  ['PENDIENTE_VALIDACION', 'Pendientes'],
  ['CONFIRMADA', 'Confirmadas'],
  ['ANULADA', 'Anuladas'],
]

export const Recepciones = () => {
  const navegar = useNavigate()
  const [parametrosUrl, setParametrosUrl] = useSearchParams()
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CATALOGO_STOCK')

  const [estado, setEstado] = useState('TODAS')
  const [idProveedor, setIdProveedor] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [proveedores, setProveedores] = useState([])
  const [abiertoAlta, setAbiertoAlta] = useState(() => parametrosUrl.get('nueva') === '1')

  useEffect(() => {
    listarProveedoresRecepcion()
      .then(({ datos }) => setProveedores(datos ?? []))
      .catch(() => setProveedores([]))
  }, [])

  useEffect(() => {
    if (parametrosUrl.get('nueva') === '1') {
      setAbiertoAlta(true)
      const siguientes = new URLSearchParams(parametrosUrl)
      siguientes.delete('nueva')
      setParametrosUrl(siguientes, { replace: true })
    }
  }, [parametrosUrl, setParametrosUrl])

  const consultar = useCallback(
    (parametros) => listarRecepciones({ ...parametros, texto: undefined }),
    [],
  )

  const listado = useListadoPaginado(consultar, {
    tamano: 25,
    filtros: {
      estado,
      idProveedor: idProveedor ? Number(idProveedor) : undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
    },
  })

  const { datos: recepciones, paginacion, cargando, error } = listado

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {ESTADOS_FILTRO.map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setEstado(valor)}
              className={`border-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider ${
                estado === valor
                  ? 'border-black bg-ambar text-tinta shadow-[2px_2px_0_0_#0B1220]'
                  : 'border-crema/25 bg-azul-hondo text-crema/75 hover:border-crema/50'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        {escritura && (
          <Boton onClick={() => setAbiertoAlta(true)}>
            <IconoMas /> Nueva recepción
          </Boton>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
        <div>
          <label htmlFor="filtro-prov-rec" className="sr-only">Proveedor</label>
          <select
            id="filtro-prov-rec"
            value={idProveedor}
            onChange={(e) => setIdProveedor(e.target.value)}
            className="h-11 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-sm font-semibold text-tinta"
          >
            <option value="">Todos los proveedores</option>
            {proveedores.map((p) => (
              <option key={p.idProveedor} value={p.idProveedor}>{p.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="rec-desde" className="text-xs font-semibold uppercase text-crema/65">
            Desde
          </label>
          <input
            id="rec-desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="h-11 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm text-tinta"
          />
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="rec-hasta" className="text-xs font-semibold uppercase text-crema/65">
            Hasta
          </label>
          <input
            id="rec-hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="h-11 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm text-tinta"
          />
        </div>
      </div>

      {error && <Fallo error={error} reintentar={listado.recargar} />}
      {!error && cargando && recepciones.length === 0 && (
        <Cargando filas={6} etiqueta="Cargando recepciones" />
      )}
      {!error && !cargando && recepciones.length === 0 && (
        <Vacio
          titulo="No hay recepciones registradas"
          detalle="Cargá una recepción manual o desde una foto del comprobante del proveedor."
        />
      )}

      {recepciones.length > 0 && (
        <>
          <Listado>
            {recepciones.map((r) => (
              <Fila
                key={r.idRecepcion}
                atenuado={r.estado === 'ANULADA'}
                alAbrir={() => navegar(`/productos/recepciones/${r.idRecepcion}`)}
                principal={
                  <span className="inline-flex flex-wrap items-center gap-2">
                    <span>{r.proveedor}</span>
                    <Marca tono={TONOS_RECEPCION[r.estado] ?? 'neutro'}>
                      {ESTADOS_RECEPCION[r.estado] ?? r.estado}
                    </Marca>
                  </span>
                }
                secundario={[
                  `${r.tipoComprobante}${r.numeroComprobante ? ` ${r.numeroComprobante}` : ` #${r.idRecepcion}`}`,
                  ORIGENES_RECEPCION[r.origenCarga] ?? r.origenCarga,
                  r.confianzaOcr !== null ? `Confianza OCR ${r.confianzaOcr}%` : null,
                  fechaHora(r.fechaRegistro),
                ]
                  .filter(Boolean)
                  .join(' · ')}
                derecha={
                  <span className="numeral font-[family-name:var(--font-cartel)] text-xl text-ambar">
                    ${pesos(r.montoTotal)}
                  </span>
                }
              />
            ))}
          </Listado>

          <Paginacion
            paginacion={paginacion}
            alCambiar={listado.setPagina}
            cargando={cargando}
          />
        </>
      )}

      <DialogoNuevaRecepcion
        abierto={abiertoAlta}
        alCerrar={() => setAbiertoAlta(false)}
        alCrear={(creada) => {
          setAbiertoAlta(false)
          navegar(`/productos/recepciones/${creada.idRecepcion}`)
        }}
      />
    </div>
  )
}

