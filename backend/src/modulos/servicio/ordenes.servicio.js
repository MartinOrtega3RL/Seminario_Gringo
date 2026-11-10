import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import {
  OrdenServicio, Dispositivo, EstadoOrden, OrdenEstadoHistorial, FotoOrden, RepuestoUtilizado, TareaRealizada,
  Cliente, TipoCliente, Persona, ModeloDispositivo, Marca, Usuario, Producto,
} from '../../modelos/index.js'
import { aCentavos, aPesos } from '../ventas/ventas.reglas.js'
import { puedeVerCosto } from '../catalogo/catalogo.reglas.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import {
  formatearNumeroOrden, operacionesDisponibles, cambiosManuales, puedeDarseComoReparada,
  estaNoRetirada, limiteNoRetirada, diasCalendario, liquidar, vencimientoGarantia, evaluarGarantia,
  inicioDeDia, finDeDia,
} from './servicio.reglas.js'
import {
  operar, exigir, pasarA, anotar, estadoPorCodigo, estadosPorCodigo, tecnicoSiFalta, reglasDeNegocio,
} from './ordenes.nucleo.js'

const log = registroDe('servicio')

// =============================================================================
//  Lectura
// =============================================================================

const USUARIO = ['idUsuario', 'nombreUsuario']

// Los hasMany van con `separate`: sin eso Sequelize los une en una sola
// consulta y devuelve el producto cartesiano. Una orden con 8 estados, 4
// repuestos, 6 tareas y 5 fotos serian 960 filas para armar una ficha.
const RELACIONES_DETALLE = [
  {
    model: Cliente,
    as: 'cliente',
    include: [
      { model: Persona, as: 'persona' },
      { model: TipoCliente, as: 'tipoCliente' },
    ],
  },
  {
    model: Dispositivo,
    as: 'dispositivo',
    include: [{
      model: ModeloDispositivo,
      as: 'modelo',
      include: [{ model: Marca, as: 'marca', attributes: ['idMarca', 'nombre'] }],
    }],
  },
  { model: EstadoOrden, as: 'estado' },
  { model: Usuario, as: 'recibidoPor', attributes: USUARIO },
  { model: Usuario, as: 'tecnico', attributes: USUARIO },
  { model: OrdenServicio, as: 'ordenAnterior', attributes: ['idOrden', 'numeroOrden', 'fechaEntrega', 'fechaVencGarantia'] },
  {
    model: OrdenEstadoHistorial,
    as: 'historial',
    separate: true,
    order: [['fechaHora', 'ASC'], ['idHistorial', 'ASC']],
    include: [
      { model: EstadoOrden, as: 'estado' },
      { model: Usuario, as: 'usuario', attributes: USUARIO },
    ],
  },
  {
    model: RepuestoUtilizado,
    as: 'repuestos',
    separate: true,
    order: [['idRepuestoUtilizado', 'ASC']],
    include: [{ model: Producto, as: 'producto', attributes: ['idProducto', 'denominacion', 'codigoInterno'] }],
  },
  {
    model: TareaRealizada,
    as: 'tareas',
    separate: true,
    order: [['fechaHora', 'ASC'], ['idTarea', 'ASC']],
    include: [{ model: Usuario, as: 'usuario', attributes: USUARIO }],
  },
  { model: FotoOrden, as: 'fotos', separate: true, order: [['idFoto', 'ASC']] },
]

/**
 * Arma lo que ve quien abre la ficha: la orden, lo que se puede hacer ahora y lo
 * que valdria si se entregara hoy. Todo lo derivado se calcula aca, con las
 * reglas, y no en la interfaz: asi hay un solo lugar que decide.
 */
