import { useEffect, useRef } from 'react'
import { Titulo, Filete } from './Panel.jsx'
import { Boton } from './Boton.jsx'

// Se usa el <dialog> nativo y no un div con position fixed: trae el atrapado
// de foco, el cierre con Escape, el fondo inerte y la devolucion del foco al
// control que lo abrio. Reimplementar todo eso a mano es como se rompe la
// navegacion por teclado sin que nadie lo note.

export const Dialogo = ({ abierto, alCerrar, titulo, descripcion, ancho = 'max-w-lg', children, pie }) => {
  const dialogo = useRef(null)

  useEffect(() => {
    const nodo = dialogo.current
    if (!nodo) return

    if (abierto && !nodo.open) nodo.showModal()
    if (!abierto && nodo.open) nodo.close()
  }, [abierto])

  return (
    <dialog
      ref={dialogo}
      onCancel={(evento) => {
        evento.preventDefault()
        alCerrar()
      }}
      // Clic en el fondo: solo cuenta si el objetivo es el dialogo mismo y no
      // algo de adentro, para que arrastrar un texto hasta el borde no cierre.
      onClick={(evento) => evento.target === dialogo.current && alCerrar()}
      className={`w-[min(92vw,var(--ancho))] border-2 border-black bg-azul-hondo p-0 text-crema backdrop:bg-azul/80 ${ancho}`}
      style={{ '--ancho': '32rem' }}
    >
      <div className="border-b-2 border-crema/12 px-5 pb-3 pt-5">
        <Titulo nivel={2} className="text-xl">
          {titulo}
        </Titulo>
        <Filete className="mt-2" />
        {descripcion && <p className="mt-2 text-sm leading-relaxed text-crema/65">{descripcion}</p>}
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>

      {pie && <div className="border-t-2 border-crema/12 px-5 py-4">{pie}</div>}
    </dialog>
  )
}

/**
 * Confirmacion de algo que no se deshace facil. El boton peligroso NO es el
 * que tiene el foco al abrir: confirmar tiene que costar un gesto deliberado.
 */
export const Confirmar = ({ abierto, alCerrar, alConfirmar, titulo, detalle, textoAccion = 'Confirmar', trabajando }) => (
  <Dialogo
    abierto={abierto}
    alCerrar={alCerrar}
    titulo={titulo}
    descripcion={detalle}
    ancho="max-w-md"
    pie={
      <div className="flex justify-end gap-3">
        <Boton tono="desnudo" onClick={alCerrar} disabled={trabajando} autoFocus>
          Cancelar
        </Boton>
        <Boton onClick={alConfirmar} cargando={trabajando}>
          {textoAccion}
        </Boton>
      </div>
    }
  >
    <p className="text-sm leading-relaxed text-crema/80">
      Esta accion queda registrada con tu usuario.
    </p>
  </Dialogo>
)
