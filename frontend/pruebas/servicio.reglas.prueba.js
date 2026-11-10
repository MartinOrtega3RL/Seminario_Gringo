import { describe, it, expect } from 'vitest'
import {
  tonoDeEstado, nombreEquipo, soloFecha, fechaCorta, fechaHora, pesos, diasRestantes, haceDiasIso, hoyIso,
} from '../src/modulos/servicio/servicio.reglas.js'

// Estas pruebas no levantan navegador: son funciones de datos a datos.

describe('tono de la marca de estado', () => {
  it('el escarlata es solo para lo que pide que alguien haga algo', () => {
    expect(tonoDeEstado('ANULADA')).toBe('alerta')
    expect(tonoDeEstado('NOTIFICADO', true)).toBe('alerta')
  })

  it('una orden en curso no se pinta de alerta', () => {
    expect(tonoDeEstado('EN_REPARACION')).toBe('neutro')
    expect(tonoDeEstado('RECIBIDO')).toBe('neutro')
  })

  it('destaca lo que espera una respuesta o un aviso', () => {
    expect(tonoDeEstado('PRESUPUESTADO')).toBe('destacado')
    expect(tonoDeEstado('REPARADO')).toBe('destacado')
  })

  it('fuera de plazo gana sobre cualquier otro estado', () => {
    expect(tonoDeEstado('REPARADO', true)).toBe('alerta')
  })
})

describe('nombre del equipo', () => {
  it('une marca y modelo', () => {
    expect(nombreEquipo({ modelo: { denominacion: 'iPhone 13', marca: { nombre: 'Apple' } } })).toBe('Apple iPhone 13')
  })

  it('no se rompe si falta la marca o el dispositivo', () => {
    expect(nombreEquipo({ modelo: { denominacion: 'Moto G54' } })).toBe('Moto G54')
    expect(nombreEquipo(null)).toBe('Equipo sin identificar')
  })
})

describe('fechas', () => {
  it('una fecha sin hora no se corre un dia por el huso horario', () => {
    // new Date('2026-11-10') es medianoche UTC: en Formosa daria el 9.
    expect(soloFecha('2026-11-10')).toBe('10/11/2026')
    expect(soloFecha('2026-01-01')).toBe('01/01/2026')
  })

  it('una fecha ausente da texto vacio, no "Invalid Date"', () => {
    expect(soloFecha(null)).toBe('')
    expect(fechaCorta(null)).toBe('')
    expect(fechaHora(undefined)).toBe('')
  })

  it('una marca de tiempo se muestra en hora local, con ceros', () => {
    const local = new Date(2026, 9, 5, 9, 7)
    expect(fechaHora(local.toISOString())).toBe('05/10/26 09:07')
    expect(fechaCorta(local.toISOString())).toBe('05/10/26')
  })

  it('hace N dias retrocede por el calendario', () => {
    expect(haceDiasIso(0)).toBe(hoyIso())
    expect(haceDiasIso(1) < hoyIso()).toBe(true)
  })

  it('cuenta los dias que quedan de garantia', () => {
    expect(diasRestantes(0)).toBe('vence hoy')
    expect(diasRestantes(1)).toBe('queda 1 día')
    expect(diasRestantes(18)).toBe('quedan 18 días')
  })
})

describe('importes', () => {
  it('formatea a la argentina, con dos decimales', () => {
    expect(pesos('31625.00')).toBe('31.625,00')
    expect(pesos(0)).toBe('0,00')
  })

  it('un importe ausente es cero', () => {
    expect(pesos(null)).toBe('0,00')
  })
})
