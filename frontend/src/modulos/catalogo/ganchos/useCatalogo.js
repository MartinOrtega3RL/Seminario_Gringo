import { useMemo } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import { listarProductos } from '../catalogo.api.js'

/**
 * Busqueda del catalogo con paginacion.
 *
 * No hay lector de codigos de barras y no lo habra (S07): tipear es el gesto
 * central del sistema. El antirrebote y el descarte de respuestas fuera de
 * orden viven en useListadoPaginado, que es de donde salen todos los listados.
 */
export const useCatalogo = ({ tamano = 24, idCategoria, idMarca, soloBajoMinimo } = {}) => {
  const filtros = useMemo(
    () => ({ idCategoria, idMarca, soloBajoMinimo }),
    [idCategoria, idMarca, soloBajoMinimo],
  )

  const listado = useListadoPaginado(listarProductos, { tamano, filtros })

  return { ...listado, productos: listado.datos, reintentar: listado.recargar }
}
