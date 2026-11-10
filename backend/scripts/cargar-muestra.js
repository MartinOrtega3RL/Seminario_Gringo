// Datos de muestra para probar y para demostrar el sistema.
//
//   npm run cargar-muestra               carga el catalogo y las ordenes de servicio
//   npm run cargar-muestra -- --borrar   los saca
//
// Son datos de DEMOSTRACION, no del comercio: los precios y los clientes son
// plausibles pero inventados. Los articulos llevan el prefijo DEMO en su codigo
// interno y los clientes llevan "DEMO" en el nombre, para que se los distinga
// de algo real de un vistazo y para que borrarlos no toque nunca algo cargado
// en serio.
//
// Las ordenes de servicio NO se insertan a mano en la base: se cargan llamando a
// las mismas funciones que usa el sistema, asi que pasan por las mismas reglas
// (transiciones de estado, guarda de stock). Lo unico que se retoca a mano son
// las fechas de dos ordenes y de todos sus pasos, para que la demostracion
// muestre un equipo sin retirar fuera de plazo y una garantia en curso, que no
// se pueden fabricar esperando el tiempo que lleva.

import { unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { Op } from 'sequelize'
import { sequelize } from '../src/config/base-de-datos.js'
import {
  Producto, Categoria, Marca, Persona, Cliente, TipoCliente, Usuario,
  OrdenServicio, OrdenEstadoHistorial, Dispositivo, MovimientoStock, FotoOrden, TareaRealizada,
} from '../src/modelos/index.js'
import { registrarCliente } from '../src/modulos/clientes/clientes.servicio.js'
import {
  recepcionar, diagnosticar, presupuestar, responderPresupuesto, cambiarEstado, notificar, entregar,
} from '../src/modulos/servicio/ordenes.servicio.js'
import { registrarRepuesto, registrarTarea } from '../src/modulos/servicio/reparacion.servicio.js'
import { vencimientoGarantia } from '../src/modulos/servicio/servicio.reglas.js'
import { CARPETA_FOTOS } from '../src/modulos/servicio/fotos.js'

const PREFIJO = 'DEMO-'

const ARTICULOS = [
  ['Funda silicona lisa', 'Fundas', 'Apple', 12000, 8400, 5600, 24, 6],
  ['Funda antigolpe reforzada', 'Fundas', 'Samsung', 15500, 10850, 7200, 11, 4],
  ['Funda transparente antishock', 'Fundas', 'Motorola', 9800, 6860, 4500, 3, 5],
  ['Vidrio templado 9H', 'Vidrios templados', 'Apple', 7500, 5250, 3400, 40, 10],
  ['Vidrio templado ceramico', 'Vidrios templados', 'Samsung', 9200, 6440, 4100, 0, 8],
  ['Vidrio templado privacidad', 'Vidrios templados', 'Xiaomi', 11800, 8260, 5400, 7, 6],
  ['Cargador rapido 20W USB-C', 'Cargadores', 'Apple', 28000, 19600, 13500, 15, 4],
  ['Cargador 33W carga turbo', 'Cargadores', 'Xiaomi', 24500, 17150, 11800, 9, 4],
  ['Cable USB-C a Lightning 1 m', 'Cargadores', 'Apple', 16500, 11550, 7900, 22, 8],
  ['Auriculares inalambricos', 'Auriculares', 'Samsung', 62000, 43400, 31000, 5, 2],
  ['Auriculares con cable 3.5', 'Auriculares', 'Motorola', 8900, 6230, 4100, 18, 6],
  ['Pin de carga USB-C', 'Repuestos', 'Samsung', 18500, 12950, 9200, 6, 3],
  ['Modulo de pantalla OLED', 'Repuestos', 'Apple', 145000, 101500, 78000, 2, 1],
  ['Bateria de repuesto', 'Repuestos', 'Xiaomi', 32000, 22400, 16500, 4, 2],
  ['Soporte de auto magnetico', 'Accesorios', 'Motorola', 13500, 9450, 6300, 12, 4],
  ['Power bank 10.000 mAh', 'Accesorios', 'Xiaomi', 45000, 31500, 22000, 8, 3],
]

const buscarOCrear = async (Modelo, nombre, transaction) => {
  const [fila] = await Modelo.findOrCreate({ where: { nombre }, transaction })
  return fila
}

const cargar = async () => {
  await sequelize.transaction(async (transaction) => {
    let numero = 1

    for (const [denominacion, categoria, marca, minorista, mayorista, costo, stock, minimo] of ARTICULOS) {
      const fila = await buscarOCrear(Categoria, categoria, transaction)
      const suMarca = await buscarOCrear(Marca, marca, transaction)

      await Producto.findOrCreate({
        where: { codigoInterno: `${PREFIJO}${String(numero).padStart(4, '0')}` },
        defaults: {
          idCategoria: fila.idCategoria,
          idMarca: suMarca.idMarca,
          denominacion: `${denominacion} ${marca}`,
          descripcion: `${denominacion} compatible con equipos ${marca}. Articulo de demostracion.`,
          precioCosto: costo,
          precioMinorista: minorista,
          precioMayorista: mayorista,
          stockActual: stock,
          stockMinimo: minimo,
        },
        transaction,
      })

      numero += 1
    }
  })

  console.log(`\nCargados ${ARTICULOS.length} articulos de demostracion (codigos ${PREFIJO}0001 en adelante).`)
}

// --- Servicio tecnico --------------------------------------------------------

const MARCA_DEMO = 'DEMO '
const DIA = 86_400_000

const CLIENTES = [
  ['DEMO Rosana Gomez', 'Minorista', '3704-555101'],
  ['DEMO Marcos Benitez', 'Minorista', '3704-555102'],
  ['DEMO Lucia Acosta', 'Minorista', '3704-555103'],
  ['DEMO Taller Diaz', 'Mayorista', '3704-555104'],
]

const personasDemo = () =>
  Persona.findAll({ where: { apellidoNombre: { [Op.like]: `${MARCA_DEMO}%` } } })


// Las ordenes se cargan en unos segundos, pero una demostracion tiene que contar
// una historia que pudo pasar: un equipo reparado hace dos semanas no se recibio
// hace dos segundos. Se reparten los pasos de la orden en el pasado, cada uno con
// los dias que hace que ocurrio, y todo lo que cuelga de ellos se acomoda detras.
const hace = (dias) => new Date(Date.now() - dias * DIA)

const retroceder = async (idOrden, diasPorPaso) => {
  const pasos = await OrdenEstadoHistorial.findAll({
    where: { idOrden }, include: ['estado'], order: [['idHistorial', 'ASC']],
  })
  if (pasos.length !== diasPorPaso.length) {
    throw new Error(`La orden ${idOrden} tiene ${pasos.length} pasos y se pidieron ${diasPorPaso.length} fechas.`)
  }

  const fechaDe = {}
  for (const [indice, paso] of pasos.entries()) {
    fechaDe[paso.estado.codigo] = hace(diasPorPaso[indice])
    await paso.update({ fechaHora: fechaDe[paso.estado.codigo] })
  }

  await OrdenServicio.update({
    fechaIngreso: fechaDe.RECIBIDO,
    ...(fechaDe.APROBADO ? { fechaRespuestaPresupuesto: fechaDe.APROBADO } : {}),
    ...(fechaDe.NOTIFICADO ? { fechaNotificacion: fechaDe.NOTIFICADO } : {}),
  }, { where: { idOrden } })

  // Las tareas se hicieron durante la reparacion.
  if (fechaDe.EN_REPARACION) {
    await TareaRealizada.update(
      { fechaHora: new Date(fechaDe.EN_REPARACION.getTime() + 2 * 3_600_000) },
      { where: { idOrden } },
    )
  }
  return fechaDe
}

const cargarServicio = async () => {
  if ((await personasDemo()).length > 0) {
    console.log('Las ordenes de servicio de demostracion ya estaban cargadas: no se repiten.')
    return
  }

  // Las ordenes quedan a nombre del primer usuario activo: alguien tiene que
  // figurar como quien recibio y quien reparo.
  const responsable = await Usuario.findOne({ where: { activo: true }, order: [['idUsuario', 'ASC']] })
  if (!responsable) throw new Error('No hay ningun usuario. Crear el administrador primero: npm run crear-administrador')
  const quien = responsable.idUsuario

  const tipos = Object.fromEntries((await TipoCliente.findAll()).map((t) => [t.nombre, t.idTipoCliente]))
  const cliente = {}
  for (const [nombre, tipo, telefono] of CLIENTES) {
    const alta = await registrarCliente({
      apellidoNombre: nombre, tipoPersona: 'FISICA', idTipoCliente: tipos[tipo], telefonoWhatsapp: telefono,
    })
    cliente[nombre] = alta.idCliente
  }

  const idRepuesto = async (codigo) =>
    (await Producto.findOne({ where: { codigoInterno: codigo } }))?.idProducto

  const [pin, pantalla, bateria] = await Promise.all([
    idRepuesto(`${PREFIJO}0012`), idRepuesto(`${PREFIJO}0013`), idRepuesto(`${PREFIJO}0014`),
  ])
  if (!pin || !pantalla || !bateria) {
    throw new Error('Faltan los repuestos de muestra. El catalogo de muestra se carga primero.')
  }

  // Las ordenes gastan un repuesto de cada uno. Se verifica ANTES de crear nada:
  // fallar a mitad de camino dejaria clientes y ordenes cargados a medias.
  const sinStock = await Producto.findAll({
    where: { idProducto: [pin, pantalla, bateria], stockActual: { [Op.lt]: 1 } },
  })
  if (sinStock.length > 0) {
    const cuales = sinStock.map((fila) => fila.denominacion).join(', ')
    throw new Error(`No hay stock de ${cuales}. Registrar un ingreso de mercaderia y volver a intentar.`)
  }

  const marcas = Object.fromEntries((await Marca.findAll()).map((m) => [m.nombre, m.idMarca]))

  const recibir = (propietario, marca, modelo, imei, color, falla, estado, accesorios, sellos = 'INTACTOS') =>
    recepcionar({
      idCliente: cliente[propietario],
      dispositivo: { nuevoModelo: { idMarca: marcas[marca], denominacion: modelo }, imeiSerie: imei, color },
      fallaDeclarada: falla,
      estadoIngreso: estado,
      accesoriosRecibidos: accesorios,
      estadoSellos: sellos,
      idOrdenAnterior: null,
    }, quien)

  const reparar = async (orden, diagnostico, monto) => {
    await diagnosticar(orden, { diagnostico }, quien)
    await presupuestar(orden, { monto }, quien)
    await responderPresupuesto(orden, { aprobado: true, observacion: null }, quien)
    await cambiarEstado(orden, { codigo: 'EN_REPARACION', observacion: null }, quien)
  }

  // 1 - recien llegado
  await recibir('DEMO Rosana Gomez', 'Apple', 'iPhone 13', '356938035643809', 'Azul',
    'Se le rompio la pantalla y no responde al tacto.',
    'Vidrio trizado de punta a punta. Enciende y se ve la imagen. Marco con un golpe en una esquina.',
    'Funda y cargador', 'SIN_SELLO')

  // 2 - en diagnostico
  const o2 = await recibir('DEMO Marcos Benitez', 'Samsung', 'Galaxy A54', '351245091234567', 'Negro',
    'No carga con ningun cargador.',
    'Sin golpes. Pantalla en buen estado. Enciende con 12% de bateria.', 'Sin accesorios')
  await diagnosticar(o2, { diagnostico: 'El pin de carga esta flojo y con sulfato. Hay que reemplazarlo.' }, quien)

  // 3 - presupuestado, esperando la respuesta del cliente
  const o3 = await recibir('DEMO Lucia Acosta', 'Motorola', 'Moto G54', '358812067744120', 'Verde',
    'Se apaga sola y se calienta.',
    'Carcasa con rayones. Enciende normal. Se calienta apenas se usa.', 'Funda')
  await diagnosticar(o3, { diagnostico: 'La bateria esta hinchada. Cambiarla antes de que dane la tapa.' }, quien)
  await presupuestar(o3, { monto: 25000 }, quien)

  // 4 - en reparacion, con repuesto y tarea (cliente mayorista: rige la lista mayorista)
  const o4 = await recibir('DEMO Taller Diaz', 'Xiaomi', 'Redmi Note 12', '864209051188023', 'Gris',
    'La bateria no le dura ni dos horas.', 'Equipo en buen estado general. Sin golpes.', 'Cargador original')
  await reparar(o4, 'Bateria degradada, capacidad al 58%.', 12000)
  await registrarRepuesto(o4, { idProducto: bateria, cantidad: 1 }, quien)
  await registrarTarea(o4, { descripcion: 'Se abrio el equipo y se desconecto la bateria vieja.' }, quien)

  // 5 - reparado y notificado hace 14 dias: fuera de plazo, corre el recargo
  const o5 = await recibir('DEMO Rosana Gomez', 'Samsung', 'Galaxy A34', '350981142276508', 'Violeta',
    'No carga.', 'Pantalla con una raya fina. Funciona.', 'Funda')
  await reparar(o5, 'Pin de carga danado.', 9000)
  await registrarRepuesto(o5, { idProducto: pin, cantidad: 1 }, quien)
  await registrarTarea(o5, { descripcion: 'Reemplazo del pin de carga. Prueba de carga completa.' }, quien)
  await cambiarEstado(o5, { codigo: 'REPARADO', observacion: null }, quien)
  await notificar(o5, { medio: 'WHATSAPP', observacion: 'Se le aviso por WhatsApp' }, quien)

  // Recibido y diagnosticado hace tres semanas, reparado hace 15 dias, avisado hace 14.
  await retroceder(o5, [20, 20, 19, 18, 18, 15, 14])

  // 6 - entregado hace 12 dias: garantia en curso, sirve para mostrar un reingreso
  const o6 = await recibir('DEMO Marcos Benitez', 'Apple', 'iPhone 11', '353265109987412', 'Blanco',
    'La pantalla tiene una mancha negra.',
    'Mancha oscura en el cuadrante inferior. Sin golpes visibles.', 'Sin accesorios')
  await reparar(o6, 'Panel danado por presion. Se cambia el modulo.', 40000)
  await registrarRepuesto(o6, { idProducto: pantalla, cantidad: 1 }, quien)
  await registrarTarea(o6, { descripcion: 'Reemplazo del modulo de pantalla. Prueba de tactil y brillo.' }, quien)
  await cambiarEstado(o6, { codigo: 'REPARADO', observacion: null }, quien)
  await entregar(o6, { conformidad: true, observacion: null }, quien)

  // Recibido hace tres semanas, reparado hace 13 dias, entregado hace 12.
  const fechas6 = await retroceder(o6, [20, 20, 19, 18, 18, 13, 12])
  await OrdenServicio.update(
    { fechaEntrega: fechas6.ENTREGADO, fechaVencGarantia: vencimientoGarantia(fechas6.ENTREGADO, 30) },
    { where: { idOrden: o6 } },
  )

  console.log(`Cargadas 6 ordenes de servicio de demostracion y ${CLIENTES.length} clientes (con "DEMO" en el nombre).`)
  console.log('  - la 5.a esta sin retirar hace 14 dias: al entregarla corre el recargo')
  console.log('  - la 6.a esta entregada hace 12 dias: su garantia sigue en curso')
}

const borrarServicio = async () => {
  const personas = await personasDemo()
  if (personas.length === 0) return 0

  const idsPersona = personas.map((p) => p.idPersona)
  const clientes = await Cliente.findAll({ where: { idPersona: idsPersona } })
  const idsCliente = clientes.map((c) => c.idCliente)

  const ordenes = await OrdenServicio.findAll({ where: { idCliente: idsCliente } })
  const idsOrden = ordenes.map((o) => o.idOrden)
  if (idsOrden.length === 0) idsOrden.push(0)
  const idsDispositivo = [...new Set(ordenes.map((o) => o.idDispositivo))]
  // Las filas de foto se van con la orden (ON DELETE CASCADE); los archivos no.
  const fotos = await FotoOrden.findAll({ where: { idOrden: idsOrden } })

  await sequelize.transaction(async (transaction) => {
    // Borrar los renglones del kardex sin tocar el saldo rompe el invariante de
    // las existencias (stock_actual debe ser el acumulado de los movimientos).
    // Se devuelve al saldo lo que esos movimientos habian movido. Es una
    // excepcion de este script de limpieza: en el sistema el kardex no se borra.
    await sequelize.query(`
      UPDATE producto p
        JOIN (SELECT id_producto, SUM(cantidad) AS movido
                FROM movimiento_stock
               WHERE id_orden IN (:idsOrden)
               GROUP BY id_producto) m ON m.id_producto = p.id_producto
         SET p.stock_actual = p.stock_actual - m.movido
    `, { replacements: { idsOrden }, transaction })

    await MovimientoStock.destroy({ where: { idOrden: idsOrden }, transaction })
    // Un reingreso apunta a su orden de origen: se desengancha antes de borrar.
    await OrdenServicio.update({ idOrdenAnterior: null }, { where: { idOrden: idsOrden }, transaction })
    await OrdenServicio.destroy({ where: { idOrden: idsOrden }, transaction })
    await Dispositivo.destroy({ where: { idDispositivo: idsDispositivo }, transaction })
    await Cliente.destroy({ where: { idCliente: idsCliente }, transaction })
    await Persona.destroy({ where: { idPersona: idsPersona }, transaction })
  })

  // Recien con la base ya limpia: si algo hubiera fallado arriba, los archivos
  // siguen siendo los que las filas apuntan.
  await Promise.all(fotos.map((foto) => unlink(join(CARPETA_FOTOS, foto.imagenRuta)).catch(() => {})))

  // Si la tabla quedo vacia, la numeracion vuelve a empezar: la demostracion
  // arranca en OS-000001 y no donde dejaron las pruebas anteriores. Es inofensivo
  // si hay ordenes reales: InnoDB ignora un valor menor al maximo existente y
  // sigue desde el siguiente. Va fuera de la transaccion porque ALTER TABLE
  // confirma la que este abierta.
  await sequelize.query('ALTER TABLE orden_servicio AUTO_INCREMENT = 1')

  return ordenes.length
}

const borrar = async () => {
  const ordenes = await borrarServicio()
  if (ordenes > 0) console.log(`\nBorradas ${ordenes} ordenes de servicio de demostracion, con sus clientes.`)

  // Solo se borran los que tienen el prefijo y ninguna operacion asociada.
  // Si un articulo de muestra ya se vendio, la base lo va a impedir, y esta
  // bien que lo impida: borrarlo destruiria el historial de esa venta.
  const cuantos = await Producto.destroy({
    where: { codigoInterno: { [Op.like]: `${PREFIJO}%` } },
  })

  console.log(`\nBorrados ${cuantos} articulos de demostracion.\n`)
}

const main = async () => {
  await sequelize.authenticate()

  if (process.argv.includes('--borrar')) {
    await borrar()
  } else {
    await cargar()
    await cargarServicio()
    console.log('\nPara sacar todo:  npm run cargar-muestra -- --borrar\n')
  }
}

main()
  .catch((error) => {
    console.error(`\nNo se pudo completar: ${error.message}`)
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error('Algun dato de muestra ya tiene ventas o movimientos asociados.')
      console.error('La base protege ese historial: hay que borrar primero esas operaciones.\n')
    }
    process.exitCode = 1
  })
  .finally(() => sequelize.close().catch(() => {}))
