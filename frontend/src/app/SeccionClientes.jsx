import { Outlet } from 'react-router'
import { Encabezado } from '../ui/Panel.jsx'
import { Pestanas } from '../ui/Pestanas.jsx'
import { IconoClientes, IconoEntrar } from '../ui/Iconos.jsx'

// El módulo 3 de la carpeta es «Clientes y proveedores», uno solo y con un
// único permiso. Mismo criterio que en Productos: un módulo, una sección.
//
// Los dos son personas con las que el comercio tiene una relación comercial;
// lo que cambia es la dirección: a uno le vendés, al otro le comprás.

const VISTAS = [
  { a: '/clientes', texto: 'Clientes', Icono: IconoClientes, exacta: true },
  { a: '/clientes/proveedores', texto: 'Proveedores', Icono: IconoEntrar },
]

export const SeccionClientes = () => (
  <div className="grid gap-5">
    <div>
      <Encabezado titulo="Clientes y proveedores" tamano="text-3xl" />
      <p className="mt-2 max-w-prose text-sm text-crema/60">
        A quién le vendés y a quién le comprás.
      </p>
    </div>

    <Pestanas items={VISTAS} />

    <Outlet />
  </div>
)
