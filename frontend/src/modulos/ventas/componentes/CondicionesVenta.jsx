import { useState } from 'react'

// RF16.6, RF16.8 y RF17.3 — medio de pago, modalidad de pago con cuotas, y
// modalidad de entrega.
//
// Van plegadas por omision y muestran el resumen de lo elegido. El caso
// frecuente en el mostrador es contado, efectivo y retiro en el local: RNF01
// da tres segundos para registrar una venta, y desplegar cuatro controles que
// casi nunca se tocan gasta ese presupuesto en la operacion mas repetida.

const MODALIDADES = [
  ['CONTADO', 'Contado'],
  ['FINANCIACION_PROPIA', 'Financiacion del comercio'],
  ['TARJETA_CUOTAS', 'Tarjeta en cuotas'],
  ['GO_CUOTAS', 'Go Cuotas'],
]

const ENTREGAS = [
  ['RETIRO_LOCAL', 'Retiro en el local'],
  ['ENVIO_DOMICILIO', 'Envio a domicilio'],
]

const SELECT =
  'h-10 w-full rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta disabled:opacity-45'

const ROTULO = 'mb-1 block text-[10px] font-bold uppercase tracking-[0.16em] text-crema/60'

export const CondicionesVenta = ({
  mediosPago,
  condiciones,
  alCambiar,
  deshabilitado,
  errorDomicilio,
}) => {
  const [abierto, setAbierto] = useState(false)

  const { idMedioPago, modalidadPago, cantidadCuotas, modalidadEntrega, domicilioEntrega } = condiciones
  const enCuotas = modalidadPago !== 'CONTADO'
  const conEnvio = modalidadEntrega === 'ENVIO_DOMICILIO'

  const medio = mediosPago.find((m) => m.idMedioPago === idMedioPago)
  const resumen = [
    MODALIDADES.find(([valor]) => valor === modalidadPago)?.[1],
    medio?.nombre,
    conEnvio ? 'Envio' : 'Retiro',
  ]
    .filter(Boolean)
    .join(' · ')

  const cambiar = (clave) => (evento) => {
    const valor = evento.target.value
    const numerico = clave === 'idMedioPago' || clave === 'cantidadCuotas'
    alCambiar({ ...condiciones, [clave]: numerico ? Number(valor) : valor })
  }

  return (
    <div className="border-2 border-crema/20">
      <button
        type="button"
        onClick={() => setAbierto((previo) => !previo)}
        aria-expanded={abierto}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-crema/5"
      >
        <span className="min-w-0">
          <span className={ROTULO}>Condiciones</span>
          <span className="block truncate text-sm font-semibold text-crema">{resumen}</span>
        </span>
        <span className="shrink-0 text-[11px] font-bold uppercase tracking-wider text-ambar">
          {abierto ? 'Listo' : 'Cambiar'}
        </span>
      </button>

      {abierto && (
        <div className="grid gap-3 border-t-2 border-crema/15 px-3 py-3">
          <div>
            <label className={ROTULO} htmlFor="medio-pago">
              Medio de pago
            </label>
            <select
              id="medio-pago"
              className={SELECT}
              value={idMedioPago ?? ''}
              disabled={deshabilitado || mediosPago.length === 0}
              onChange={cambiar('idMedioPago')}
            >
              {mediosPago.map((opcion) => (
                <option key={opcion.idMedioPago} value={opcion.idMedioPago}>
                  {opcion.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={ROTULO} htmlFor="modalidad-pago">
              Modalidad
            </label>
            <select
              id="modalidad-pago"
              className={SELECT}
              value={modalidadPago}
              disabled={deshabilitado}
              onChange={cambiar('modalidadPago')}
            >
              {MODALIDADES.map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </div>

          {/* La base exige que contado no lleve cuotas y que el resto lleve al
              menos una: el control aparece solo cuando corresponde. */}
          {enCuotas && (
            <div>
              <label className={ROTULO} htmlFor="cuotas">
                Cantidad de cuotas
              </label>
              <input
                id="cuotas"
                type="number"
                min="1"
                max="24"
                className={`${SELECT} numeral`}
                value={cantidadCuotas ?? 1}
                disabled={deshabilitado}
                onChange={cambiar('cantidadCuotas')}
              />
            </div>
          )}

          <div>
            <label className={ROTULO} htmlFor="entrega">
              Entrega
            </label>
            <select
              id="entrega"
              className={SELECT}
              value={modalidadEntrega}
              disabled={deshabilitado}
              onChange={cambiar('modalidadEntrega')}
            >
              {ENTREGAS.map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </select>
          </div>

          {/* H19: los envios se coordinan por WhatsApp, pero la direccion tiene
              que quedar registrada en la venta. */}
          {conEnvio && (
            <div>
              <label className={ROTULO} htmlFor="domicilio">
                Direccion de entrega
              </label>
              <input
                id="domicilio"
                type="text"
                maxLength={200}
                className={SELECT}
                value={domicilioEntrega ?? ''}
                disabled={deshabilitado}
                onChange={cambiar('domicilioEntrega')}
                aria-invalid={errorDomicilio ? true : undefined}
                aria-describedby={errorDomicilio ? 'domicilio-error' : undefined}
                placeholder="Calle, numero, barrio"
              />
              {errorDomicilio && (
                <p id="domicilio-error" role="alert" className="mt-1 text-xs font-semibold text-ambar">
                  {errorDomicilio}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
