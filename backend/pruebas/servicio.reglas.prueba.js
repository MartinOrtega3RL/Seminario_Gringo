import { describe, it, expect } from 'vitest'
import {
  transicionPermitida, siguientesEstados, cambiosManuales, admite, operacionesDisponibles,
  formatearNumeroOrden, puedeDarseComoReparada,
  diasCalendario, estaNoRetirada, limiteNoRetirada, liquidar,
  vencimientoGarantia, evaluarGarantia, fechaIso, inicioDeDia, finDeDia,
} from '../src/modulos/servicio/servicio.reglas.js'

// Estas pruebas no levantan base ni servidor: las reglas son funciones puras.
// Las fechas se arman con componentes locales (anio, mes, dia) y no con cadenas
// ISO, que JavaScript interpreta en UTC y corre un dia segun el huso.

const fecha = (anio, mes, dia, hora = 12) => new Date(anio, mes - 1, dia, hora)

describe('RF22.6 - ciclo de vida de la orden', () => {
  it('recorre el camino feliz de punta a punta', () => {
    const camino = [
      'RECIBIDO', 'EN_DIAGNOSTICO', 'PRESUPUESTADO', 'APROBADO',
      'EN_REPARACION', 'REPARADO', 'NOTIFICADO', 'ENTREGADO',
    ]
    for (let i = 0; i < camino.length - 1; i += 1) {
      expect(transicionPermitida(camino[i], camino[i + 1])).toBe(true)
    }
  })

  it('no deja saltearse el diagnostico ni el presupuesto', () => {
    expect(transicionPermitida('RECIBIDO', 'PRESUPUESTADO')).toBe(false)
    expect(transicionPermitida('EN_DIAGNOSTICO', 'EN_REPARACION')).toBe(false)
    expect(transicionPermitida('PRESUPUESTADO', 'EN_REPARACION')).toBe(false)
  })

  it('no deja volver atras', () => {
    expect(transicionPermitida('REPARADO', 'EN_REPARACION')).toBe(false)
    expect(transicionPermitida('NOTIFICADO', 'REPARADO')).toBe(false)
  })

  it('los estados finales no tienen salida', () => {
    expect(siguientesEstados('ENTREGADO')).toEqual([])
    expect(siguientesEstados('ANULADA')).toEqual([])
  })

  it('un presupuesto rechazado solo lleva a devolver el equipo', () => {
    expect(siguientesEstados('RECHAZADO')).toEqual(['NOTIFICADO', 'ENTREGADO'])
  })

  it('una orden en reparacion no se anula: ya consumio repuestos', () => {
    expect(transicionPermitida('EN_REPARACION', 'ANULADA')).toBe(false)
    expect(transicionPermitida('APROBADO', 'ANULADA')).toBe(true)
  })

  it('un estado desconocido no permite nada', () => {
    expect(siguientesEstados('INVENTADO')).toEqual([])
    expect(transicionPermitida('INVENTADO', 'RECIBIDO')).toBe(false)
  })

  it('el cambio manual no incluye lo que lleva datos propios', () => {
    // PRESUPUESTADO pide un monto, NOTIFICADO un medio, ENTREGADO la conformidad.
    expect(cambiosManuales('EN_DIAGNOSTICO')).toEqual(['NO_REPARABLE', 'ANULADA'])
    expect(cambiosManuales('REPARADO')).toEqual([])
    expect(cambiosManuales('RECIBIDO')).toEqual(['EN_DIAGNOSTICO', 'ANULADA'])
  })

  it('cada operacion tiene los estados en que corresponde', () => {
    expect(admite('repuestos', 'EN_REPARACION')).toBe(true)
    expect(admite('repuestos', 'REPARADO')).toBe(false)
    expect(admite('entregar', 'REPARADO')).toBe(true)
    expect(admite('entregar', 'EN_REPARACION')).toBe(false)
    expect(admite('operacion_inexistente', 'RECIBIDO')).toBe(false)
  })

  it('informa a la interfaz que se puede hacer en cada estado', () => {
    // El orden de la lista no es una promesa: se compara sin orden.
    expect(operacionesDisponibles('RECIBIDO')).toEqual(['diagnosticar'])
    expect([...operacionesDisponibles('EN_REPARACION')].sort()).toEqual(['repuestos', 'tareas'])
    expect(operacionesDisponibles('ENTREGADO')).toEqual([])
  })
})

describe('H09 - identificador de la orden', () => {
  it('rellena con ceros para que ordene bien y se lea de un vistazo', () => {
    expect(formatearNumeroOrden(1)).toBe('OS-000001')
    expect(formatearNumeroOrden(12345)).toBe('OS-012345')
  })
})

