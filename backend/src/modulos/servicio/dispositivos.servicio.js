import { Dispositivo, ModeloDispositivo, Marca, OrdenServicio, EstadoOrden, Cliente, Persona } from '../../modelos/index.js'
import { evaluarGarantia } from './servicio.reglas.js'

/**
 * RF25.2 — historial de reparaciones de un equipo, a partir de su IMEI o numero
 * de serie; y RF24.2 — vigencia de la garantia de la reparacion previa.
 *
 * Se consulta por el equipo y no por el cliente: el titular puede cambiar (el
 * celular se vendio, se regalo) y el historial tiene que sobrevivir a eso. Por
 * eso el dispositivo no se vincula al cliente en el modelo de datos.
 *
 * Lo llama la pantalla de recepcion apenas se carga el IMEI: si el equipo tiene
 * una garantia vigente, quien lo recibe se entera ahi, con el cliente adelante,
 * y no cuando ya se lo llevo.
 *
 * @param {{imei: string, sellos?: 'INTACTOS'|'VIOLADOS'|'SIN_SELLO'}} consulta
 *   `sellos` es el estado con el que el equipo esta volviendo: los sellos rotos
 *   anulan la garantia aunque este en fecha (H07).
 */
export const consultarDispositivo = async ({ imei, sellos = 'SIN_SELLO' }, hoy = new Date()) => {
  const dispositivo = await Dispositivo.findOne({
    where: { imeiSerie: imei },
    include: [{
      model: ModeloDispositivo,
      as: 'modelo',
      include: [{ model: Marca, as: 'marca', attributes: ['idMarca', 'nombre'] }],
    }],
  })

  if (!dispositivo) {
    return { dispositivo: null, ordenes: [], ordenConGarantia: null, garantia: evaluarGarantia(null, sellos, hoy) }
  }

  const ordenes = await OrdenServicio.findAll({
    where: { idDispositivo: dispositivo.idDispositivo },
    include: [
      { model: EstadoOrden, as: 'estado' },
      {
        model: Cliente,
        as: 'cliente',
        attributes: ['idCliente'],
        include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre'] }],
      },
    ],
    order: [['fechaIngreso', 'DESC'], ['idOrden', 'DESC']],
  })

  // La garantia que se puede invocar es la de la ultima reparacion entregada:
  // las anteriores ya quedaron cubiertas por la siguiente.
  const ordenConGarantia = ordenes
    .filter((orden) => orden.fechaVencGarantia)
    .sort((a, b) => String(b.fechaVencGarantia).localeCompare(String(a.fechaVencGarantia)))[0] ?? null

  return {
    dispositivo: dispositivo.get({ plain: true }),
    ordenes: ordenes.map((orden) => orden.get({ plain: true })),
    ordenConGarantia: ordenConGarantia && {
      idOrden: ordenConGarantia.idOrden,
      numeroOrden: ordenConGarantia.numeroOrden,
      fechaEntrega: ordenConGarantia.fechaEntrega,
      fechaVencGarantia: ordenConGarantia.fechaVencGarantia,
    },
    garantia: evaluarGarantia(ordenConGarantia, sellos, hoy),
  }
}
