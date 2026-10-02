import { Boton } from '../../../ui/Boton.jsx'

// Ningun listado devuelve el catalogo entero: S01 lo dimensiona en 3.000
// articulos y RNF02 da dos segundos. La paginacion es del sistema, no de esta
// pantalla, y se ve igual en todas las que listen algo.

export const Paginacion = ({ paginacion, alCambiar }) => {
  const { pagina, totalPaginas, total, tamano } = paginacion
  if (total === 0) return null

  const desde = (pagina - 1) * tamano + 1
  const hasta = Math.min(pagina * tamano, total)

  return (
    <nav
      aria-label="Paginacion del catalogo"
      className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t-2 border-crema/15 pt-4"
    >
      <p className="numeral text-xs text-crema/70" aria-live="polite">
        {desde}–{hasta} de <span className="font-semibold text-crema">{total}</span>
      </p>

      <div className="flex items-center gap-2">
        <Boton
          tono="papel"
          tamano="chico"
          disabled={pagina <= 1}
          onClick={() => alCambiar(pagina - 1)}
        >
          Anterior
        </Boton>

        <span className="numeral px-2 text-xs font-semibold text-crema">
          {pagina} / {totalPaginas}
        </span>

        <Boton
          tono="papel"
          tamano="chico"
          disabled={pagina >= totalPaginas}
          onClick={() => alCambiar(pagina + 1)}
        >
          Siguiente
        </Boton>
      </div>
    </nav>
  )
}
