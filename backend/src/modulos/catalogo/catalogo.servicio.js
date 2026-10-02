import { Op } from 'sequelize'
import { randomUUID } from 'node:crypto'
import { sequelize } from '../../config/base-de-datos.js'
import { Producto, Categoria, Marca, MovimientoStock, ModeloDispositivo, Proveedor, Persona } from '../../modelos/index.js'
import { leerParametro } from '../../modelos/sistema.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'
import { registroDe } from '../../registro.js'
import {
  catalogoVisible, productoVisible, prepararBusqueda,
  formatearCodigoInterno, columnasDeLista, factorDePorcentaje,
} from './catalogo.reglas.js'

const log = registroDe('catalogo')

const RELACIONES = [
  { model: Categoria, as: 'categoria', attributes: ['idCategoria', 'nombre'] },
  { model: Marca, as: 'marca', attributes: ['idMarca', 'nombre'] },
  // RF06.8 — los modelos con los que el producto es compatible. `through: []`
  // evita que la tabla asociativa aparezca en la respuesta: al frontend le
  // sirve el modelo, no la fila que los une.
  {
    model: ModeloDispositivo,
    as: 'compatibilidades',
    attributes: ['idModelo', 'denominacion', 'sistemaOperativo'],
    through: { attributes: [] },
    include: [{ model: Marca, as: 'marca', attributes: ['idMarca', 'nombre'] }],
  },
  // RF06.7 — a quien se le compra. Solo el proveedor: el codigo del articulo
  // en su catalogo y el precio de compra quedaron fuera de esta etapa.
  {
    model: Proveedor,
    as: 'proveedores',
    attributes: ['idProveedor'],
    through: { attributes: [] },
    include: [{ model: Persona, as: 'persona', attributes: ['apellidoNombre'] }],
  },
]

// RF06.5 / RNF02 — la busqueda por texto usa el indice FULLTEXT que ya define
// el DDL. Un LIKE '%...%' no puede aprovechar ningun indice y sobre 3.000
// articulos (S01) no entra en los dos segundos.
//
// Las columnas van calificadas con el alias de la tabla y no sueltas:
// modelo_dispositivo tambien tiene `denominacion`, y desde que el listado se
// une con las compatibilidades (RF06.8) el nombre sin calificar es ambiguo y
// MySQL rechaza la consulta entera.
const MATCH_FULLTEXT =
  'MATCH (`Producto`.`denominacion`, `Producto`.`descripcion`) AGAINST (:texto IN BOOLEAN MODE)'

const armarFiltro = ({ texto, idCategoria, idMarca, soloBajoMinimo }) => {
  const filtro = { activo: true }

  if (idCategoria) filtro.idCategoria = idCategoria
  if (idMarca) filtro.idMarca = idMarca
  if (soloBajoMinimo) filtro.bajoMinimo = true

  if (texto) {
    // El codigo interno se compara exacto: al tipearlo entero, el operador
    // espera ese producto y no una lista de parecidos (RF16.2).
    filtro[Op.or] = [{ codigoInterno: texto }, sequelize.literal(MATCH_FULLTEXT)]
  }

  return filtro
}

/** RF06.4 / RF06.5 — listado paginado. Nunca devuelve el conjunto completo. */
export const listarProductos = async ({ texto, idCategoria, idMarca, soloBajoMinimo, limit, offset }, perfil) => {
  const busqueda = prepararBusqueda(texto)

  const resultado = await Producto.findAndCountAll({
    where: armarFiltro({ texto: busqueda ? texto : null, idCategoria, idMarca, soloBajoMinimo }),
    include: RELACIONES,
    replacements: busqueda ? { texto: busqueda } : undefined,
    order: [['denominacion', 'ASC']],
    limit,
    offset,
    distinct: true,
    subQuery: false,
  })

  return { count: resultado.count, rows: catalogoVisible(resultado.rows, perfil) }
}

export const buscarProducto = async (idProducto, perfil) => {
  const producto = await Producto.findOne({
    where: { idProducto, activo: true },
    include: RELACIONES,
  })
  if (!producto) throw new NoEncontrado('El producto')

  return productoVisible(producto, perfil)
}

const verificarClasificaciones = async ({ idCategoria, idMarca }, transaction) => {
  const [categoria, marca] = await Promise.all([
    Categoria.findOne({ where: { idCategoria, activo: true }, transaction }),
    Marca.findOne({ where: { idMarca, activo: true }, transaction }),
  ])
  if (!categoria) throw new NoEncontrado('La categoria')
  if (!marca) throw new NoEncontrado('La marca')
}

/**
 * RF06.1 y RF08.1-08.3 — alta con sus tres precios.
 *
 * El codigo interno lo genera el servidor (RF09.1) a partir del identificador
 * que asigna la base. Se inserta un provisorio unico y se reemplaza en la misma
 * transaccion, igual que el numero de comprobante: un contador propio tendria
 * una carrera entre dos altas simultaneas.
 *
 * Las existencias iniciales NO se escriben a mano en producto: se registran
 * como un movimiento de INGRESO, para que el saldo siga siendo igual a la suma
 * de los movimientos y quede constancia de quien las cargo.
 */
