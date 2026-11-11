import { useCallback, useEffect, useState } from 'react'
import { listarBitacora } from '../bitacora.api.js'
import {
  ACCIONES_BITACORA,
  ENTIDADES_BITACORA,
  tonoAccionBitacora,
  tieneCambiosExpandibles,
  paresDeCambio,
} from '../bitacora.reglas.js'
import { listarUsuarios } from '../../acceso/acceso.api.js'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { fechaHora, hoyIso, haceDiasIso } from '../../servicio/servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'

const FILTRO = 'h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta'
const ROTULO = 'mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60'

const formatearValor = (valor) => {
  if (valor === null || valor === undefined) return '—'
  if (typeof valor === 'boolean') return valor ? 'Sí' : 'No'
  if (typeof valor === 'object') return JSON.stringify(valor)
  return String(valor)
}

// RF05 — consulta de bitacora de operaciones criticas (solo Administrador).
export const Bitacora = () => {
  const [desde, setDesde] = useState(haceDiasIso(7))
  const [hasta, setHasta] = useState(hoyIso())
  const [accion, setAccion] = useState('')
  const [entidad, setEntidad] = useState('')
  const [idUsuario, setIdUsuario] = useState('')
  const [usuarios, setUsuarios] = useState([])
  const [expandido, setExpandido] = useState(null)

  useEffect(() => {
    listarUsuarios({ tamano: 100 })
      .then(({ datos }) => setUsuarios(datos))
      .catch(() => setUsuarios([]))
  }, [])

  const consultar = useCallback(
    (parametros) => listarBitacora({ ...parametros, texto: undefined }),
    [],
  )

  const listado = useListadoPaginado(consultar, {
    tamano: 25,
    filtros: {
      desde: desde || undefined,
      hasta: hasta || undefined,
      accion: accion || undefined,
      entidad: entidad || undefined,
      idUsuario: idUsuario ? Number(idUsuario) : undefined,
    },
  })

  const { datos: registros, paginacion, cargando, error } = listado

  const limpiar = () => {
    setDesde(haceDiasIso(7))
    setHasta(hoyIso())
    setAccion('')
    setEntidad('')
    setIdUsuario('')
  }

  return (
    <div className="grid gap-5">
      <Encabezado titulo="Bitácora de operaciones" tamano="text-3xl" />

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="bitacora-desde" className={ROTULO}>Desde</label>
          <input
            id="bitacora-desde"
            type="date"
            value={desde}
            max={hasta || hoyIso()}
            onChange={(evento) => setDesde(evento.target.value)}
            className={FILTRO}
          />
        </div>

        <div>
          <label htmlFor="bitacora-hasta" className={ROTULO}>Hasta</label>
          <input
            id="bitacora-hasta"
            type="date"
            value={hasta}
            min={desde}
            max={hoyIso()}
            onChange={(evento) => setHasta(evento.target.value)}
            className={FILTRO}
          />
        </div>

        <div>
          <label htmlFor="bitacora-usuario" className={ROTULO}>Usuario</label>
          <select
            id="bitacora-usuario"
            value={idUsuario}
            onChange={(evento) => setIdUsuario(evento.target.value)}
            className={FILTRO}
          >
            <option value="">Todos</option>
            {usuarios.map((u) => (
              <option key={u.idUsuario} value={String(u.idUsuario)}>
                {u.nombreUsuario}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bitacora-entidad" className={ROTULO}>Entidad</label>
          <select
            id="bitacora-entidad"
            value={entidad}
            onChange={(evento) => setEntidad(evento.target.value)}
            className={FILTRO}
          >
            <option value="">Todas</option>
            {ENTIDADES_BITACORA.map((item) => (
              <option key={item.valor} value={item.valor}>{item.texto}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="bitacora-accion" className={ROTULO}>Acción</label>
          <select
            id="bitacora-accion"
            value={accion}
            onChange={(evento) => setAccion(evento.target.value)}
            className={FILTRO}
          >
            <option value="">Todas</option>
            {ACCIONES_BITACORA.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>
      </div>

      {error && <Fallo error={error} reintentar={listado.recargar} />}
      {!error && cargando && registros.length === 0 && (
        <Cargando filas={6} etiqueta="Consultando bitácora" />
      )}

      {!error && !cargando && registros.length === 0 && (
        <Vacio
          titulo="Sin movimientos en la bitácora"
          detalle="No hay operaciones registradas que coincidan con esos filtros."
          accion={<Boton tono="papel" onClick={limpiar}>Restablecer filtros</Boton>}
        />
      )}

      {registros.length > 0 && (
        <>
          <ul className={`border-2 border-black bg-azul-hondo ${cargando ? 'opacity-50 transition-opacity' : ''}`}>
            {registros.map((reg) => {
              const expandible = tieneCambiosExpandibles(reg)
              const abierto = expandido === reg.idBitacora
              const pares = abierto ? paresDeCambio(reg.datosAntes, reg.datosDespues) : []

              return (
                <li key={reg.idBitacora} className="border-b-2 border-crema/10 last:border-b-0">
                  <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Marca tono={tonoAccionBitacora(reg.accion)}>{reg.accion}</Marca>
                        <span className="text-sm font-semibold text-crema">
                          {reg.entidadAfectada}
                          {reg.idRegistro != null && (
                            <span className="numeral ms-1 text-crema/65">#{reg.idRegistro}</span>
                          )}
                        </span>
                        {reg.detalle && (
                          <span className="text-sm text-crema/80">· {reg.detalle}</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-crema/60">
                        <span className="numeral">{fechaHora(reg.fechaHora)}</span>
                        {' · '}
                        <span className="font-semibold text-crema/80">
                          {reg.usuario?.nombreUsuario ?? `Usuario #${reg.idUsuario}`}
                        </span>
                        {reg.direccionIp && <span className="numeral"> · IP {reg.direccionIp}</span>}
                      </p>
                    </div>

                    {expandible && (
                      <button
                        type="button"
                        onClick={() => setExpandido(abierto ? null : reg.idBitacora)}
                        aria-expanded={abierto}
                        className="shrink-0 border-2 border-crema/25 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-crema/80 hover:border-crema hover:text-crema"
                      >
                        {abierto ? 'Ocultar cambios' : 'Ver cambios'}
                      </button>
                    )}
                  </div>

                  {abierto && pares.length > 0 && (
                    <div className="border-t border-crema/10 bg-azul/60 px-4 py-3">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-crema/15 text-[10px] font-bold uppercase tracking-[0.14em] text-crema/55">
                            <th className="py-1.5 text-left">Campo</th>
                            <th className="py-1.5 text-left">Antes</th>
                            <th className="py-1.5 text-left">Después</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pares.map((par) => (
                            <tr key={par.clave} className="border-b border-crema/10 last:border-b-0">
                              <td className="py-1.5 pr-3 font-semibold text-crema/85">{par.clave}</td>
                              <td className="numeral py-1.5 pr-3 text-crema/65">{formatearValor(par.antes)}</td>
                              <td className="numeral py-1.5 text-ambar">{formatearValor(par.despues)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}
    </div>
  )
}

