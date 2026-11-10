import { useCallback, useEffect, useState } from 'react'
import { reporteStockBajoMinimo, reporteValorizacion } from '../reportes.api.js'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { pesos } from '../../servicio/servicio.reglas.js'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Marca } from '../../../ui/Listado.jsx'
import { Cargando, Fallo, Vacio } from '../../../ui/Estados.jsx'

// RF27.1 y RF27.2 — valorizacion por categoria y stock bajo minimo.
export const ReporteInventario = () => {
  const [valorizacion, setValorizacion] = useState(null)
  const [cargandoVal, setCargandoVal] = useState(true)
  const [errorVal, setErrorVal] = useState(null)

  const cargarValorizacion = useCallback(async () => {
    setCargandoVal(true)
    setErrorVal(null)
    try {
      const { datos } = await reporteValorizacion()
      setValorizacion(datos)
    } catch (fallo) {
      setErrorVal(fallo)
    } finally {
      setCargandoVal(false)
    }
  }, [])

  useEffect(() => {
    cargarValorizacion()
  }, [cargarValorizacion])

  const bajoMinimo = useListadoPaginado(reporteStockBajoMinimo, { tamano: 25 })

  return (
    <div className="grid gap-6">
      <section className="bloque-reporte border-2 border-black bg-azul-hondo p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight">
            Valorización del inventario
          </h3>
          <span className="texto-suave text-xs text-crema/60">
            Productos activos agrupados por categoría
          </span>
        </div>

        {errorVal && <div className="mt-4"><Fallo error={errorVal} reintentar={cargarValorizacion} /></div>}
        {cargandoVal && !valorizacion && <div className="mt-4"><Cargando filas={3} etiqueta="Calculando valorización" /></div>}

        {valorizacion && valorizacion.categorias.length === 0 && (
          <Vacio
            titulo="Sin productos activos"
            detalle="No hay artículos en el catálogo para valorizar."
          />
        )}

        {valorizacion && valorizacion.categorias.length > 0 && (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="texto-suave border-b-2 border-crema/20 text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
                  <th className="py-2 text-left">Categoría</th>
                  <th className="py-2 text-right">Artículos</th>
                  <th className="py-2 text-right">Unidades</th>
                  {valorizacion.incluyeCosto && <th className="py-2 text-right">Valor a costo</th>}
                  <th className="py-2 text-right">Valor a venta</th>
                </tr>
              </thead>
              <tbody>
                {valorizacion.categorias.map((fila) => (
                  <tr key={fila.categoria} className="border-b border-crema/10">
                    <td className="py-2.5 font-semibold">{fila.categoria}</td>
                    <td className="numeral py-2.5 text-right">{fila.articulos}</td>
                    <td className="numeral py-2.5 text-right">{fila.unidades}</td>
                    {valorizacion.incluyeCosto && (
                      <td className="numeral py-2.5 text-right">${pesos(fila.valorCosto)}</td>
                    )}
                    <td className="valor-destacado numeral py-2.5 text-right font-semibold text-ambar">
                      ${pesos(fila.valorVenta)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-crema/30 font-bold">
                  <td className="py-3 uppercase tracking-wide">Total</td>
                  <td className="numeral py-3 text-right">{valorizacion.total.articulos}</td>
                  <td className="numeral py-3 text-right">{valorizacion.total.unidades}</td>
                  {valorizacion.incluyeCosto && (
                    <td className="numeral py-3 text-right">${pesos(valorizacion.total.valorCosto)}</td>
                  )}
                  <td className="valor-destacado numeral py-3 text-right text-ambar">
                    ${pesos(valorizacion.total.valorVenta)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>

      <section className="bloque-reporte border-2 border-black bg-azul-hondo p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight">
            Stock bajo mínimo
          </h3>
          {bajoMinimo.paginacion.total > 0 && (
            <span className="numeral text-xs font-semibold text-crema/70">
              {bajoMinimo.paginacion.total} productos para reponer
            </span>
          )}
        </div>

        {bajoMinimo.error && <div className="mt-4"><Fallo error={bajoMinimo.error} reintentar={bajoMinimo.recargar} /></div>}
        {!bajoMinimo.error && bajoMinimo.cargando && bajoMinimo.datos.length === 0 && (
          <div className="mt-4"><Cargando filas={4} etiqueta="Buscando productos bajo mínimo" /></div>
        )}
        {!bajoMinimo.error && !bajoMinimo.cargando && bajoMinimo.datos.length === 0 && (
          <Vacio
            titulo="Sin productos bajo mínimo"
            detalle="Todo el catálogo activo está por encima de su nivel mínimo definido."
          />
        )}

        {bajoMinimo.datos.length > 0 && (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className={`w-full text-sm ${bajoMinimo.cargando ? 'opacity-50 transition-opacity' : ''}`}>
                <thead>
                  <tr className="texto-suave border-b-2 border-crema/20 text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
                    <th className="py-2 text-left">Código</th>
                    <th className="py-2 text-left">Producto</th>
                    <th className="py-2 text-left">Categoría / Marca</th>
                    <th className="py-2 text-right">Stock</th>
                    <th className="py-2 text-right">Mínimo</th>
                    <th className="py-2 text-right">Faltante</th>
                  </tr>
                </thead>
                <tbody>
                  {bajoMinimo.datos.map((item) => (
                    <tr key={item.idProducto} className="border-b border-crema/10 last:border-b-0">
                      <td className="numeral py-2.5 text-crema/70">{item.codigoInterno}</td>
                      <td className="py-2.5 font-semibold">{item.denominacion}</td>
                      <td className="texto-suave py-2.5 text-crema/65">{item.categoria} · {item.marca}</td>
                      <td className="numeral py-2.5 text-right">{item.stockActual}</td>
                      <td className="numeral py-2.5 text-right">{item.stockMinimo}</td>
                      <td className="py-2.5 text-right">
                        <Marca tono="alerta">-{item.faltante}</Marca>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="no-imprimir">
              <Paginacion paginacion={bajoMinimo.paginacion} alCambiar={bajoMinimo.setPagina} />
            </div>
          </>
        )}
      </section>
    </div>
  )
}

