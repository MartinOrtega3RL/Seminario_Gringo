import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router'
import { reporteVentas } from '../reportes.api.js'
import { pesos, soloFecha } from '../../servicio/servicio.reglas.js'
import { Cargando, Fallo, Vacio } from '../../../ui/Estados.jsx'

const Tarjeta = ({ rotulo, valor, detalle, destacado = false }) => (
  <div className="tarjeta-reporte border-2 border-black bg-azul-hondo p-4">
    <p className="texto-suave text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
      {rotulo}
    </p>
    <p className={`valor-destacado numeral mt-2 font-[family-name:var(--font-cartel)] text-3xl leading-none ${destacado ? 'text-ambar' : 'text-crema'}`}>
      {valor}
    </p>
    {detalle && <p className="texto-suave mt-2 text-xs text-crema/65">{detalle}</p>}
  </div>
)

// RF26.1 y RF26.2 — actividad comercial y desglose por medio de pago.
export const ReporteComercial = () => {
  const { desde, hasta } = useOutletContext()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const respuesta = await reporteVentas({ desde, hasta })
      setDatos(respuesta.datos)
    } catch (fallo) {
      setError(fallo)
    } finally {
      setCargando(false)
    }
  }, [desde, hasta])

  useEffect(() => {
    cargar()
  }, [cargar])

  if (error) return <Fallo error={error} reintentar={cargar} />
  if (cargando && !datos) return <Cargando filas={4} etiqueta="Generando reporte comercial" />
  if (!datos) return null

  return (
    <div className={`grid gap-6 ${cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}>
      <section aria-label="Resumen comercial" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta rotulo="Ventas confirmadas" valor={datos.operaciones} />
        <Tarjeta rotulo="Total vendido" valor={`$${pesos(datos.totalVendido)}`} destacado />
        <Tarjeta rotulo="Ticket promedio" valor={`$${pesos(datos.ticketPromedio)}`} />
        <Tarjeta
          rotulo="Ventas anuladas"
          valor={datos.anuladas.cantidad}
          detalle={`$${pesos(datos.anuladas.importe)} fuera del total`}
        />
      </section>

      {datos.operaciones === 0 ? (
        <Vacio
          titulo="Sin ventas confirmadas en el período"
          detalle="Probá ampliando el rango de fechas arriba."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="bloque-reporte border-2 border-black bg-azul-hondo p-5">
            <h3 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight">
              Por medio de pago
            </h3>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="texto-suave border-b-2 border-crema/20 text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
                  <th className="py-2 text-left">Medio</th>
                  <th className="py-2 text-right">Operaciones</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {datos.porMedioPago.map((fila) => (
                  <tr key={fila.medioPago} className="border-b border-crema/10 last:border-b-0">
                    <td className="py-2.5 font-semibold">{fila.medioPago}</td>
                    <td className="numeral py-2.5 text-right">{fila.operaciones}</td>
                    <td className="valor-destacado numeral py-2.5 text-right font-semibold text-ambar">
                      ${pesos(fila.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="bloque-reporte border-2 border-black bg-azul-hondo p-5">
            <h3 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight">
              Totales por día
            </h3>
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="texto-suave border-b-2 border-crema/20 text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
                  <th className="py-2 text-left">Fecha</th>
                  <th className="py-2 text-right">Operaciones</th>
                  <th className="py-2 text-right">Importe</th>
                </tr>
              </thead>
              <tbody>
                {datos.porDia.map((dia) => (
                  <tr key={dia.fecha} className="border-b border-crema/10 last:border-b-0">
                    <td className="numeral py-2.5 font-semibold">{soloFecha(dia.fecha)}</td>
                    <td className="numeral py-2.5 text-right">{dia.operaciones}</td>
                    <td className="valor-destacado numeral py-2.5 text-right font-semibold text-ambar">
                      ${pesos(dia.importe)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  )
}

