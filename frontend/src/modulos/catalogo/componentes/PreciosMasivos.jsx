import { useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Select, Texto, Par } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

// RF08.4 — actualización masiva por porcentaje sobre una categoría o una marca.
//
// Decisión del equipo (S09): no la pidió el cliente, se adopta por la frecuencia
// de reajuste que impone el contexto de precios. Por eso mismo es la operación
// que más daño hace si sale mal, y la única del sistema que pide confirmar
// escribiendo: toca muchos precios de una y no hay deshacer.

const LISTAS = [
  { valor: 'MINORISTA', texto: 'Solo el precio minorista' },
  { valor: 'MAYORISTA', texto: 'Solo el precio mayorista' },
  { valor: 'AMBAS', texto: 'Los dos precios de venta' },
  { valor: 'COSTO', texto: 'Solo el costo' },
]

const CONFIRMACION = 'ACTUALIZAR'

export const PreciosMasivos = ({ abierto, categorias, marcas, alCerrar, alAplicar }) => {
  const [alcance, setAlcance] = useState('categoria')
  const [idAlcance, setIdAlcance] = useState('')
  const [lista, setLista] = useState('AMBAS')
  const [porcentaje, setPorcentaje] = useState('')
  const [confirmacion, setConfirmacion] = useState('')
  const [error, setError] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  const valor = Number(porcentaje)
  const valido = porcentaje !== '' && Number.isFinite(valor) && valor !== 0 && Boolean(idAlcance)
  const habilitado = valido && confirmacion.trim().toUpperCase() === CONFIRMACION

  const opciones =
    alcance === 'categoria'
      ? categorias.map((c) => ({ valor: String(c.idCategoria), texto: c.nombre }))
      : marcas.map((m) => ({ valor: String(m.idMarca), texto: m.nombre }))

  const nombreAlcance = opciones.find((o) => o.valor === idAlcance)?.texto ?? ''

  const aplicar = async () => {
    setTrabajando(true)
    setError(null)

    try {
      await alAplicar({
        alcance,
        idAlcance: Number(idAlcance),
        lista,
        porcentaje: valor,
      })
      setPorcentaje('')
      setConfirmacion('')
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setTrabajando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo="Actualizar precios en masa"
      descripcion="Aplica un porcentaje sobre todos los productos de una categoría o de una marca."
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando}>
            Cancelar
          </Boton>
          <Boton onClick={aplicar} disabled={!habilitado} cargando={trabajando}>
            Aplicar {valor > 0 ? `+${valor}` : valor}%
          </Boton>
        </div>
      }
    >
      <div className="grid gap-4">
        <Par>
          <Select
            etiqueta="Aplicar sobre"
            value={alcance}
            onChange={(evento) => {
              setAlcance(evento.target.value)
              setIdAlcance('')
            }}
            opciones={[
              { valor: 'categoria', texto: 'Una categoría' },
              { valor: 'marca', texto: 'Una marca' },
            ]}
          />
          <Select
            etiqueta={alcance === 'categoria' ? 'Categoría' : 'Marca'}
            obligatorio
            value={idAlcance}
            onChange={(evento) => setIdAlcance(evento.target.value)}
            vacio="Elegir…"
            opciones={opciones}
          />
        </Par>

        <Select
          etiqueta="Qué precios toca"
          value={lista}
          onChange={(evento) => setLista(evento.target.value)}
          opciones={LISTAS}
        />

        <Texto
          etiqueta="Porcentaje"
          obligatorio
          type="number"
          step="0.1"
          prefijo="%"
          value={porcentaje}
          onChange={(evento) => setPorcentaje(evento.target.value)}
          ayuda="Positivo aumenta, negativo descuenta. Por ejemplo -10 para una liquidación."
        />

        {valido && (
          <div className="border-2 border-ambar bg-ambar/10 px-3 py-3">
            <p className="text-sm leading-relaxed text-crema">
              Vas a {valor > 0 ? 'aumentar' : 'descontar'}{' '}
              <strong className="numeral text-ambar">{Math.abs(valor)}%</strong> a todos los
              productos {alcance === 'categoria' ? 'de la categoría' : 'de la marca'}{' '}
              <strong>{nombreAlcance}</strong>.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-crema/70">
              Esto no se puede deshacer. Escribí <strong className="text-ambar">{CONFIRMACION}</strong>{' '}
              para habilitar el botón.
            </p>

            <label htmlFor="confirmacion-precios" className="sr-only">
              Escribí {CONFIRMACION} para confirmar
            </label>
            <input
              id="confirmacion-precios"
              value={confirmacion}
              onChange={(evento) => setConfirmacion(evento.target.value)}
              className="numeral mt-2 h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-3 text-sm font-semibold uppercase tracking-widest text-tinta"
            />
          </div>
        )}

        {error && <Aviso tono="mal">{error}</Aviso>}
      </div>
    </Dialogo>
  )
}
