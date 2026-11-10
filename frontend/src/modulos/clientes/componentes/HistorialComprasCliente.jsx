import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarComprasCliente } from '../clientes.api.js'
import { MODALIDADES } from '../clientes.reglas.js'
import { fechaHora, pesos } from '../../servicio/servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'

// RF14.1 — historial paginado de compras del cliente.
export const HistorialComprasCliente = () => {
  const { idCliente } = useParams()
  const navegar = useNavigate()

  const consultar = useCallback(
    (parametros) => listarComprasCliente(idCliente, parametros),
    [idCliente],
  )

  const { datos: compras, paginacion, setPagina, cargando, error, recargar } =
    useListadoPaginado(consultar, { tamano: 15 })

  if (error) return <Fallo error={error} reintentar={recargar} />
  if (cargando && compras.length === 0) return <Cargando filas={4} etiqueta="Buscando compras" />

  if (compras.length === 0) {
    return (
      <Vacio
        titulo="Sin compras registradas"
        detalle="Este cliente todavía no tiene ventas asociadas en el sistema."
      />
    )
  }

  return (
    <div className="grid gap-4">
      <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {compras.map((compra) => {
          const anulada = compra.estado === 'ANULADA'
          const modalidad = (MODALIDADES[compra.modalidadPago] ?? compra.modalidadPago) +
            (compra.cantidadCuotas ? ` en ${compra.cantidadCuotas}` : '')

          return (
            <Fila
              key={compra.idVenta}
              atenuado={anulada}
              alAbrir={() => navegar(`/venta/${compra.idVenta}/comprobante`)}
              principal={
                <>
                  <span className="numeral">{compra.numeroComprobante}</span>
                  {compra.resumenProductos && (
                    <span className="ms-2 font-normal text-crema/70">{compra.resumenProductos}</span>
                  )}
                </>
              }
              secundario={[fechaHora(compra.fechaHora), modalidad, compra.medioPago].filter(Boolean).join(' · ')}
              derecha={
                <span className="flex items-center gap-3">
                  <Marca tono={anulada ? 'alerta' : 'neutro'}>
                    {anulada ? 'Anulada' : 'Confirmada'}
                  </Marca>
                  <span className={`numeral text-base font-bold ${anulada ? 'text-crema/40 line-through' : 'text-ambar'}`}>
                    ${pesos(compra.total)}
                  </span>
                </span>
              }
            />
          )
        })}
      </Listado>

      <Paginacion paginacion={paginacion} alCambiar={setPagina} />
    </div>
  )
}