describe('RF22.6 - dar una orden por reparada', () => {
  it('exige al menos una tarea registrada: son las que cubre la garantia', () => {
    expect(puedeDarseComoReparada({ cantidadTareas: 0 }).admite).toBe(false)
    expect(puedeDarseComoReparada({ cantidadTareas: 1 }).admite).toBe(true)
  })

  it('explica por que no, en lugar de negarse sin decir nada', () => {
    expect(puedeDarseComoReparada({ cantidadTareas: 0 }).motivo).toMatch(/tareas/)
  })
})

describe('plazo de retiro (H08)', () => {
  it('cuenta dias de calendario, no horas', () => {
    const lunesTarde = fecha(2026, 10, 5, 18)
    const martesTemprano = fecha(2026, 10, 6, 9)
    expect(diasCalendario(lunesTarde, martesTemprano)).toBe(1)
  })

  it('al decimo dia todavia esta en plazo; al undecimo, no', () => {
    const notificada = { fechaNotificacion: fecha(2026, 10, 1, 10), fechaEntrega: null }
    expect(estaNoRetirada(notificada, fecha(2026, 10, 11, 9), 10)).toBe(false)
    expect(estaNoRetirada(notificada, fecha(2026, 10, 12, 9), 10)).toBe(true)
  })

  it('una orden entregada nunca esta sin retirar', () => {
    const entregada = { fechaNotificacion: fecha(2026, 9, 1), fechaEntrega: fecha(2026, 10, 1) }
    expect(estaNoRetirada(entregada, fecha(2026, 12, 1), 10)).toBe(false)
  })

  it('una orden sin notificar no corre plazo', () => {
    expect(estaNoRetirada({ fechaNotificacion: null, fechaEntrega: null }, fecha(2026, 12, 1), 10)).toBe(false)
  })

  it('el plazo sale del parametro: con 5 dias el limite se corre', () => {
    const notificada = { fechaNotificacion: fecha(2026, 10, 1, 10), fechaEntrega: null }
    expect(estaNoRetirada(notificada, fecha(2026, 10, 7, 9), 5)).toBe(true)
    expect(estaNoRetirada(notificada, fecha(2026, 10, 7, 9), 10)).toBe(false)
  })

  it('el corte para la base da exactamente el mismo resultado que la regla', () => {
    // La consulta del listado usa `fecha_notificacion < limite`. Si esa forma y
    // estaNoRetirada discreparan, el filtro y el aviso de cada orden se
    // contradecirian en pantalla. Se compara en todas las horas de varios dias.
    const hoy = fecha(2026, 10, 20, 15)
    const limite = limiteNoRetirada(hoy, 10)

    for (let dia = 5; dia <= 12; dia += 1) {
      for (const hora of [0, 6, 12, 18, 23]) {
        const fechaNotificacion = fecha(2026, 10, dia, hora)
        const porRegla = estaNoRetirada({ fechaNotificacion, fechaEntrega: null }, hoy, 10)
        expect(fechaNotificacion < limite, `dia ${dia} hora ${hora}`).toBe(porRegla)
      }
    }
  })
})

describe('RF23.3 - recargo por demora', () => {
  const repuestos = [{ cantidad: 2, precioUnitario: '1500.00' }]

  it('es el quince por ciento sobre presupuesto mas repuestos', () => {
    const resultado = liquidar({
      montoPresupuestado: '10000.00', repuestos, huboReparacion: true, noRetirada: true, porcentajeRecargo: 15,
    })
    expect(resultado.reparacion).toBe(1_300_000)
    expect(resultado.recargo).toBe(195_000)
    expect(resultado.total).toBe(1_495_000)
  })

  it('no hay recargo si se retira en plazo', () => {
    const resultado = liquidar({
      montoPresupuestado: '10000.00', repuestos, huboReparacion: true, noRetirada: false, porcentajeRecargo: 15,
    })
    expect(resultado.recargo).toBe(0)
    expect(resultado.total).toBe(resultado.reparacion)
  })

  it('si no se reparo no hay reparacion que cobrar ni sobre que recargar', () => {
    const resultado = liquidar({
      montoPresupuestado: '10000.00', repuestos, huboReparacion: false, noRetirada: true, porcentajeRecargo: 15,
    })
    expect(resultado).toEqual({ reparacion: 0, recargo: 0, total: 0 })
  })

  it('redondea el recargo al centavo, no lo trunca', () => {
    // 15% de 123,45 = 18,5175 -> 18,52
    const resultado = liquidar({
      montoPresupuestado: '123.45', repuestos: [], huboReparacion: true, noRetirada: true, porcentajeRecargo: 15,
    })
    expect(resultado.recargo).toBe(1852)
  })

  it('el porcentaje es un parametro: con 20 cambia el resultado', () => {
    const resultado = liquidar({
      montoPresupuestado: '1000.00', repuestos: [], huboReparacion: true, noRetirada: true, porcentajeRecargo: '20',
    })
    expect(resultado.recargo).toBe(20_000)
  })

  it('un presupuesto ausente cuenta como cero', () => {
    const resultado = liquidar({
      montoPresupuestado: null, repuestos, huboReparacion: true, noRetirada: false, porcentajeRecargo: 15,
    })
    expect(resultado.reparacion).toBe(300_000)
  })

  it('no arrastra error de punto flotante en los centavos', () => {
    const resultado = liquidar({
      montoPresupuestado: '0.10',
      repuestos: [{ cantidad: 1, precioUnitario: '0.20' }],
      huboReparacion: true, noRetirada: false, porcentajeRecargo: 15,
    })
    expect(resultado.reparacion).toBe(30)
  })
})

