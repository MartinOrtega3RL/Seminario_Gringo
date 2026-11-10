import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarReparacionesCliente } from '../clientes.api.js'
import { nombreEquipoHistorial } from '../clientes.reglas.js'
import { fechaCorta, soloFecha, pesos, tonoDeEstado } from '../../servicio/servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'

// RF14.2 — historial paginado de reparaciones del cliente.
export const HistorialReparacionesCliente = () => {
  const { idCliente } = useParams()
  const navegar = useNavigate()

  const consultar = useCallback(
    (parametros) => listarReparacionesCliente(idCliente, parametros),
    [idCliente],
  )

  const { datos: ordenes, paginacion, setPagina, cargando, error, recargar } =
    useListadoPaginado(consultar, { tamano: 15 })

  if (error) return <Fallo error={error} reintentar={recargar} />
  if (cargando && ordenes.length === 0) return <Cargando filas={4} etiqueta="Buscando reparaciones" />

  if (ordenes.length === 0) {
    return (
      <Vacio
        titulo="Sin reparaciones registradas"
        detalle="Este cliente todavía no ingresó dispositivos al servicio técnico."
      />
    )
  }

  return (
    <div className="grid gap-4">
      <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {ordenes.map((orden) => (
          <Fila
            key={orden.idOrden}
            atenuado={Boolean(orden.estado?.esFinal)}
            alAbrir={() => navegar(`/servicio/${orden.idOrden}`)}
            principal={
              <>
                <span className="numeral">{orden.numeroOrden}</span>
                <span className="ms-2 font-normal text-crema/70">{nombreEquipoHistorial(orden.equipo)}</span>
              </>
            }
            secundario={[
              `ingresó ${fechaCorta(orden.fechaIngreso)}`,
              orden.equipo?.imeiSerie ? `IMEI ${orden.equipo.imeiSerie}` : 'sin IMEI',
              orden.fechaVencGarantia ? `garantía hasta ${soloFecha(orden.fechaVencGarantia)}` : null,
            ].filter(Boolean).join(' · ')}
            derecha={
              <span className="flex items-center gap-3">
                {orden.estado && (
                  <Marca tono={tonoDeEstado(orden.estado.codigo)}>{orden.estado.nombre}</Marca>
                )}
                {(orden.fechaEntrega || orden.total > 0) && (
                  <span className="numeral text-base font-bold text-ambar">
                    ${pesos(orden.total)}
                  </span>
                )}
              </span>
            }
          />
        ))}
      </Listado>

      <Paginacion paginacion={paginacion} alCambiar={setPagina} />
    </div>
  )
}

