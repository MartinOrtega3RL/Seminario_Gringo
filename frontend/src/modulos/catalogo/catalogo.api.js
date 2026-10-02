import { api, consulta } from '../../api/cliente.js'

// --- Lectura ---------------------------------------------------------------

export const listarProductos = ({ texto, pagina = 1, tamano = 24, idCategoria, idMarca, soloBajoMinimo } = {}) =>
  api.obtener(`/catalogo${consulta({ texto, pagina, tamano, idCategoria, idMarca, soloBajoMinimo })}`)

export const buscarProducto = (idProducto) => api.obtener(`/catalogo/${idProducto}`)

// --- Escritura -------------------------------------------------------------

/**
 * RF06.1 — alta. El codigo interno NO se manda: lo genera el servidor a partir
 * del prefijo de parametro_sistema (RF09.1). Si lo mandara el cliente, dos
 * altas simultaneas podrian pedir el mismo.
 */
export const registrarProducto = (datos) => api.enviar('/catalogo', datos)

/** RF06.2 y RF08 — modificacion de la ficha y de los tres precios. */
export const modificarProducto = (idProducto, datos) =>
  api.modificar(`/catalogo/${idProducto}`, datos)

/** RF06.3 — baja LOGICA. Conserva el historial de operaciones del producto. */
export const darDeBajaProducto = (idProducto) => api.borrar(`/catalogo/${idProducto}`)

/** RF06.6 — asociar una imagen al producto. */
export const subirImagenProducto = (idProducto, archivo) => {
  const formulario = new FormData()
  formulario.append('imagen', archivo)
  return api.subir(`/catalogo/${idProducto}/imagen`, formulario)
}

/**
 * RF09.2 — etiqueta imprimible con codigo, denominacion y precio.
 * Sin el prefijo /api: abrirDocumento lo antepone.
 */
export const rutaEtiqueta = (idProducto) => `/catalogo/${idProducto}/etiqueta`

/**
 * RF08.4 — actualizacion masiva por porcentaje sobre una categoria o una marca.
 * Decision del equipo (S09), no pedido del cliente: se adopta por la frecuencia
 * de reajuste que impone el contexto de precios.
 */
export const actualizarPreciosMasivo = (datos) => api.enviar('/catalogo/precios', datos)

// --- Modelos de dispositivo (RF06.8) ---------------------------------------
// Un modelo se da de alta una sola vez y despues se referencia: "iPhone 13"
// existe una vez, no una por cada funda que le sirve.

export const listarModelos = (texto) => api.obtener(`/modelos${consulta({ texto })}`)

export const registrarModelo = (datos) => api.enviar('/modelos', datos)

// --- Clasificaciones (RF07) ------------------------------------------------

export const listarCategorias = () => api.obtener('/categorias')
export const registrarCategoria = (datos) => api.enviar('/categorias', datos)
export const modificarCategoria = (id, datos) => api.modificar(`/categorias/${id}`, datos)
export const darDeBajaCategoria = (id) => api.borrar(`/categorias/${id}`)

export const listarMarcas = () => api.obtener('/marcas')
export const registrarMarca = (datos) => api.enviar('/marcas', datos)
export const modificarMarca = (id, datos) => api.modificar(`/marcas/${id}`, datos)
export const darDeBajaMarca = (id) => api.borrar(`/marcas/${id}`)
