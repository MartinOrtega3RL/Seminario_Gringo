import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { ProveedorSesion, useSesion } from './sesion.jsx'
import { Marco } from './Marco.jsx'
import { SeccionProductos } from './SeccionProductos.jsx'
import { SeccionClientes } from './SeccionClientes.jsx'
import { Ingreso } from '../modulos/acceso/paginas/Ingreso.jsx'
import { Usuarios } from '../modulos/acceso/paginas/Usuarios.jsx'
import { Perfiles } from '../modulos/permisos/paginas/Perfiles.jsx'
import { PestanaPerfiles } from '../modulos/permisos/componentes/PestanaPerfiles.jsx'
import { MatrizPermisos } from '../modulos/permisos/componentes/MatrizPermisos.jsx'
import { Bitacora } from '../modulos/bitacora/paginas/Bitacora.jsx'
import { MiCuenta } from '../modulos/acceso/paginas/MiCuenta.jsx'
import { Catalogo } from '../modulos/catalogo/paginas/Catalogo.jsx'
import { Clasificaciones } from '../modulos/catalogo/paginas/Clasificaciones.jsx'
import { Existencias } from '../modulos/existencias/paginas/Existencias.jsx'
import { Recepciones } from '../modulos/recepciones/paginas/Recepciones.jsx'
import { ValidacionRecepcion } from '../modulos/recepciones/paginas/ValidacionRecepcion.jsx'
import { Clientes } from '../modulos/clientes/paginas/Clientes.jsx'
import { FichaCliente, InicioFichaCliente } from '../modulos/clientes/paginas/FichaCliente.jsx'
import { HistorialComprasCliente } from '../modulos/clientes/componentes/HistorialComprasCliente.jsx'
import { HistorialReparacionesCliente } from '../modulos/clientes/componentes/HistorialReparacionesCliente.jsx'
import { Proveedores } from '../modulos/proveedores/paginas/Proveedores.jsx'
import { PuntoDeVenta } from '../modulos/ventas/paginas/PuntoDeVenta.jsx'
import { HistorialVentas } from '../modulos/ventas/paginas/HistorialVentas.jsx'
import { Comprobante } from '../modulos/ventas/paginas/Comprobante.jsx'
import { Cuotas } from '../modulos/ventas/paginas/Cuotas.jsx'
import { Pedidos } from '../modulos/pedidos/paginas/Pedidos.jsx'
import { Ordenes } from '../modulos/servicio/paginas/Ordenes.jsx'
import { NuevaOrden } from '../modulos/servicio/paginas/NuevaOrden.jsx'
import { FichaOrden } from '../modulos/servicio/paginas/FichaOrden.jsx'
import { Reportes } from '../modulos/reportes/paginas/Reportes.jsx'
import { ReporteComercial } from '../modulos/reportes/componentes/ReporteComercial.jsx'
import { ReporteInventario } from '../modulos/reportes/componentes/ReporteInventario.jsx'
import { ReporteServicio } from '../modulos/reportes/componentes/ReporteServicio.jsx'
import { Vacio } from '../ui/Estados.jsx'

const Espera = () => (
  <div className="grid min-h-dvh place-items-center bg-azul">
    <p role="status" className="font-[family-name:var(--font-cartel)] uppercase text-crema/70">
      Abriendo…
    </p>
  </div>
)

const Protegido = ({ children }) => {
  const { usuario, rehidratando } = useSesion()

  if (rehidratando) return <Espera />
  if (!usuario) return <Navigate to="/ingreso" replace />
  return children
}

/**
 * RF04.1 — el módulo no habilitado no se muestra ni se alcanza por URL.
 * Es comodidad para el usuario: el control real lo hace el servidor en cada
 * operación (RNF18), porque escribir la ruta a mano saltea cualquier interfaz.
 */
const SegunPermiso = ({ modulo, children }) => {
  const { puedeLeer } = useSesion()

  if (puedeLeer(modulo)) return children

  return (
    <Vacio
      titulo="No tenés acceso a esta sección"
      detalle="Tu perfil no la tiene habilitada. Si la necesitás, pedíselo al administrador."
    />
  )
}

