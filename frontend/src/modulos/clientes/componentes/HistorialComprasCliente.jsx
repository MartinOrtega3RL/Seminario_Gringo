import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarComprasCliente } from '../clientes.api.js'
import { listarCuotas } from '../../ventas/ventas.api.js'
import { condicionDePago } from '../../ventas/ventas.reglas.js'
import { fechaHora, pesos } from '../../servicio/servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF14.1 — historial paginado de compras del cliente.
export const HistorialComprasCliente = () => {
  const { idCliente } = useParams()
  const navegar = useNavigate()
  const { puedeLeer } = useSesion()
  const [resumenDeuda, setResumenDeuda] = useState(null)

  useEffect(() => {
    if (!puedeLeer('VENTAS')) return undefined
    let activo = true
    listarCuotas({ idCliente, estado: 'POR_COBRAR', tamano: 1 })
      .then(({ resumen }) => {
        if (activo) setResumenDeuda(resumen ?? null)
      })
      .catch(() => {
        if (activo) setResumenDeuda(null)
      })
    return () => {
      activo = false
    }
  }, [idCliente, puedeLeer])

  const consultar = useCallback(
    (parametros) => listarComprasCliente(idCliente, parametros),
    [idCliente],
  )

  const { datos: compras, paginacion, setPagina, cargando, error, recargar } =
    useListadoPaginado(consultar, { tamano: 15 })

  const bannerDeuda = resumenDeuda && resumenDeuda.saldoAdeudado > 0 && (
    <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-ambar/60 bg-azul-hondo px-4 py-3 text-sm">
      <div>
        <span className="font-semibold text-crema">
          Saldo adeudado en cuotas:{' '}
          <span className="numeral text-ambar">${pesos(resumenDeuda.saldoAdeudado)}</span>
        </span>
        {resumenDeuda.saldoVencido > 0 && (
          <span className="ms-2 text-xs font-bold uppercase text-escarlata">
            (Vencido: ${pesos(resumenDeuda.saldoVencido)})
          </span>
        )}
      </div>
      <Link
        to={`/cuotas?idCliente=${idCliente}`}
        className="border-2 border-ambar px-3 py-1 text-xs font-bold uppercase tracking-wider text-ambar hover:bg-ambar hover:text-tinta"
      >
        Ver cuotas
      </Link>
    </div>
  )

  if (error) return <Fallo error={error} reintentar={recargar} />
  if (cargando && compras.length === 0) return <Cargando filas={4} etiqueta="Buscando compras" />

  if (compras.length === 0) {
    return (
      <div className="grid gap-4">
        {bannerDeuda}
        <Vacio
          titulo="Sin compras registradas"
          detalle="Este cliente todavía no tiene ventas asociadas en el sistema."
        />
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {bannerDeuda}
      <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
        {compras.map((compra) => {
          const anulada = compra.estado === 'ANULADA'
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
              secundario={[
                fechaHora(compra.fechaHora),
                condicionDePago(compra),
              ].filter(Boolean).join(' · ')}
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

