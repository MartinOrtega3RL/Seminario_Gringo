import { Outlet } from 'react-router'
import { Encabezado } from '../ui/Panel.jsx'
import { Pestanas } from '../ui/Pestanas.jsx'
import { IconoCatalogo, IconoExistencias, IconoEtiqueta } from '../ui/Iconos.jsx'

// El módulo 2 de la carpeta es uno solo —«Catálogo y existencias»— y tiene un
// único permiso. Presentarlo como dos secciones separadas obligaba a adivinar
// en cuál buscar cada cosa: el listado mostraba stock y «existencias» mostraba
// movimientos, así que ninguno de los dos nombres decía lo que hacía.
//
// Ahora es una sección con tres vistas, y cada nombre dice qué vas a encontrar:
// las cosas, lo que pasó con ellas, y cómo están clasificadas.

const VISTAS = [
  { a: '/productos', texto: 'Listado', Icono: IconoCatalogo, exacta: true },
  { a: '/productos/movimientos', texto: 'Movimientos', Icono: IconoExistencias },
  { a: '/productos/clasificaciones', texto: 'Categorías y marcas', Icono: IconoEtiqueta },
]

export const SeccionProductos = () => (
  <div className="grid gap-5">
    <div>
      <Encabezado titulo="Productos" tamano="text-3xl" />
      <p className="mt-2 max-w-prose text-sm text-crema/60">
        Lo que vendés, cuánto hay de cada cosa y qué pasó con el stock.
      </p>
    </div>

    <Pestanas items={VISTAS} />

    <Outlet />
  </div>
)