describe('RF24.1 - vencimiento de la garantia', () => {
  it('son treinta dias corridos desde la entrega', () => {
    expect(vencimientoGarantia(fecha(2026, 10, 2), 30)).toBe('2026-11-01')
  })

  it('cruza el fin de mes y el de anio', () => {
    expect(vencimientoGarantia(fecha(2026, 12, 20), 30)).toBe('2027-01-19')
    expect(vencimientoGarantia(fecha(2026, 1, 31), 30)).toBe('2026-03-02')
  })

  it('no depende de la hora de la entrega', () => {
    expect(vencimientoGarantia(fecha(2026, 10, 2, 0), 30)).toBe(vencimientoGarantia(fecha(2026, 10, 2, 23), 30))
  })

  it('los dias salen del parametro', () => {
    expect(vencimientoGarantia(fecha(2026, 10, 2), 90)).toBe('2026-12-31')
  })

  it('fechaIso arma el formato de un calendario, con ceros', () => {
    expect(fechaIso(fecha(2026, 3, 5))).toBe('2026-03-05')
  })
})

describe('RF24.2 - vigencia de la garantia', () => {
  const previa = { fechaVencGarantia: '2026-11-01' }

  it('esta vigente hasta el ultimo dia inclusive', () => {
    const ese = evaluarGarantia(previa, 'INTACTOS', fecha(2026, 11, 1))
    expect(ese.vigente).toBe(true)
    expect(ese.diasRestantes).toBe(0)
  })

  it('vence al dia siguiente', () => {
    const vencida = evaluarGarantia(previa, 'INTACTOS', fecha(2026, 11, 2))
    expect(vencida.vigente).toBe(false)
    expect(vencida.motivo).toBe('VENCIDA')
  })

  it('los sellos rotos la anulan aunque este en fecha', () => {
    const anulada = evaluarGarantia(previa, 'VIOLADOS', fecha(2026, 10, 10))
    expect(anulada.vigente).toBe(false)
    expect(anulada.motivo).toBe('SELLOS_VIOLADOS')
    expect(anulada.diasRestantes).toBeGreaterThan(0)
  })

  it('sin sello puesto no se la anula: lo que excluye es el sello roto', () => {
    expect(evaluarGarantia(previa, 'SIN_SELLO', fecha(2026, 10, 10)).vigente).toBe(true)
  })

  it('cuenta los dias que le quedan', () => {
    expect(evaluarGarantia(previa, 'INTACTOS', fecha(2026, 10, 22)).diasRestantes).toBe(10)
  })

  it('sin reparacion previa no hay garantia que invocar', () => {
    expect(evaluarGarantia(null, 'INTACTOS', fecha(2026, 10, 10)).motivo).toBe('SIN_GARANTIA')
    expect(evaluarGarantia({ fechaVencGarantia: null }, 'INTACTOS', fecha(2026, 10, 10)).vigente).toBe(false)
  })

  it('siempre trae un mensaje listo para mostrar', () => {
    expect(evaluarGarantia(previa, 'VIOLADOS', fecha(2026, 10, 10)).mensaje).toMatch(/sellos/)
  })
})

describe('limites de un dia del calendario', () => {
  it('el dia empieza a las 00:00 y termina a las 23:59:59 en hora local', () => {
    const inicio = inicioDeDia('2026-10-23')
    const fin = finDeDia('2026-10-23')
    expect([inicio.getHours(), inicio.getMinutes()]).toEqual([0, 0])
    expect([fin.getHours(), fin.getMinutes(), fin.getSeconds()]).toEqual([23, 59, 59])
    expect(fechaIso(inicio)).toBe('2026-10-23')
    expect(fechaIso(fin)).toBe('2026-10-23')
  })

  it('una venta de las 22:00 cae dentro de su dia y no en el siguiente', () => {
    const noche = new Date(2026, 9, 23, 22, 0)
    expect(noche >= inicioDeDia('2026-10-23') && noche <= finDeDia('2026-10-23')).toBe(true)
    expect(noche >= inicioDeDia('2026-10-24')).toBe(false)
  })

  it('el dia siguiente arranca justo despues de que termina el anterior', () => {
    expect(finDeDia('2026-10-23') < inicioDeDia('2026-10-24')).toBe(true)
    expect(inicioDeDia('2026-10-24') - finDeDia('2026-10-23')).toBe(1)
  })
})