const presentar = async (orden, perfil, hoy) => {
  const plano = orden.get({ plain: true })
  const codigo = plano.estado.codigo
  const { garantiaDias, plazoRetiroDias, recargoPct } = await reglasDeNegocio()
  const estados = await estadosPorCodigo()

  const huboReparacion = plano.historial.some((paso) => paso.estado.codigo === 'REPARADO')
  const noRetirada = estaNoRetirada(plano, hoy, plazoRetiroDias)

  // Entregada: la liquidacion es la que quedo escrita. Antes: lo que valdria
  // hoy, que cambia el dia que se cumple el plazo y el recargo empieza a correr.
  //
  // Mientras el equipo esta en reparacion todavia no "hubo reparacion", pero la
  // ficha tiene que mostrar lo que se va acumulando: se cobraria salvo que se
  // haya descartado (el cliente rechazo, no tiene arreglo, se anulo).
  const definitiva = Boolean(plano.fechaEntrega)
  const descartada = plano.historial.some((paso) => ['RECHAZADO', 'NO_REPARABLE', 'ANULADA'].includes(paso.estado.codigo))
  const seCobraria = huboReparacion || !descartada

  const calculada = definitiva
    ? {
        reparacion: aCentavos(plano.montoTotal) - aCentavos(plano.recargoAplicado),
        recargo: aCentavos(plano.recargoAplicado),
        total: aCentavos(plano.montoTotal),
      }
    : liquidar({
        montoPresupuestado: plano.montoPresupuestado,
        repuestos: plano.repuestos,
        huboReparacion: seCobraria,
        noRetirada,
        porcentajeRecargo: recargoPct,
      })

  const centavosPresupuesto = aCentavos(plano.montoPresupuestado ?? 0)
  const centavosRepuestos = plano.repuestos.reduce((suma, r) => suma + aCentavos(r.precioUnitario) * r.cantidad, 0)

  const conCosto = puedeVerCosto(perfil)
  const repuestos = plano.repuestos.map(({ costoUnitario, ...resto }) => ({
    ...resto,
    subtotal: aPesos(aCentavos(resto.precioUnitario) * resto.cantidad),
    // RF04.2 — el costo no sale del servidor para quien no puede verlo.
    ...(conCosto ? { costoUnitario } : {}),
  }))

  return {
    ...plano,
    repuestos,
    operaciones: operacionesDisponibles(codigo),
    cambios: cambiosManuales(codigo).map((destino) => ({
      codigo: destino,
      nombre: estados.get(destino)?.nombre ?? destino,
    })),
    liquidacion: {
      presupuesto: aPesos(centavosPresupuesto),
      repuestos: aPesos(centavosRepuestos),
      reparacion: aPesos(calculada.reparacion),
      recargo: aPesos(calculada.recargo),
      total: aPesos(calculada.total),
      definitiva,
    },
    noRetirada,
    diasDesdeNotificacion: plano.fechaNotificacion && !plano.fechaEntrega
      ? diasCalendario(new Date(plano.fechaNotificacion), hoy)
      : null,
    // RF24.3 — si es un reingreso: la garantia de la orden anterior, tal como
    // estaba el dia que el equipo volvio y con los sellos con que volvio.
    garantiaAlIngresar: plano.ordenAnterior
      ? evaluarGarantia(plano.ordenAnterior, plano.estadoSellos, new Date(plano.fechaIngreso))
      : null,
    // RF24.2 — la garantia de ESTA reparacion, una vez entregada.
    garantiaPropia: plano.fechaVencGarantia
      ? evaluarGarantia({ fechaVencGarantia: plano.fechaVencGarantia }, 'INTACTOS', hoy)
      : null,
    reglas: { garantiaDias, plazoRetiroDias, recargoPct },
  }
}

export const detalleOrden = async (idOrden, perfil, hoy = new Date()) => {
  const orden = await OrdenServicio.findByPk(idOrden, { include: RELACIONES_DETALLE })
  if (!orden) throw new NoEncontrado('La orden de servicio')
  return presentar(orden, perfil, hoy)
}

/** Los once estados, para los filtros y para nombrar los cambios manuales. */
export const listarEstados = async () =>
  [...(await estadosPorCodigo()).values()].map(({ codigo, nombre, esFinal }) => ({ codigo, nombre, esFinal }))

/**
 * RF25.1 — filtrar por estado, cliente o periodo; y RF23.2 — las que superaron
 * el plazo de retiro.
 *
 * El listado va por el ORM, que es lo que hace bien: filas con sus relaciones.
 * Los contadores por estado van en SQL crudo aparte, porque son una agregacion
 * sobre TODO lo filtrado y no sobre la pagina: contar en JavaScript daria los
 * de los veinticinco renglones visibles.
 */
