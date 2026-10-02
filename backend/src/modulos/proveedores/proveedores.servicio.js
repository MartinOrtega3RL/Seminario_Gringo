import { Op } from 'sequelize'
import { sequelize } from '../../config/base-de-datos.js'
import { Proveedor, Persona, Producto, Categoria, Marca } from '../../modelos/index.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import { normalizarContacto, documentoCompleto } from '../clientes/clientes.reglas.js'

const log = registroDe('proveedores')

// RF15 — gestion de proveedores. H14: «Tenemos varios proveedores... Tecnomovil,
// Benjasel, Blanca, son varios».
//
// La central entra como uno mas: el titular aclaro que no se la distingue del
// resto, y por eso la clasificacion que existia se elimino del esquema.

const RELACIONES = [{
  model: Persona,
  as: 'persona',
  attributes: [
    'idPersona', 'apellidoNombre', 'tipoPersona',
    'tipoDocumento', 'numeroDocumento', 'telefonoWhatsapp', 'correo', 'domicilio',
  ],
}]

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

/** RF15.1 — listado paginado. Nunca devuelve el padron entero. */
export const listarProveedores = async ({ texto, limit, offset }) =>
  Proveedor.findAndCountAll({
    where: { activo: true, ...filtroTexto(texto?.trim()) },
    include: RELACIONES,
    order: [[{ model: Persona, as: 'persona' }, 'apellidoNombre', 'ASC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

export const buscarProveedor = async (idProveedor) => {
  const proveedor = await Proveedor.findOne({
    where: { idProveedor, activo: true },
    include: RELACIONES,
  })
  if (!proveedor) throw new NoEncontrado('El proveedor')
  return proveedor
}

/**
 * RF15.2 — que productos se le compran a un proveedor determinado.
 * Es la vuelta de RF06.7: la misma asociativa leida desde el otro lado.
 */
export const listarProductosDelProveedor = async (idProveedor) => {
  await buscarProveedor(idProveedor)

  return Producto.findAll({
    where: { activo: true },
    attributes: ['idProducto', 'codigoInterno', 'denominacion', 'stockActual'],
    include: [
      {
        model: Proveedor,
        as: 'proveedores',
        where: { idProveedor },
        attributes: [],
        through: { attributes: [] },
        required: true,
      },
      { model: Categoria, as: 'categoria', attributes: ['nombre'] },
      { model: Marca, as: 'marca', attributes: ['nombre'] },
    ],
    order: [['denominacion', 'ASC']],
  })
}

const verificarDocumento = async ({ tipoDocumento, numeroDocumento }, idPersonaActual = null) => {
  if (!documentoCompleto({ tipoDocumento, numeroDocumento })) {
    throw new DatosInvalidos('Si cargás un documento, tenés que indicar el tipo y el número.')
  }
  if (!numeroDocumento) return

  const donde = { tipoDocumento, numeroDocumento }
  if (idPersonaActual) donde.idPersona = { [Op.ne]: idPersonaActual }

  if (await Persona.count({ where: donde })) {
    throw new DatosInvalidos(`Ya hay alguien registrado con el documento ${numeroDocumento}.`)
  }
}

const datosDePersona = (datos) => ({
  apellidoNombre: datos.apellidoNombre,
  // Un proveedor suele ser una empresa; por eso el valor por omision cambia
  // respecto del cliente, donde lo habitual es una persona fisica.
  tipoPersona: datos.tipoPersona ?? 'JURIDICA',
  tipoDocumento: datos.tipoDocumento ?? null,
  numeroDocumento: datos.numeroDocumento ?? null,
  telefonoWhatsapp: normalizarContacto(datos.telefonoWhatsapp),
  correo: datos.correo ?? null,
  domicilio: datos.domicilio ?? null,
})

/** RF15.1 — alta. Persona y proveedor se escriben juntos o no se escribe ninguno. */
export const registrarProveedor = async (datos) => {
  await verificarDocumento(datos)

  const idProveedor = await sequelize.transaction(async (transaction) => {
    const persona = await Persona.create(datosDePersona(datos), { transaction })
    const proveedor = await Proveedor.create({
      idPersona: persona.idPersona,
      sitioWeb: datos.sitioWeb ?? null,
      observaciones: datos.observaciones ?? null,
    }, { transaction })

    return proveedor.idProveedor
  })

  log.info({ idProveedor }, 'proveedor dado de alta')
  return buscarProveedor(idProveedor)
}

/** RF15.1 — modificación. */
export const modificarProveedor = async (idProveedor, datos) => {
  const proveedor = await buscarProveedor(idProveedor)
  await verificarDocumento(datos, proveedor.idPersona)

  await sequelize.transaction(async (transaction) => {
    await proveedor.persona.update(datosDePersona(datos), { transaction })
    await proveedor.update({
      sitioWeb: datos.sitioWeb ?? null,
      observaciones: datos.observaciones ?? null,
    }, { transaction })
  })

  log.info({ idProveedor }, 'proveedor modificado')
  return buscarProveedor(idProveedor)
}

/**
 * RF15.1 — baja LOGICA. No se borra: las recepciones de mercadería que lo
 * referencian tienen que seguir diciendo a quién se le compró.
 */
export const darDeBajaProveedor = async (idProveedor) => {
  const proveedor = await buscarProveedor(idProveedor)
  await proveedor.update({ activo: false })

  log.info({ idProveedor, nombre: proveedor.persona.apellidoNombre }, 'proveedor dado de baja')
}
