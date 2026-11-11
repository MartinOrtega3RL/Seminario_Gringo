import { Outlet } from 'react-router'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Pestanas } from '../../../ui/Pestanas.jsx'
import { IconoUsuarios, IconoCandado } from '../../../ui/Iconos.jsx'

const VISTAS = [
  { a: '/perfiles', texto: 'Perfiles', Icono: IconoUsuarios, exacta: true },
  { a: '/perfiles/matriz', texto: 'Matriz de permisos', Icono: IconoCandado },
]

// RF03 — administracion de perfiles y matriz de permisos.
export const Perfiles = () => (
  <div className="grid gap-5">
    <div>
      <Encabezado titulo="Perfiles y permisos" tamano="text-3xl" />
      <p className="mt-2 max-w-prose text-sm text-crema/60">
        Qué puede ver y hacer cada perfil en los módulos del sistema.
      </p>
    </div>

    <Pestanas items={VISTAS} />

    <Outlet />
  </div>
)