export const listarOrdenes = async ({ texto, estado, idCliente, desde, hasta, soloNoRetiradas, limit, offset }) => {
  const hoy = new Date()
  const { plazoRetiroDias } = await reglasDeNegocio()
  const limite = limiteNoRetirada(hoy, plazoRetiroDias)

  const donde = {}
  if (idCliente) donde.idCliente = idCliente
  if (desde || hasta) {
    donde.fechaIngreso = {
      ...(desde ? { [Op.gte]: inicioDeDia(desde) } : {}),
      ...(hasta ? { [Op.lte]: finDeDia(hasta) } : {}),
    }
  }
  if (soloNoRetiradas) {
    donde.fechaNotificacion = { [Op.lt]: limite }
    donde.fechaEntrega = null
  }
  if (texto) {
    const como = { [Op.like]: `%${texto}%` }
    donde[Op.or] = [
      { numeroOrden: como },
      { '$dispositivo.imei_serie$': como },
      { '$cliente.persona.apellido_nombre$': como },
      { '$cliente.persona.telefono_whatsapp$': como },
    ]
  }

  const resultado = await OrdenServicio.findAndCountAll({
    where: donde,
    include: [
      { model: EstadoOrden, as: 'estado', ...(estado ? { where: { codigo: estado } } : {}) },
      {
        model: Cliente,
        as: 'cliente',
        attributes: ['idCliente'],
        include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre', 'telefonoWhatsapp'] }],
      },
      {
        model: Dispositivo,
        as: 'dispositivo',
        include: [{
          model: ModeloDispositivo,
          as: 'modelo',
          include: [{ model: Marca, as: 'marca', attributes: ['nombre'] }],
        }],
      },
    ],
    order: [['fechaIngreso', 'DESC'], ['idOrden', 'DESC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

  const filtros = {
    desde: desde ? inicioDeDia(desde) : null,
    hasta: hasta ? finDeDia(hasta) : null,
    idCliente: idCliente ?? null,
    limite,
  }

  const [porEstado] = await sequelize.query(`
    SELECT eo.codigo, eo.nombre, COUNT(o.id_orden) AS cantidad
      FROM estado_orden eo
      LEFT JOIN orden_servicio o
        ON o.id_estado_actual = eo.id_estado
       AND (:desde     IS NULL OR o.fecha_ingreso >= :desde)
       AND (:hasta     IS NULL OR o.fecha_ingreso <= :hasta)
       AND (:idCliente IS NULL OR o.id_cliente = :idCliente)
     GROUP BY eo.id_estado, eo.codigo, eo.nombre, eo.orden_secuencia
     ORDER BY eo.orden_secuencia
  `, { replacements: filtros })

  const [[sinRetirar]] = await sequelize.query(`
    SELECT COUNT(*) AS cantidad
      FROM orden_servicio
     WHERE fecha_notificacion < :limite
       AND fecha_entrega IS NULL
       AND (:idCliente IS NULL OR id_cliente = :idCliente)
  `, { replacements: filtros })

  const filas = resultado.rows.map((fila) => ({
    ...fila.get({ plain: true }),
    noRetirada: estaNoRetirada(fila, hoy, plazoRetiroDias),
  }))

  return {
    count: resultado.count,
    rows: filas,
    resumen: {
      porEstado: porEstado.map((fila) => ({ ...fila, cantidad: Number(fila.cantidad) })),
      noRetiradas: Number(sinRetirar.cantidad),
      plazoRetiroDias,
    },
  }
}

// =============================================================================
//  Recepcion (RF21)
// =============================================================================

const resolverModelo = async ({ idModelo, nuevoModelo }, transaction) => {
  if (idModelo) {
    if (!(await ModeloDispositivo.findByPk(idModelo, { transaction }))) throw new NoEncontrado('El modelo')
    return idModelo
  }

  // El tecnico que recibe un equipo cuyo modelo todavia no esta cargado no
  // tiene permiso de escritura sobre el catalogo: el alta del modelo forma parte
  // de la recepcion y no puede detener a quien esta con el cliente adelante.
  const marca = await Marca.findOne({ where: { idMarca: nuevoModelo.idMarca, activo: true }, transaction })
  if (!marca) throw new NoEncontrado('La marca')

  const [modelo] = await ModeloDispositivo.findOrCreate({
    where: { idMarca: marca.idMarca, denominacion: nuevoModelo.denominacion },
    transaction,
  })
  return modelo.idModelo
}

const resolverDispositivo = async ({ idModelo, imeiSerie, color, observaciones }, transaction) => {
  if (imeiSerie) {
    const existente = await Dispositivo.findOne({ where: { imeiSerie }, transaction })

    if (existente) {
      // Mismo IMEI y otro modelo es casi seguro un numero mal tipeado, y
      // aceptarlo mezclaria el historial de dos equipos distintos (RF25.2).
      if (existente.idModelo !== idModelo) {
        throw new DatosInvalidos('Ese IMEI ya está registrado en otro modelo de equipo. Revisá que el número esté bien.')
      }
      return existente
    }
  }

  return Dispositivo.create({
    idModelo, imeiSerie: imeiSerie ?? null, color: color ?? null, observaciones: observaciones ?? null,
  }, { transaction })
}

// RF24.3 — un reingreso por garantia apunta a la orden que lo origino.
const verificarReingreso = async (idOrdenAnterior, idDispositivo, transaction) => {
  const previa = await OrdenServicio.findByPk(idOrdenAnterior, { transaction })
  if (!previa) throw new NoEncontrado('La orden anterior')
  if (previa.idDispositivo !== idDispositivo) {
    throw new DatosInvalidos('La orden anterior es de otro equipo.')
  }
  if (!previa.fechaEntrega) {
    throw new DatosInvalidos('La orden anterior todavía no se entregó: no puede ser un reingreso por garantía.')
  }
}

/**
 * RF21.1 a RF21.6 y RF21.8 — recepcion del equipo.
 *
 * El cliente, el dispositivo y la orden se escriben juntos o no se escribe
 * ninguno: una recepcion que fallara a medias dejaria un equipo sin dueno o una
 * orden sin equipo, y el cliente ya se fue con su comprobante.
 *
 * @param {object} datos validados por el controlador
 * @param {number} idUsuario quien recibe, tomado del token
 * @returns {Promise<number>} id de la orden creada
 */
export const recepcionar = async (datos, idUsuario) => {
  const idOrden = await sequelize.transaction(async (transaction) => {
    const cliente = await Cliente.findOne({ where: { idCliente: datos.idCliente, activo: true }, transaction })
    if (!cliente) throw new NoEncontrado('El cliente')

    const idModelo = await resolverModelo(datos.dispositivo, transaction)
    const dispositivo = await resolverDispositivo({ ...datos.dispositivo, idModelo }, transaction)

    if (datos.idOrdenAnterior) {
      await verificarReingreso(datos.idOrdenAnterior, dispositivo.idDispositivo, transaction)
    }

    const recibido = await estadoPorCodigo('RECIBIDO')

    // Provisorio unico: el numero definitivo se deriva del identificador que
    // asigna la base, que no puede colisionar. Las dos escrituras van en la
    // misma transaccion, asi que nadie ve nunca el provisorio. Mismo recurso
    // que el comprobante de venta.
    const orden = await OrdenServicio.create({
      numeroOrden: `TMP-${randomUUID().slice(0, 16)}`,
      idCliente: datos.idCliente,
      idDispositivo: dispositivo.idDispositivo,
      idUsuarioRecepcion: idUsuario,
      idEstadoActual: recibido.idEstado,
      idOrdenAnterior: datos.idOrdenAnterior ?? null,
      fechaIngreso: new Date(),
      fallaDeclarada: datos.fallaDeclarada,
      estadoIngreso: datos.estadoIngreso,
      accesoriosRecibidos: datos.accesoriosRecibidos ?? null,
      estadoSellos: datos.estadoSellos,
    }, { transaction })

    await orden.update({ numeroOrden: formatearNumeroOrden(orden.idOrden) }, { transaction })

    await anotar(orden.idOrden, recibido.idEstado, {
      idUsuario,
      observacion: datos.idOrdenAnterior ? 'Reingreso por garantía' : 'Recepción del equipo',
    }, transaction)

    return orden.idOrden
  })

  log.info({ idOrden, usuario: idUsuario }, 'equipo recepcionado')
  return idOrden
}

// =============================================================================
//  Proceso de reparacion (RF22)
// =============================================================================

/** RF22.1 — el diagnostico. Quien lo registra toma la orden. */
export const diagnosticar = (idOrden, { diagnostico }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('diagnosticar', estado, 'registrar el diagnóstico de')

    const cambios = { diagnosticoTecnico: diagnostico, ...tecnicoSiFalta(orden, idUsuario) }

    if (estado.codigo === 'RECIBIDO') {
      await pasarA(orden, estado, 'EN_DIAGNOSTICO', {
        idUsuario, cambios, observacion: 'Diagnóstico registrado',
      }, transaction)
    } else {
      await orden.update(cambios, { transaction })
    }

    log.info({ idOrden, usuario: idUsuario }, 'diagnostico registrado')
  })

/** RF22.2 — el presupuesto. Se puede corregir hasta que el cliente responda. */
export const presupuestar = (idOrden, { monto }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('presupuestar', estado, 'presupuestar')

    if (!orden.diagnosticoTecnico?.trim()) {
      throw new DatosInvalidos('Registrá primero el diagnóstico: el presupuesto se arma sobre lo que se encontró.')
    }

    const importe = aPesos(aCentavos(monto))

    if (estado.codigo === 'PRESUPUESTADO') {
      await orden.update({ montoPresupuestado: importe }, { transaction })
      await anotar(orden.idOrden, estado.idEstado, { idUsuario, observacion: `Presupuesto corregido a $${importe}` }, transaction)
    } else {
      await pasarA(orden, estado, 'PRESUPUESTADO', {
        idUsuario,
        observacion: `Presupuesto de $${importe}`,
        cambios: { montoPresupuestado: importe, presupuestoAprobado: null, fechaRespuestaPresupuesto: null },
      }, transaction)
    }

    log.info({ idOrden, monto: importe, usuario: idUsuario }, 'presupuesto registrado')
  })

/** RF22.3 — lo que respondio el cliente. */
export const responderPresupuesto = (idOrden, { aprobado, observacion }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('responder', estado, 'registrar la respuesta al presupuesto de')

    await pasarA(orden, estado, aprobado ? 'APROBADO' : 'RECHAZADO', {
      idUsuario,
      observacion: observacion ?? (aprobado ? 'El cliente aprobó el presupuesto' : 'El cliente rechazó el presupuesto'),
      cambios: { presupuestoAprobado: aprobado, fechaRespuestaPresupuesto: new Date() },
    }, transaction)

    log.info({ idOrden, aprobado, usuario: idUsuario }, 'respuesta al presupuesto registrada')
  })

const exigirMotivo = (observacion, que) => {
  if (!observacion || observacion.trim().length < 5) {
    throw new DatosInvalidos(`Escribí el motivo: ${que} queda en el registro de la orden.`)
  }
}

/**
 * RF22.6 — los cambios de estado que se eligen directamente. Los que llevan
 * datos propios (presupuesto, respuesta, notificacion, entrega) tienen su
 * operacion y no se alcanzan por aca.
 */
export const cambiarEstado = (idOrden, { codigo, observacion }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    if (!cambiosManuales(estado.codigo).includes(codigo)) {
      const destino = await estadoPorCodigo(codigo).catch(() => null)
      throw new DatosInvalidos(
        destino
          ? `Una orden "${estado.nombre}" no puede pasar a "${destino.nombre}" desde acá.`
          : 'Ese estado no existe.',
      )
    }

    if (codigo === 'REPARADO') {
      const cantidadTareas = await TareaRealizada.count({ where: { idOrden }, transaction })
      const veredicto = puedeDarseComoReparada({ cantidadTareas })
      if (!veredicto.admite) throw new DatosInvalidos(veredicto.motivo)
    }
    if (codigo === 'NO_REPARABLE') exigirMotivo(observacion, 'por qué no tiene arreglo')
    if (codigo === 'ANULADA') exigirMotivo(observacion, 'por qué se anula')

    const cambios = codigo === 'EN_REPARACION' ? tecnicoSiFalta(orden, idUsuario) : {}
    await pasarA(orden, estado, codigo, { idUsuario, observacion: observacion ?? null, cambios }, transaction)

    log.info({ idOrden, hacia: codigo, usuario: idUsuario }, 'estado de la orden actualizado')
  })

