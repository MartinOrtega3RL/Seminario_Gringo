import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Cliente, Persona, TipoCliente } from '../../modelos/index.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { normalizarContacto, documentoCompleto } from './clientes.reglas.js'

const RELACIONES = [
  {
    model: Persona,
    as: 'persona',
    attributes: [
      'idPersona', 'apellidoNombre', 'tipoPersona',
      'tipoDocumento', 'numeroDocumento', 'telefonoWhatsapp', 'correo', 'domicilio',
    ],
  },
  { model: TipoCliente, as: 'tipoCliente', attributes: ['idTipoCliente', 'nombre', 'listaPrecioAplicable'] },
]

/** RF13.4 — busca por denominacion, documento o numero de contacto. */
const filtroTexto = (texto) => {
  if (!texto) return {}
  const como = { [Op.like]: `%${texto}%` }
  return {
    [Op.or]: [
      { '$persona.apellido_nombre$': como },
      { '$persona.numero_documento$': como },
      { '$persona.telefono_whatsapp$': como },
    ],
  }
}

/** RF13.4 — listado paginado. Nunca devuelve el padron entero. */
export const listarClientes = async ({ texto, limit, offset }) =>
  Cliente.findAndCountAll({
    where: { activo: true, ...filtroTexto(texto?.trim()) },
    include: RELACIONES,
    order: [[{ model: Persona, as: 'persona' }, 'apellidoNombre', 'ASC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

export const buscarCliente = async (idCliente) => {
  const cliente = await Cliente.findOne({ where: { idCliente, activo: true }, include: RELACIONES })
  if (!cliente) throw new NoEncontrado('El cliente')
  return cliente
}

export const listarTiposCliente = async () =>
  TipoCliente.findAll({ order: [['idTipoCliente', 'ASC']] })

const verificarDocumento = async ({ tipoDocumento, numeroDocumento }, idPersonaActual = null) => {
  if (!documentoCompleto({ tipoDocumento, numeroDocumento })) {
    throw new DatosInvalidos('Si cargas un documento, tenes que indicar el tipo y el numero.')
  }
  if (!numeroDocumento) return

  const donde = { tipoDocumento, numeroDocumento }
  if (idPersonaActual) donde.idPersona = { [Op.ne]: idPersonaActual }

  if (await Persona.count({ where: donde })) {
    throw new DatosInvalidos(`Ya hay alguien registrado con el documento ${numeroDocumento}.`)
  }
}

/**
 * RF13.1 — alta. Cliente es una especializacion de persona: las dos filas se
 * escriben juntas o no se escribe ninguna.
 */
export const registrarCliente = async (datos) => {
  await verificarDocumento(datos)

  const idCliente = await sequelize.transaction(async (transaction) => {
    const persona = await Persona.create({
      apellidoNombre: datos.apellidoNombre,
      tipoPersona: datos.tipoPersona ?? 'FISICA',
      tipoDocumento: datos.tipoDocumento ?? null,
      numeroDocumento: datos.numeroDocumento ?? null,
      telefonoWhatsapp: normalizarContacto(datos.telefonoWhatsapp),
      correo: datos.correo ?? null,
      domicilio: datos.domicilio ?? null,
    }, { transaction })

    const cliente = await Cliente.create({
      idPersona: persona.idPersona,
      idTipoCliente: datos.idTipoCliente,
      observaciones: datos.observaciones ?? null,
    }, { transaction })

    return cliente.idCliente
  })

  return buscarCliente(idCliente)
}

/** RF13.2 y RF13.5 — modificacion, incluida la clasificacion. */
export const modificarCliente = async (idCliente, datos) => {
  const cliente = await buscarCliente(idCliente)
  await verificarDocumento(datos, cliente.idPersona)

  await sequelize.transaction(async (transaction) => {
    await cliente.persona.update({
      apellidoNombre: datos.apellidoNombre,
      tipoPersona: datos.tipoPersona ?? cliente.persona.tipoPersona,
      tipoDocumento: datos.tipoDocumento ?? null,
      numeroDocumento: datos.numeroDocumento ?? null,
      telefonoWhatsapp: normalizarContacto(datos.telefonoWhatsapp),
      correo: datos.correo ?? null,
      domicilio: datos.domicilio ?? null,
    }, { transaction })

    await cliente.update({
      idTipoCliente: datos.idTipoCliente,
      observaciones: datos.observaciones ?? null,
    }, { transaction })
  })

  return buscarCliente(idCliente)
}

/**
 * RF13.3 — baja logica. No se borra: la fila queda y conserva su historial de
 * ventas, que es lo que exige el modelo.
 */
export const darDeBajaCliente = async (idCliente) => {
  const cliente = await buscarCliente(idCliente)
  await cliente.update({ activo: false })
}
