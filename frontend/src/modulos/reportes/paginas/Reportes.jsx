import { useState } from 'react'
import { Outlet } from 'react-router'
import { mesEnCurso, etiquetaPeriodo, hoyReporte } from '../reportes.reglas.js'
import { haceDiasIso } from '../../servicio/servicio.reglas.js'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Pestanas } from '../../../ui/Pestanas.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { IconoImprimir, IconoVenta, IconoExistencias, IconoServicio } from '../../../ui/Iconos.jsx'
import '../reportes.css'

const FILTRO = 'h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta'
const ROTULO = 'mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60'

const VISTAS = [
  { a: '/reportes', texto: 'Comercial', Icono: IconoVenta, exacta: true },
  { a: '/reportes/inventario', texto: 'Inventario', Icono: IconoExistencias },
  { a: '/reportes/servicio', texto: 'Servicio técnico', Icono: IconoServicio },
]

// RF26, RF27 y RF28 — modulo de reportes del comercio.
export const Reportes = () => {
  const inicial = mesEnCurso()
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const hoy = hoyReporte()

  const atajos = [
    ['Mes en curso', () => mesEnCurso()],
    ['Hoy', () => ({ desde: hoy, hasta: hoy })],
    ['7 días', () => ({ desde: haceDiasIso(7), hasta: hoy })],
    ['30 días', () => ({ desde: haceDiasIso(30), hasta: hoy })],
  ]

  return (
    <div className="reporte-imprimible grid gap-5">
      <div className="no-imprimir">
        <Encabezado
          titulo="Reportes"
          tamano="text-3xl"
          derecha={
            <Boton tono="papel" onClick={() => window.print()}>
              <IconoImprimir className="size-4" />
              Imprimir
            </Boton>
          }
        />
      </div>

      <div className="solo-imprimir border-b-2 border-black pb-3">
        <h1 className="font-[family-name:var(--font-cartel)] text-2xl uppercase">
          El Gringo Celulares — Reportes
        </h1>
        <p className="mt-1 text-sm">{etiquetaPeriodo(desde, hasta)}</p>
      </div>

      <div className="no-imprimir flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="reporte-desde" className={ROTULO}>Desde</label>
          <input
            id="reporte-desde"
            type="date"
            value={desde}
            max={hasta}
            onChange={(evento) => setDesde(evento.target.value)}
            className={FILTRO}
          />
        </div>

        <div>
          <label htmlFor="reporte-hasta" className={ROTULO}>Hasta</label>
          <input
            id="reporte-hasta"
            type="date"
            value={hasta}
            min={desde}
            max={hoy}
            onChange={(evento) => setHasta(evento.target.value)}
            className={FILTRO}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 pb-0.5">
          {atajos.map(([texto, calcular]) => {
            const rango = calcular()
            const activo = desde === rango.desde && hasta === rango.hasta
            return (
              <button
                key={texto}
                type="button"
                onClick={() => {
                  setDesde(rango.desde)
                  setHasta(rango.hasta)
                }}
                className={`h-10 border-2 px-3 text-xs font-semibold uppercase tracking-wide ${
                  activo
                    ? 'border-escarlata bg-escarlata/15 text-crema'
                    : 'border-crema/25 text-crema/70 hover:border-crema/60 hover:text-crema'
                }`}
              >
                {texto}
              </button>
            )
          })}
        </div>
      </div>

      <div className="no-imprimir">
        <Pestanas items={VISTAS} />
      </div>

      <Outlet context={{ desde, hasta }} />
    </div>
  )
}

