import { useState } from 'react'
import { formatearFechaCuota, generarPlan, MODALIDADES_PAGO, CUOTAS_MAXIMAS, resumenCuotas } from '../cuotas.reglas.js'
import { pesos } from '../../servicio/servicio.reglas.js'
import { textoCuotas } from '../ventas.reglas.js'

// RF16.6, RF16.8 y RF17.3 — medio de pago, modalidad de pago con cuotas, y
// modalidad de entrega.
//
// Van plegadas por omision y muestran el resumen de lo elegido. El caso
// frecuente en el mostrador es contado, efectivo y retiro en el local: RNF01
// da tres segundos para registrar una venta, y desplegar cuatro controles que
// casi nunca se tocan gasta ese presupuesto en la operacion mas repetida.

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
  totalCentavos = 0,
  tieneCliente = false,
}) => {
  const [abierto, setAbierto] = useState(false)

  const { idMedioPago, referenciaPago = '', modalidadPago, cantidadCuotas, recargoFinanciacion = 0, modalidadEntrega, domicilioEntrega } = condiciones
  const modalidadInfo = MODALIDADES_PAGO[modalidadPago] ?? MODALIDADES_PAGO.CONTADO
  const enCuotas = modalidadInfo.enCuotas
  const esFinanciacionPropia = modalidadInfo.financia === 'COMERCIO'
  const admiteRecargo = modalidadInfo.admiteRecargo
  const conEnvio = modalidadEntrega === 'ENVIO_DOMICILIO'
  const cuotasValidas = Math.max(1, Math.min(CUOTAS_MAXIMAS, Number(cantidadCuotas) || 1))

  const plan = esFinanciacionPropia && totalCentavos > 0
    ? generarPlan({ total: totalCentavos / 100, cantidadCuotas: cuotasValidas, fechaVenta: new Date() })
    : []

  const cuotaAprox = !esFinanciacionPropia && enCuotas && totalCentavos > 0
    ? resumenCuotas({
        modalidadPago,
        total: totalCentavos / 100,
        recargoFinanciacion,
        cantidadCuotas: cuotasValidas,
      })
    : null

  const medio = mediosPago.find((m) => m.idMedioPago === idMedioPago)
  // En efectivo no hay operacion que anotar; en tarjeta, transferencia o
  // GO Cuotas el numero queda en pago_venta.referencia (S11: no hay integracion).
  const llevaOperacion = modalidadInfo.cobraAlVender && medio && !medio.nombre.toLowerCase().includes('efectivo')
  const resumen = [
    modalidadInfo.nombre,
    modalidadInfo.cobraAlVender ? medio?.nombre : (cantidadCuotas ? `${cantidadCuotas} cuotas` : null),
    conEnvio ? 'Envio' : 'Retiro',
  ]
    .filter(Boolean)
    .join(' · ')

  const cambiar = (clave) => (evento) => {
    const valor = evento.target.value

    if (clave === 'modalidadPago') {
      let nuevoMedio = idMedioPago
      if (valor === 'TARJETA_CUOTAS') {
        const encontrado = mediosPago.find((m) => m.nombre.toLowerCase().includes('tarjeta'))
        nuevoMedio = encontrado ? encontrado.idMedioPago : null
      } else if (valor === 'GO_CUOTAS') {
        const encontrado = mediosPago.find((m) => m.nombre.toLowerCase().includes('go cuotas'))
        nuevoMedio = encontrado ? encontrado.idMedioPago : null
      } else if (valor === 'FINANCIACION_PROPIA') {
        nuevoMedio = null
      } else if (valor === 'CONTADO' && !nuevoMedio) {
        const efectivo = mediosPago.find((m) => m.nombre.toLowerCase().includes('efectivo'))
        nuevoMedio = efectivo ? efectivo.idMedioPago : (mediosPago[0]?.idMedioPago ?? null)
      }

      const info = MODALIDADES_PAGO[valor]
      alCambiar({
        ...condiciones,
        modalidadPago: valor,
        idMedioPago: nuevoMedio,
        referenciaPago: '',
        cantidadCuotas: !info?.enCuotas ? null : (condiciones.cantidadCuotas || 1),
        recargoFinanciacion: !info?.admiteRecargo ? 0 : (condiciones.recargoFinanciacion ?? 0),
      })
      return
    }

    const numerico = clave === 'idMedioPago' || clave === 'cantidadCuotas' || clave === 'recargoFinanciacion'
    alCambiar({
      ...condiciones,
      [clave]: numerico ? (valor === '' ? '' : Number(valor)) : valor,
      // El numero de operacion es del medio elegido: si cambia el medio, se vuelve a cargar.
      ...(clave === 'idMedioPago' ? { referenciaPago: '' } : {}),
    })
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
          {modalidadInfo.cobraAlVender && (
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
          )}

          {llevaOperacion && (
            <div>
              <label className={ROTULO} htmlFor="referencia-pago">
                N.º de operación (opcional)
              </label>
              <input
                id="referencia-pago"
                type="text"
                maxLength={60}
                className={`${SELECT} numeral`}
                value={referenciaPago}
                disabled={deshabilitado}
                onChange={cambiar('referenciaPago')}
              />
            </div>
          )}

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
              {Object.entries(MODALIDADES_PAGO).map(([valor, info]) => (
                <option key={valor} value={valor}>
                  {info.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* La base exige que contado no lleve cuotas y que el resto lleve al
              menos una: el control aparece solo cuando corresponde. */}
          {enCuotas && (
            <div className="grid gap-3">
              <div>
                <label className={ROTULO} htmlFor="cuotas">
                  Cantidad de cuotas
                </label>
                <input
                  id="cuotas"
                  type="number"
                  min="1"
                  max={CUOTAS_MAXIMAS}
                  className={`${SELECT} numeral`}
                  value={cantidadCuotas ?? 1}
                  disabled={deshabilitado}
                  onChange={cambiar('cantidadCuotas')}
                />
              </div>

              {admiteRecargo && (
                <div>
                  <label className={ROTULO} htmlFor="recargo-financiacion">
                    Recargo ($)
                  </label>
                  <input
                    id="recargo-financiacion"
                    type="number"
                    min="0"
                    step="0.01"
                    className={`${SELECT} numeral`}
                    value={recargoFinanciacion ?? 0}
                    disabled={deshabilitado}
                    onChange={cambiar('recargoFinanciacion')}
                  />
                  {cuotaAprox != null && (
                    <p className="mt-1 text-xs font-semibold text-crema/80">
                      {textoCuotas(cuotasValidas)} de aprox. ${pesos(cuotaAprox)}
                    </p>
                  )}
                </div>
              )}

              {esFinanciacionPropia && (
                <>
                  <div>
                    <label className={ROTULO} htmlFor="recargo-financiacion">
                      Recargo ($)
                    </label>
                    <input
                      id="recargo-financiacion"
                      type="number"
                      className={`${SELECT} numeral`}
                      value={0}
                      disabled
                      readOnly
                    />
                    <p className="mt-1 text-[11px] text-crema/65">
                      Sin recargo sobre contado (S10).
                    </p>
                  </div>

                  {!tieneCliente && (
                    <p className="border border-ambar/50 bg-ambar/10 px-2.5 py-1.5 text-xs font-semibold text-ambar">
                      Asociá un cliente arriba para poder confirmar en cuotas propias.
                    </p>
                  )}

                  {plan.length > 0 && (
                    <div className="border border-crema/20 bg-tinta/40 p-2.5">
                      <p className={ROTULO}>Vista previa del plan</p>
                      <table className="w-full text-xs text-crema">
                        <thead>
                          <tr className="border-b border-crema/15 text-left text-[10px] uppercase text-crema/55">
                            <th className="py-1">Cuota</th>
                            <th className="py-1">Vencimiento</th>
                            <th className="py-1 text-right">Importe</th>
                          </tr>
                        </thead>
                        <tbody>
                          {plan.map((c) => (
                            <tr key={c.numeroCuota} className="border-b border-crema/10 last:border-0">
                              <td className="numeral py-1">{c.numeroCuota}/{plan.length}</td>
                              <td className="numeral py-1">{formatearFechaCuota(c.fechaVencimiento)}</td>
                              <td className="numeral py-1 text-right font-semibold">${pesos(c.importe)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
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