export const registrarProducto = async (datos, idUsuario, perfil) => {
  const prefijo = await leerParametro('PREFIJO_CODIGO_INTERNO', 'EGC')

  const idProducto = await sequelize.transaction(async (transaction) => {
    await verificarClasificaciones(datos, transaction)

    const producto = await Producto.create({
      idCategoria: datos.idCategoria,
      idMarca: datos.idMarca,
      codigoInterno: `TMP-${randomUUID().slice(0, 20)}`,
      denominacion: datos.denominacion,
      descripcion: datos.descripcion ?? null,
      precioCosto: datos.precioCosto ?? 0,
      precioMinorista: datos.precioMinorista,
      precioMayorista: datos.precioMayorista,
      stockActual: 0,
      stockMinimo: datos.stockMinimo ?? 0,
    }, { transaction })

    await producto.update(
      { codigoInterno: formatearCodigoInterno(producto.idProducto, prefijo) },
      { transaction },
    )

    const inicial = Number(datos.stockInicial ?? 0)
    if (inicial > 0) {
      await sequelize.query(
        'UPDATE producto SET stock_actual = stock_actual + :cantidad WHERE id_producto = :id',
        { replacements: { cantidad: inicial, id: producto.idProducto }, transaction },
      )
      await MovimientoStock.create({
        idProducto: producto.idProducto,
        idUsuario,
        tipoMovimiento: 'INGRESO',
        cantidad: inicial,
        stockResultante: inicial,
        motivo: 'Existencias iniciales del alta',
      }, { transaction })
    }

    if (datos.compatibilidades?.length) {
      await producto.setCompatibilidades(datos.compatibilidades, { transaction })
    }
    if (datos.proveedores?.length) {
      await producto.setProveedores(datos.proveedores, { transaction })
    }

    return producto.idProducto
  })

  log.info({ idProducto, usuario: idUsuario }, 'producto dado de alta')
  return buscarProducto(idProducto, perfil)
}

/**
 * RF06.2 y RF08 — modificacion de la ficha y de los precios.
 *
 * `stockActual` no se toca nunca por aca: se corrige por ingreso o por ajuste,
 * que dejan movimiento. Y el costo solo se escribe si vino en el cuerpo: un
 * perfil que no puede verlo tampoco lo manda, y ausente significa conservar.
 */
export const modificarProducto = async (idProducto, datos, perfil) => {
  const producto = await Producto.findOne({ where: { idProducto, activo: true } })
  if (!producto) throw new NoEncontrado('El producto')

  await verificarClasificaciones(datos)

  const cambios = {
    idCategoria: datos.idCategoria,
    idMarca: datos.idMarca,
    denominacion: datos.denominacion,
    descripcion: datos.descripcion ?? null,
    precioMinorista: datos.precioMinorista,
    precioMayorista: datos.precioMayorista,
    stockMinimo: datos.stockMinimo ?? 0,
  }
  if (datos.precioCosto !== undefined) cambios.precioCosto = datos.precioCosto

  // El bloqueo optimista de version_registro actua en este save: si otra
  // persona modifico la ficha mientras esta se editaba, falla y avisa.
  await producto.update(cambios)

  // Ausente significa "no tocar"; un arreglo vacio significa "sin ninguna".
  // Distinguirlos importa: si no, editar el precio borraria la compatibilidad.
  if (datos.compatibilidades !== undefined) {
    await producto.setCompatibilidades(datos.compatibilidades)
  }
  if (datos.proveedores !== undefined) {
    await producto.setProveedores(datos.proveedores)
  }

  log.info({ idProducto }, 'producto modificado')
  return buscarProducto(idProducto, perfil)
}

/** RF06.6 — imagen del producto. La ruta se guarda; el archivo vive en disco. */
export const asociarImagen = async (idProducto, rutaRelativa) => {
  const producto = await Producto.findOne({ where: { idProducto, activo: true } })
  if (!producto) throw new NoEncontrado('El producto')

  await producto.update({ imagenRuta: rutaRelativa })
  log.info({ idProducto, imagenRuta: rutaRelativa }, 'imagen asociada')

  return producto
}

/**
 * RF06.3 — baja LOGICA. El producto desaparece del catalogo pero conserva su
 * historial de movimientos y las lineas de venta que lo referencian.
 */
export const darDeBajaProducto = async (idProducto) => {
  const producto = await Producto.findOne({ where: { idProducto, activo: true } })
  if (!producto) throw new NoEncontrado('El producto')

  await producto.update({ activo: false })
  log.info({ idProducto, denominacion: producto.denominacion }, 'producto dado de baja')
}

/**
 * RF08.4 — actualizacion masiva por porcentaje sobre una categoria o una marca.
 *
 * Va en SQL crudo y en una sola sentencia a proposito: recorrer 3.000 productos
 * con el ORM serian 3.000 consultas y varios segundos. Aca es un UPDATE.
 *
 * Las columnas salen de una lista blanca (catalogo.reglas.js) porque el nombre
 * de una columna no se puede pasar como parametro; todo lo demas va como
 * parametro nombrado.
 */
export const actualizarPreciosMasivo = async ({ alcance, idAlcance, lista, porcentaje }) => {
  const columnas = columnasDeLista(lista)
  if (!columnas) throw new DatosInvalidos('No se reconoce que precios hay que actualizar.')

  const campoAlcance = alcance === 'categoria' ? 'id_categoria' : alcance === 'marca' ? 'id_marca' : null
  if (!campoAlcance) throw new DatosInvalidos('El alcance tiene que ser una categoria o una marca.')

  const factor = factorDePorcentaje(porcentaje)
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new DatosInvalidos('El porcentaje dejaria los precios en cero o negativos.')
  }

  const asignaciones = columnas.map((c) => `${c} = ROUND(${c} * :factor, 2)`).join(', ')

  const resultado = await sequelize.query(
    `UPDATE producto SET ${asignaciones} WHERE activo = 1 AND ${campoAlcance} = :idAlcance`,
    { replacements: { factor, idAlcance } },
  )

  const afectados = resultado?.[0]?.affectedRows ?? 0
  log.info({ alcance, idAlcance, lista, porcentaje, afectados }, 'precios actualizados en masa')

  return { afectados }
}
