import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router'
import { reporteServicio } from '../reportes.api.js'
import { pesos, fechaCorta } from '../../servicio/servicio.reglas.js'
import { Cargando, Fallo } from '../../../ui/Estados.jsx'

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

// RF28 — ordenes de servicio tecnico por estado y por periodo.
export const ReporteServicio = () => {
  const { desde, hasta } = useOutletContext()
  const [datos, setDatos] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const respuesta = await reporteServicio({ desde, hasta })
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
  if (cargando && !datos) return <Cargando filas={4} etiqueta="Generando reporte de servicio técnico" />
  if (!datos) return null

  return (
    <div className={`grid gap-6 ${cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}`}>
      <section aria-label="Resumen de servicio técnico" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta rotulo="Ingresadas en el período" valor={datos.totales.ingresadas} />
        <Tarjeta
          rotulo="Entregadas"
          valor={datos.totales.entregadas}
          detalle={`$${pesos(datos.totales.montoTotal)} liquidados`}
        />
        <Tarjeta
          rotulo="No retiradas fuera de plazo"
          valor={datos.totales.noRetiradas}
          detalle="En el taller hoy"
        />
        <Tarjeta
          rotulo="Recargos cobrados"
          valor={`$${pesos(datos.totales.recargosCobrados)}`}
          destacado
        />
      </section>

      <section className="bloque-reporte border-2 border-black bg-azul-hondo p-5">
        <h3 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight">
          Órdenes ingresadas por estado
        </h3>
        <table className="mt-4 w-full text-sm">
          <thead>
            <tr className="texto-suave border-b-2 border-crema/20 text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
              <th className="py-2 text-left">Estado</th>
              <th className="py-2 text-right">Cantidad</th>
              <th className="py-2 text-right">Monto acumulado</th>
            </tr>
          </thead>
          <tbody>
            {datos.porEstado.map((fila) => (
              <tr key={fila.codigo} className="border-b border-crema/10 last:border-b-0">
                <td className="py-2.5 font-semibold">{fila.nombre}</td>
                <td className="numeral py-2.5 text-right">{fila.cantidad}</td>
                <td className="valor-destacado numeral py-2.5 text-right font-semibold text-ambar">
                  ${pesos(fila.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {datos.noRetiradas.length > 0 && (
        <section className="bloque-reporte border-2 border-black bg-azul-hondo p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-[family-name:var(--font-cartel)] text-lg uppercase tracking-tight">
              Órdenes no retiradas fuera de plazo
            </h3>
            <span className="texto-suave text-xs text-crema/60">
              Equipos avisados pendientes de retiro hoy
            </span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="texto-suave border-b-2 border-crema/20 text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60">
                  <th className="py-2 text-left">Orden</th>
                  <th className="py-2 text-left">Cliente</th>
                  <th className="py-2 text-left">Aviso</th>
                  <th className="py-2 text-right">Días</th>
                  <th className="py-2 text-right">Monto</th>
                  <th className="py-2 text-right">Recargo sugerido</th>
                </tr>
              </thead>
              <tbody>
                {datos.noRetiradas.map((orden) => (
                  <tr key={orden.idOrden} className="border-b border-crema/10 last:border-b-0">
                    <td className="numeral py-2.5 font-semibold">
                      <Link to={`/servicio/${orden.idOrden}`} className="underline decoration-crema/30 hover:text-ambar">
                        {orden.numeroOrden}
                      </Link>
                    </td>
                    <td className="py-2.5">
                      {orden.cliente}
                      {orden.telefonoWhatsapp && (
                        <span className="texto-suave block text-xs text-crema/60">{orden.telefonoWhatsapp}</span>
                      )}
                    </td>
                    <td className="numeral py-2.5 text-crema/70">{fechaCorta(orden.fechaNotificacion)}</td>
                    <td className="numeral py-2.5 text-right font-semibold">{orden.diasDesdeNotificacion}</td>
                    <td className="numeral py-2.5 text-right">${pesos(orden.montoTotal)}</td>
                    <td className="valor-destacado numeral py-2.5 text-right font-semibold text-ambar">
                      ${pesos(orden.recargoSugerido)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  )
}

