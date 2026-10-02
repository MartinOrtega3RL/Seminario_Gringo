import { Link, NavLink, Outlet } from 'react-router'
import { useSesion } from './sesion.jsx'
import { Boton } from '../ui/Boton.jsx'
import {
  IconoCatalogo, IconoVenta, IconoSalir, IconoHistorial, IconoClientes, IconoUsuarios,
} from '../ui/Iconos.jsx'

// Barra superior, no barra lateral. La lateral con iconos y tarjetas blancas
// es exactamente la disposición que el titular miró y descartó (H16).
//
// RNF06 pide navegación por menús e íconos: son cinco destinos y cada uno se
// muestra solo si el perfil lo tiene habilitado (RF04.1).

const SECCIONES = [
  { a: '/venta', texto: 'Mostrador', modulo: 'VENTAS', Icono: IconoVenta, exacta: true },
  { a: '/ventas', texto: 'Ventas', modulo: 'VENTAS', Icono: IconoHistorial },
  { a: '/productos', texto: 'Productos', modulo: 'CATALOGO_STOCK', Icono: IconoCatalogo },
  { a: '/clientes', texto: 'Clientes y proveedores', modulo: 'CLIENTES_PROV', Icono: IconoClientes },
  { a: '/usuarios', texto: 'Usuarios', modulo: 'ADMIN_SEGURIDAD', Icono: IconoUsuarios },
]

const enlace = ({ isActive }) =>
  [
    'inline-flex items-center gap-2 border-2 px-3 py-2 text-sm font-semibold uppercase tracking-wide',
    'rounded-[3px] transition-colors whitespace-nowrap',
    isActive
      ? 'border-tinta bg-crema text-tinta'
      : 'border-transparent text-crema/80 hover:border-crema/30 hover:text-crema',
  ].join(' ')

export const Marco = () => {
  const { usuario, salir, puedeLeer } = useSesion()
  const visibles = SECCIONES.filter((seccion) => puedeLeer(seccion.modulo))

  return (
    <div className="min-h-dvh bg-azul">
      <header className="no-imprimir border-b-4 border-escarlata bg-azul-hondo">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3 sm:px-6">
          {/* El nombre del comercio como cartel pintado, no como logotipo:
              no existe logo y no se inventa uno. */}
          <Link
            to="/"
            className="shrink-0 border-2 border-tinta bg-ambar px-3 py-1.5 font-[family-name:var(--font-cartel)] text-sm uppercase leading-none tracking-tight text-tinta shadow-[3px_3px_0_#000]"
          >
            El Gringo
          </Link>

          <nav aria-label="Secciones" className="flex flex-wrap gap-1.5">
            {visibles.map(({ a, texto, Icono, exacta }) => (
              <NavLink key={a} to={a} end={exacta} className={enlace}>
                <Icono className="size-[18px]" />
                {texto}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-2">
            <Link
              to="/mi-cuenta"
              className="hidden rounded-[3px] border-2 border-transparent px-2 py-1 text-right text-xs leading-tight text-crema/70 hover:border-crema/30 hover:text-crema sm:block"
            >
              <span className="block font-semibold text-crema">{usuario.apellidoNombre}</span>
              {usuario.perfil}
            </Link>

            <Boton tono="desnudo" tamano="chico" onClick={salir}>
              <IconoSalir className="size-4" />
              Salir
            </Boton>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
