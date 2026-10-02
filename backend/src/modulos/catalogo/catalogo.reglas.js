// Reglas del catalogo que se deciden sin consultar la base.

// RF04.2 — el precio de costo revela la rentabilidad del negocio y no se
// muestra a cualquiera.
//
// Los tres perfiles vienen precargados (H13) porque RF03, que los haria
// configurables, esta diferido. Cuando RF03 entre, esta lista se reemplaza
// por una bandera en la matriz de permisos y este archivo no cambia mas.
const PERFILES_CON_ACCESO_A_COSTOS = new Set(['Administrador'])

export const puedeVerCosto = (perfil) => PERFILES_CON_ACCESO_A_COSTOS.has(perfil)

const CAMPOS_SENSIBLES = ['precioCosto']

/**
 * Devuelve el producto tal como puede verlo ese perfil. Es lo unico que sale
 * hacia el controlador: asi el costo no se filtra por olvido en un endpoint.
 */
export const productoVisible = (producto, perfil) => {
  const plano = typeof producto?.get === 'function' ? producto.get({ plain: true }) : { ...producto }

  if (puedeVerCosto(perfil)) return plano

  for (const campo of CAMPOS_SENSIBLES) delete plano[campo]
  return plano
}

export const catalogoVisible = (productos, perfil) =>
  productos.map((producto) => productoVisible(producto, perfil))

/**
 * Prepara el texto para MATCH ... AGAINST en modo booleano. Los operadores
 * (+ - * " ~ < > ( )) se quitan: si el usuario escribe "funda -azul", la
 * consulta no debe interpretarlo como sintaxis.
 * El comodin final habilita la busqueda predictiva de RF16.2.
 */
export const prepararBusqueda = (texto) => {
  const limpio = String(texto ?? '')
    .replace(/[+\-*~<>()"@]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((palabra) => palabra.length > 0)

  if (limpio.length === 0) return null
  return limpio.map((palabra) => `+${palabra}*`).join(' ')
}

/**
 * RF09.1 — codigo de barras interno, propio del comercio y distinto del que
 * trae el fabricante (H02).
 *
 * Se deriva del identificador que asigna la base, igual que el numero de
 * comprobante: es la unica forma de garantizar que dos altas simultaneas no
 * pidan el mismo codigo. Un contador en la aplicacion tendria esa carrera.
 *
 * El prefijo sale de parametro_sistema, no del codigo, para que el comercio
 * pueda cambiarlo sin que nadie recompile nada.
 */
export const formatearCodigoInterno = (idProducto, prefijo = 'EGC') =>
  `${prefijo}-${String(idProducto).padStart(6, '0')}`

/**
 * RF08.4 — que columnas toca la actualizacion masiva.
 *
 * Es una lista blanca y no un parametro: el nombre de una columna no se puede
 * pasar como parametro a la base, asi que si viniera del cliente entraria
 * armado en la sentencia. Mapear contra esta lista es lo que lo hace seguro.
 */
const COLUMNAS_POR_LISTA = {
  MINORISTA: ['precio_minorista'],
  MAYORISTA: ['precio_mayorista'],
  AMBAS: ['precio_minorista', 'precio_mayorista'],
  COSTO: ['precio_costo'],
}

export const columnasDeLista = (lista) => COLUMNAS_POR_LISTA[lista] ?? null

/** El porcentaje se convierte en factor multiplicador: -10 % -> 0,90. */
export const factorDePorcentaje = (porcentaje) => 1 + Number(porcentaje) / 100
