// Pictogramas propios, no una libreria. La senaletica pintada usa trazo grueso
// y punta cuadrada: un juego de iconos de trazo fino y punta redonda seria de
// otro sistema visual. Son seis y alcanzan; RNF06 pide navegacion con iconos,
// no un catalogo de iconos.

const Trazo = ({ children, className = 'size-5' }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="square"
    strokeLinejoin="miter"
    aria-hidden="true"
    className={className}
  >
    {children}
  </svg>
)

export const IconoCatalogo = (props) => (
  <Trazo {...props}>
    <path d="M3 5h7v6H3zM14 5h7v6h-7zM3 15h7v4H3zM14 15h7v4h-7z" />
  </Trazo>
)

export const IconoVenta = (props) => (
  <Trazo {...props}>
    <path d="M3 4h3l2.4 11h9.3L20 7H7" />
    <path d="M9 20h.01M17 20h.01" />
  </Trazo>
)

export const IconoBuscar = (props) => (
  <Trazo {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M15.5 15.5 21 21" />
  </Trazo>
)

export const IconoSalir = (props) => (
  <Trazo {...props}>
    <path d="M9 4H4v16h5M15 8l4 4-4 4M19 12H9" />
  </Trazo>
)

export const IconoMas = (props) => (
  <Trazo {...props}>
    <path d="M12 5v14M5 12h14" />
  </Trazo>
)

export const IconoMenos = (props) => (
  <Trazo {...props}>
    <path d="M5 12h14" />
  </Trazo>
)

export const IconoQuitar = (props) => (
  <Trazo {...props}>
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
  </Trazo>
)

export const IconoImprimir = (props) => (
  <Trazo {...props}>
    <path d="M7 9V3h10v6M7 19H4V9h16v10h-3M7 15h10v6H7z" />
  </Trazo>
)

export const IconoEditar = (props) => (
  <Trazo {...props}>
    <path d="M4 20h4L20 8l-4-4L4 16v4zM14 6l4 4" />
  </Trazo>
)

export const IconoUsuarios = (props) => (
  <Trazo {...props}>
    <path d="M4 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2" />
    <circle cx="10" cy="7" r="3.5" />
    <path d="M17 13a4 4 0 0 1 3 3.8V20" />
  </Trazo>
)

export const IconoClientes = (props) => (
  <Trazo {...props}>
    <path d="M3 20v-1.5C3 16 5.5 14 9 14s6 2 6 4.5V20" />
    <circle cx="9" cy="7.5" r="3.5" />
    <path d="M17 4h4v6h-4zM19 13v3" />
  </Trazo>
)

export const IconoExistencias = (props) => (
  <Trazo {...props}>
    <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
    <path d="M3 7l9 4 9-4M12 11v10" />
  </Trazo>
)

export const IconoHistorial = (props) => (
  <Trazo {...props}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7v5l3.5 2.5" />
  </Trazo>
)

export const IconoEtiqueta = (props) => (
  <Trazo {...props}>
    <path d="M3 5h10l8 7-8 7H3z" />
    <path d="M7 12h.01" />
  </Trazo>
)

export const IconoEntrar = (props) => (
  <Trazo {...props}>
    <path d="M12 4v10M8 10l4 4 4-4M4 18v2h16v-2" />
  </Trazo>
)

export const IconoBalanza = (props) => (
  <Trazo {...props}>
    <path d="M12 4v16M5 8h14M5 8 2 15h6zM19 8l-3 7h6zM8 20h8" />
  </Trazo>
)

// Llave de tuerca, para el servicio tecnico.
export const IconoServicio = (props) => (
  <Trazo {...props}>
    <path d="M14.5 6.5a4 4 0 0 0 4.9 4.9L21 13l-3 3-2.4-2.4L8 21l-3-3 7.6-7.6L10.2 8l3-3z" />
  </Trazo>
)

export const IconoFoto = (props) => (
  <Trazo {...props}>
    <path d="M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
  </Trazo>
)

export const IconoCampana = (props) => (
  <Trazo {...props}>
    <path d="M6 17V11a6 6 0 0 1 12 0v6l2 2H4zM10 21h4" />
  </Trazo>
)

export const IconoReportes = (props) => (
  <Trazo {...props}>
    <path d="M4 20h16M7 20v-6M12 20V8M17 20v-9" />
  </Trazo>
)

export const IconoPedidos = (props) => (
  <Trazo {...props}>
    <path d="M6 4h12v16H6zM9 9h6M9 13h6M9 17h4" />
  </Trazo>
)

export const IconoBitacora = (props) => (
  <Trazo {...props}>
    <path d="M5 4h14v16H5zM9 4v16M12 9h4M12 13h4" />
  </Trazo>
)

export const IconoCandado = (props) => (
  <Trazo {...props}>
    <path d="M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3" />
  </Trazo>
)

export const IconoTilde = (props) => (
  <Trazo {...props}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Trazo>
)

export const IconoFlecha = (props) => (
  <Trazo {...props}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Trazo>
)

export const IconoCerrar = (props) => (
  <Trazo {...props}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Trazo>
)