// =============================================================================
//  Notificacion y entrega (RF23)
// =============================================================================

/**
 * RF23.1 — notificacion al cliente: fecha, medio y responsable.
 * Notificar de nuevo es valido y la fecha vigente pasa a ser la ultima: asi lo
 * define la columna (fecha_notificacion es "ultima notificacion").
 */
export const notificar = (idOrden, { medio, observacion }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('notificar', estado, 'notificar')

    const ahora = new Date()

    if (estado.codigo === 'NOTIFICADO') {
      await orden.update({ fechaNotificacion: ahora }, { transaction })
      await anotar(orden.idOrden, estado.idEstado, {
        idUsuario, medio, observacion: observacion ?? 'Nueva notificación',
      }, transaction)
    } else {
      await pasarA(orden, estado, 'NOTIFICADO', {
        idUsuario, medio, observacion: observacion ?? null, cambios: { fechaNotificacion: ahora },
      }, transaction)
    }

    log.info({ idOrden, medio, usuario: idUsuario }, 'cliente notificado')
  })

/**
 * RF23.4 — entrega. Aca se liquida: se calcula el recargo por demora (RF23.3)
 * y la fecha de vencimiento de la garantia (RF24.1), y quedan escritos.
 *
 * Se calculan al entregar y no antes porque dependen del dia de la entrega: el
 * mismo equipo cuesta mas el dia once que el dia diez, y la garantia corre
 * desde el momento en que el cliente se lo lleva.
 */
