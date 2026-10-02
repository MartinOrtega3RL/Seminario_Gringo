import { NavLink } from 'react-router'

// Pestañas de una sección. Se diferencian de la barra de arriba a propósito:
// aquella lleva a otra parte del sistema, estas cambian la vista de lo mismo.
// Por eso van colgadas del filete del encabezado y no repiten su chapa.

const pestana = ({ isActive }) =>
  [
    'inline-flex items-center gap-2 border-2 border-b-0 px-4 py-2',
    'text-sm font-semibold uppercase tracking-wide transition-colors',
    'rounded-t-[3px] -mb-[2px]',
    isActive
      ? 'border-tinta bg-crema text-tinta'
      : 'border-transparent text-crema/65 hover:border-crema/25 hover:text-crema',
  ].join(' ')

export const Pestanas = ({ items }) => (
  <nav aria-label="Vistas de la sección" className="flex flex-wrap gap-1 border-b-2 border-tinta/0">
    {items.map(({ a, texto, Icono, exacta }) => (
      <NavLink key={a} to={a} end={exacta} className={pestana}>
        {Icono && <Icono className="size-[18px]" />}
        {texto}
      </NavLink>
    ))}
  </nav>
)
