import { useEffect, useRef } from 'react'
import { IconoBuscar } from '../../../ui/Iconos.jsx'

// El buscador va a escala de cartel de vidriera y es el primer objeto que
// encuentra el ojo: el local no tiene lector de codigos (S07), asi que tipear
// ES el mecanismo del producto, no una funcion accesoria del encabezado.

export const Buscador = ({ valor, alEscribir, resultados, cargando, autoFoco = true }) => {
  const entrada = useRef(null)

  // La barra invertida enfoca la busqueda desde cualquier parte de la
  // pantalla: en el mostrador se vuelve a buscar todo el tiempo y llegar con
  // el mouse cuesta un gesto que el teclado no cuesta.
  useEffect(() => {
    const alTeclear = (evento) => {
      if (evento.key !== '\\' || evento.target.matches('input, textarea')) return
      evento.preventDefault()
      entrada.current?.focus()
      entrada.current?.select()
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [])

  return (
    <div className="relative">
      <label htmlFor="buscador" className="sr-only">
        Buscar producto por nombre o codigo interno
      </label>

      <IconoBuscar className="pointer-events-none absolute left-4 top-1/2 size-6 -translate-y-1/2 text-tinta/45" />

      <input
        id="buscador"
        ref={entrada}
        type="search"
        value={valor}
        autoFocus={autoFoco}
        onChange={(evento) => alEscribir(evento.target.value)}
        placeholder="Buscar producto o codigo…"
        aria-describedby="buscador-ayuda"
        className="numeral h-[72px] w-full rounded-[3px] border-[3px] border-tinta bg-crema pl-14 pr-4 text-2xl font-semibold text-tinta shadow-[5px_5px_0_var(--color-azul-hondo)] placeholder:font-normal placeholder:text-tinta/35 focus:shadow-[5px_5px_0_var(--color-escarlata)]"
      />

      <p
        id="buscador-ayuda"
        aria-live="polite"
        className="mt-2 flex items-center gap-3 text-xs text-crema/60"
      >
        <span>
          Escribi el nombre o el codigo interno completo. Atajo:{' '}
          <kbd className="rounded-[3px] border border-crema/40 px-1.5 py-0.5 font-semibold">\</kbd>
        </span>
        {!cargando && valor && (
          <span className="numeral font-semibold text-ambar">
            {resultados} {resultados === 1 ? 'resultado' : 'resultados'}
          </span>
        )}
      </p>
    </div>
  )
}
