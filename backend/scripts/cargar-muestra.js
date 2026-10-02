// Catalogo de muestra para probar y para demostrar el sistema.
//
//   npm run cargar-muestra      carga los articulos
//   npm run cargar-muestra -- --borrar   los saca
//
// Son datos de DEMOSTRACION, no del comercio: los precios son plausibles pero
// inventados, y todos los articulos llevan el prefijo DEMO en su codigo interno
// para que se los distinga de un producto real de un vistazo y para que
// borrarlos no toque nunca algo cargado en serio.

import { sequelize } from '../src/config/base-de-datos.js'
import { Producto, Categoria, Marca } from '../src/modelos/index.js'

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
  console.log('Para sacarlos:  npm run cargar-muestra -- --borrar\n')
}

const borrar = async () => {
  const { Op } = await import('sequelize')

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
  if (process.argv.includes('--borrar')) await borrar()
  else await cargar()
}

main()
  .catch((error) => {
    console.error(`\nNo se pudo completar: ${error.message}`)
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      console.error('Algun articulo de muestra ya tiene ventas o movimientos asociados.')
      console.error('La base protege ese historial: hay que borrar primero esas operaciones.\n')
    }
    process.exitCode = 1
  })
  .finally(() => sequelize.close().catch(() => {}))
