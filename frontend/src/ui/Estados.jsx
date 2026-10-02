import { Boton } from './Boton.jsx'

// Una pantalla no esta terminada porque funcione cuando todo sale bien.
// Estos tres estados se usan en todas partes y se ven iguales en todas.

/** Esqueleto de carga: ocupa el mismo lugar que el contenido, para que la
 *  pantalla no salte cuando llega. */
export const Cargando = ({ filas = 6, etiqueta = 'Cargando' }) => (
  <div role="status" aria-live="polite" className="grid gap-3">
    <span className="sr-only">{etiqueta}…</span>
    {Array.from({ length: filas }, (_, indice) => (
      <div
        key={indice}
        aria-hidden="true"
        className="h-24 animate-pulse rounded-[3px] border-2 border-crema/10 bg-crema/5"
        style={{ animationDelay: `${indice * 70}ms` }}
      />
    ))}
  </div>
)

/** Vacio: dice por que esta vacio y ofrece la salida, nunca solo "sin datos". */
export const Vacio = ({ titulo, detalle, accion }) => (
  <div className="mx-auto max-w-md px-6 py-16 text-center">
    <p className="font-[family-name:var(--font-cartel)] text-xl uppercase text-crema">{titulo}</p>
    {detalle && <p className="mt-2 text-sm leading-relaxed text-crema/70">{detalle}</p>}
    {accion && <div className="mt-6 flex justify-center">{accion}</div>}
  </div>
)

/** Error: muestra el mensaje que preparo el servidor (RNF08), no la excepcion. */
export const Fallo = ({ error, reintentar }) => (
  <div
    role="alert"
    className="mx-auto max-w-md rounded-[3px] border-2 border-escarlata bg-escarlata/10 px-6 py-8 text-center"
  >
    <p className="font-[family-name:var(--font-cartel)] text-lg uppercase text-crema">
      No se pudo cargar
    </p>
    <p className="mt-2 text-sm leading-relaxed text-crema/80">
      {error?.message ?? 'Ocurrio un problema inesperado.'}
    </p>

    {error?.detalles?.length > 0 && (
      <ul className="mt-3 space-y-1 text-left text-xs text-crema/70">
        {error.detalles.map((detalle) => (
          <li key={detalle.campo}>
            <strong className="font-semibold">{detalle.campo}:</strong> {detalle.mensaje}
          </li>
        ))}
      </ul>
    )}

    {reintentar && (
      <Boton tono="papel" tamano="chico" className="mt-6" onClick={reintentar}>
        Reintentar
      </Boton>
    )}
  </div>
)

/** Aviso al pie de una accion: confirma o explica sin robarse la pantalla. */
export const Aviso = ({ tono = 'bien', children }) => (
  <p
    role={tono === 'mal' ? 'alert' : 'status'}
    className={`rounded-[3px] border-2 px-3 py-2 text-sm font-medium ${
      tono === 'mal'
        ? 'border-escarlata bg-escarlata/15 text-crema'
        : 'border-ambar bg-ambar/15 text-crema'
    }`}
  >
    {children}
  </p>
)