/** A dónde manda el sistema al entrar, según lo que el perfil puede hacer. */
const Inicio = () => {
  const { puedeLeer } = useSesion()

  if (puedeLeer('VENTAS')) return <Navigate to="/venta" replace />
  // El tecnico no tiene ventas: su pantalla es el taller.
  if (puedeLeer('SERVICIO_TECNICO')) return <Navigate to="/servicio" replace />
  if (puedeLeer('CATALOGO_STOCK')) return <Navigate to="/productos" replace />
  if (puedeLeer('CLIENTES_PROV')) return <Navigate to="/clientes" replace />
  return <Navigate to="/mi-cuenta" replace />
}

const conPermiso = (modulo, elemento) => <SegunPermiso modulo={modulo}>{elemento}</SegunPermiso>

const Rutas = () => (
  <Routes>
    <Route path="/ingreso" element={<Ingreso />} />

    <Route
      element={
        <Protegido>
          <Marco />
        </Protegido>
      }
    >
      <Route index element={<Inicio />} />

      <Route path="/venta" element={conPermiso('VENTAS', <PuntoDeVenta />)} />
      <Route path="/ventas" element={conPermiso('VENTAS', <HistorialVentas />)} />
      <Route path="/pedidos" element={conPermiso('VENTAS', <Pedidos />)} />
      <Route path="/cuotas" element={conPermiso('VENTAS', <Cuotas />)} />
      <Route path="/venta/:idVenta/comprobante" element={conPermiso('VENTAS', <Comprobante />)} />

      {/* Servicio técnico: el listado, la recepción y la ficha de cada orden.
          «nueva» va antes de «:idOrden», o se la tomaría por un identificador. */}
      <Route path="/servicio" element={conPermiso('SERVICIO_TECNICO', <Ordenes />)} />
      <Route path="/servicio/nueva" element={conPermiso('SERVICIO_TECNICO', <NuevaOrden />)} />
      <Route path="/servicio/:idOrden" element={conPermiso('SERVICIO_TECNICO', <FichaOrden />)} />

      {/* Una sola sección con tres vistas: el módulo 2 de la carpeta es uno. */}
      <Route path="/productos" element={conPermiso('CATALOGO_STOCK', <SeccionProductos />)}>
        <Route index element={<Catalogo />} />
        <Route path="recepciones" element={<Recepciones />} />
        <Route path="recepciones/:id" element={<ValidacionRecepcion />} />
        <Route path="movimientos" element={<Existencias />} />
        <Route path="clasificaciones" element={<Clasificaciones />} />
      </Route>

      {/* Las direcciones viejas siguen funcionando: pueden estar en un favorito. */}
      <Route path="/catalogo" element={<Navigate to="/productos" replace />} />
      <Route path="/catalogo/clasificaciones" element={<Navigate to="/productos/clasificaciones" replace />} />
      <Route path="/existencias" element={<Navigate to="/productos/movimientos" replace />} />

      <Route path="/clientes" element={conPermiso('CLIENTES_PROV', <SeccionClientes />)}>
        <Route index element={<Clientes />} />
        <Route path="proveedores" element={<Proveedores />} />
      </Route>
      <Route path="/clientes/:idCliente" element={conPermiso('CLIENTES_PROV', <FichaCliente />)}>
        <Route index element={<InicioFichaCliente />} />
        <Route path="compras" element={conPermiso('VENTAS', <HistorialComprasCliente />)} />
        <Route path="reparaciones" element={conPermiso('SERVICIO_TECNICO', <HistorialReparacionesCliente />)} />
      </Route>
      <Route path="/usuarios" element={conPermiso('ADMIN_SEGURIDAD', <Usuarios />)} />
      <Route path="/perfiles" element={conPermiso('SOPORTE_SISTEMA', <Perfiles />)}>
        <Route index element={<PestanaPerfiles />} />
        <Route path="matriz" element={<MatrizPermisos />} />
      </Route>
      <Route path="/bitacora" element={conPermiso('SOPORTE_SISTEMA', <Bitacora />)} />
      <Route path="/reportes" element={conPermiso('REPORTES', <Reportes />)}>
        <Route index element={<ReporteComercial />} />
        <Route path="inventario" element={<ReporteInventario />} />
        <Route path="servicio" element={<ReporteServicio />} />
      </Route>
      <Route path="/mi-cuenta" element={<MiCuenta />} />

      <Route
        path="*"
        element={
          <Vacio
            titulo="Esa dirección no existe"
            detalle="Puede que el enlace esté viejo. Usá el menú de arriba para volver."
          />
        }
      />
    </Route>
  </Routes>
)

export const App = () => (
  <BrowserRouter>
    <ProveedorSesion>
      <Rutas />
    </ProveedorSesion>
  </BrowserRouter>
)
