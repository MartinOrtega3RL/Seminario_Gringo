import { useState } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarMovimientos, registrarIngreso, registrarAjuste, registrarConsumoReparacion } from '../existencias.api.js'
import { DialogoIngreso } from '../componentes/DialogoIngreso.jsx'
import { DialogoAjuste } from '../componentes/DialogoAjuste.jsx'
import { DialogoReparacion } from '../componentes/DialogoReparacion.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { IconoEntrar, IconoBalanza, IconoQuitar } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF11.1, RF11.5 y RF12.4 — el libro mayor del inventario.
//
// Es la pantalla que contesta "¿por qué hay esta cantidad?": cada renglón dice
// qué pasó, cuánto, quién y cuándo. Sin esto, un descuadre no tiene dónde
// buscarse.

const TIPOS = [
  { valor: '', texto: 'Todos los movimientos' },
  { valor: 'INGRESO', texto: 'Ingresos' },
  { valor: 'VENTA', texto: 'Ventas' },
  { valor: 'AJUSTE', texto: 'Ajustes manuales' },
  { valor: 'DEVOLUCION', texto: 'Devoluciones' },
  { valor: 'REPARACION', texto: 'Consumo en reparación' },
]

const TONO = { AJUSTE: 'alerta', INGRESO: 'destacado', DEVOLUCION: 'destacado' }

const fecha = (valor) =>
  new Date(valor).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

export const Existencias = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CATALOGO_STOCK')

  const [tipo, setTipo] = useState('')
  const listado = useListadoPaginado(listarMovimientos, {
    tamano: 25,
    filtros: { tipo: tipo || undefined },
  })

  const [ingresoAbierto, setIngresoAbierto] = useState(false)
  const [ajusteAbierto, setAjusteAbierto] = useState(false)
  const [reparacionAbierta, setReparacionAbierta] = useState(false)

  const guardarIngreso = async (datos) => {
    await registrarIngreso(datos)
    setIngresoAbierto(false)
    listado.recargar()
  }

  const guardarAjuste = async (datos) => {
    await registrarAjuste(datos)
    setAjusteAbierto(false)
    listado.recargar()
  }

  // RF11.3 — el consumo del taller, que hoy va a una planilla en papel (H29).
  const guardarReparacion = async (datos) => {
    await registrarConsumoReparacion(datos)
    setReparacionAbierta(false)
    listado.recargar()
  }

  const { datos: movimientos, paginacion, cargando, error } = listado

  return (
    <div className="grid gap-5">
      {escritura && (
        <div className="flex flex-wrap justify-end gap-2">
          <Boton tono="papel" onClick={() => setReparacionAbierta(true)}>
            <IconoQuitar />
            Usado en reparación
          </Boton>
          <Boton tono="papel" onClick={() => setAjusteAbierto(true)}>
            <IconoBalanza />
            Ajuste
          </Boton>
          <Boton onClick={() => setIngresoAbierto(true)}>
            <IconoEntrar />
            Registrar ingreso
          </Boton>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="filtro-tipo" className="sr-only">
          Filtrar por tipo de movimiento
        </label>
        <select
          id="filtro-tipo"
          value={tipo}
          onChange={(evento) => setTipo(evento.target.value)}
          className="h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta"
        >
          {TIPOS.map(({ valor, texto }) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </select>
      </div>

      {error && <Fallo error={error} reintentar={listado.recargar} />}

      {!error && cargando && movimientos.length === 0 && (
        <Cargando filas={6} etiqueta="Cargando movimientos" />
      )}

      {!error && !cargando && movimientos.length === 0 && (
        <Vacio
          titulo={tipo ? 'No hay movimientos de ese tipo' : 'Todavía no hay movimientos'}
          detalle="Cada venta, ingreso o ajuste deja su registro acá, con el responsable y la fecha."
          accion={
            tipo ? (
              <Boton tono="papel" onClick={() => setTipo('')}>
                Ver todos
              </Boton>
            ) : (
              escritura && <Boton onClick={() => setIngresoAbierto(true)}>Registrar el primer ingreso</Boton>
            )
          }
        />
      )}

      {movimientos.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {movimientos.map((movimiento) => (
              <Fila
                key={movimiento.idMovimiento}
                principal={movimiento.producto?.denominacion ?? 'Producto dado de baja'}
                secundario={
                  [
                    fecha(movimiento.fechaHora),
                    movimiento.usuario?.nombreUsuario,
                    movimiento.producto?.codigoInterno,
                    movimiento.motivo,
                  ]
                    .filter(Boolean)
                    .join(' · ')
                }
                derecha={
                  <span className="flex items-center gap-3">
                    <Marca tono={TONO[movimiento.tipoMovimiento] ?? 'neutro'}>
                      {movimiento.tipoMovimiento}
                    </Marca>
                    <span className="text-right">
                      <span
                        className={`numeral block text-base font-bold ${
                          movimiento.cantidad > 0 ? 'text-ambar' : 'text-crema'
                        }`}
                      >
                        {movimiento.cantidad > 0 ? '+' : '−'}
                        {Math.abs(movimiento.cantidad)}
                      </span>
                      <span className="numeral block text-[11px] text-crema/50">
                        queda {movimiento.stockResultante}
                      </span>
                    </span>
                  </span>
                }
              />
            ))}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <DialogoIngreso
        abierto={ingresoAbierto}
        alCerrar={() => setIngresoAbierto(false)}
        alRegistrar={guardarIngreso}
      />

      <DialogoAjuste
        abierto={ajusteAbierto}
        alCerrar={() => setAjusteAbierto(false)}
        alRegistrar={guardarAjuste}
      />

      <DialogoReparacion
        abierto={reparacionAbierta}
        alCerrar={() => setReparacionAbierta(false)}
        alRegistrar={guardarReparacion}
      />
    </div>
  )
}
