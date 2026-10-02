import { z } from 'zod'

// S01 dimensiona el catalogo en 3.000 articulos y RNF02 exige respuesta en
// menos de dos segundos. Ningun listado devuelve el conjunto completo.
//
// El tope existe para que nadie pida ?tamano=999999 y tumbe la respuesta.
const TAMANO_POR_OMISION = 25
const TAMANO_MAXIMO = 100

export const esquemaPaginacion = z.object({
  pagina: z.coerce.number().int().min(1).default(1),
  tamano: z.coerce.number().int().min(1).max(TAMANO_MAXIMO).default(TAMANO_POR_OMISION),
})

// De los parametros de consulta a lo que espera Sequelize.
export const leerPaginacion = (consulta) => {
  const { pagina, tamano } = esquemaPaginacion.parse(consulta)
  return { pagina, tamano, limit: tamano, offset: (pagina - 1) * tamano }
}

// Envuelve el resultado de findAndCountAll en la respuesta que consume el frontend.
export const responderPaginado = ({ count, rows }, { pagina, tamano }) => ({
  datos: rows,
  paginacion: {
    pagina,
    tamano,
    total: count,
    totalPaginas: Math.max(1, Math.ceil(count / tamano)),
  },
})