export const entregar = (idOrden, { conformidad, observacion }, idUsuario) =>
  operar(idOrden, async ({ orden, estado, transaction }) => {
    exigir('entregar', estado, 'entregar')

    const ahora = new Date()
    const { garantiaDias, plazoRetiroDias, recargoPct } = await reglasDeNegocio()

    const historial = await OrdenEstadoHistorial.findAll({
      where: { idOrden },
      include: [{ model: EstadoOrden, as: 'estado', attributes: ['codigo'] }],
      transaction,
    })
    const repuestos = await RepuestoUtilizado.findAll({ where: { idOrden }, transaction })

    // Solo hay garantia y solo hay reparacion que cobrar si el equipo se arreglo.
    const huboReparacion = historial.some((paso) => paso.estado.codigo === 'REPARADO')

    const liquidacion = liquidar({
      montoPresupuestado: orden.montoPresupuestado,
      repuestos,
      huboReparacion,
      noRetirada: estaNoRetirada({ fechaNotificacion: orden.fechaNotificacion, fechaEntrega: null }, ahora, plazoRetiroDias),
      porcentajeRecargo: recargoPct,
    })

    await pasarA(orden, estado, 'ENTREGADO', {
      idUsuario,
      observacion: observacion ?? (conformidad ? 'Entregado con conformidad del cliente' : 'Entregado sin conformidad del cliente'),
      cambios: {
        fechaEntrega: ahora,
        conformidadCliente: conformidad,
        recargoAplicado: aPesos(liquidacion.recargo),
        montoTotal: aPesos(liquidacion.total),
        fechaVencGarantia: huboReparacion ? vencimientoGarantia(ahora, garantiaDias) : null,
      },
    }, transaction)

    log.info({
      idOrden, total: aPesos(liquidacion.total), recargo: aPesos(liquidacion.recargo), conGarantia: huboReparacion,
      usuario: idUsuario,
    }, 'equipo entregado')
  })
