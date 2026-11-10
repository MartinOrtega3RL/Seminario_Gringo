import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useNavigate, useParams } from 'react-router'
import { buscarCliente, listarTiposCliente, modificarCliente } from '../clientes.api.js'
import { destinoInicialFicha, pestanasFichaCliente } from '../clientes.reglas.js'
import { FormularioCliente } from '../componentes/FormularioCliente.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Pestanas } from '../../../ui/Pestanas.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { IconoEditar, IconoVenta, IconoServicio } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

const ICONOS = {
  compras: IconoVenta,
  reparaciones: IconoServicio,
}

const Dato = ({ rotulo, children, ancho = false }) => (
  <div className={ancho ? 'sm:col-span-2' : undefined}>
    <dt className="text-[10px] font-bold uppercase tracking-[0.16em] text-tinta/55">{rotulo}</dt>
    <dd className="mt-0.5 text-sm font-semibold leading-snug text-tinta">{children}</dd>
  </div>
)

// RF14 — ficha del cliente con historial de compras y de reparaciones.
export const FichaCliente = () => {
  const { idCliente } = useParams()
  const navegar = useNavigate()
  const { puedeLeer, puedeEscribir } = useSesion()

  const escritura = puedeEscribir('CLIENTES_PROV')
  const verCompras = puedeLeer('VENTAS')
  const verReparaciones = puedeLeer('SERVICIO_TECNICO')

  const [cliente, setCliente] = useState(null)
  const [tipos, setTipos] = useState([])
  const [editando, setEditando] = useState(false)
  const [error, setError] = useState(null)

  const cargar = useCallback(async () => {
    setError(null)
    try {
      const { datos } = await buscarCliente(idCliente)
      setCliente(datos)
    } catch (fallo) {
      setError(fallo)
    }
  }, [idCliente])

  useEffect(() => {
    setCliente(null)
    cargar()
  }, [cargar])

  useEffect(() => {
    if (!escritura) return
    listarTiposCliente()
      .then(({ datos }) => setTipos(datos))
      .catch(() => setTipos([]))
  }, [escritura])

  const guardar = async (datos) => {
    const { datos: actualizado } = await modificarCliente(cliente.idCliente, datos)
    setCliente(actualizado)
    setEditando(false)
  }

  if (error) {
    return error.estado === 404 ? (
      <Vacio
        titulo="Ese cliente no existe"
        detalle="Puede que haya sido dado de baja o que el enlace esté viejo."
        accion={<Boton tono="papel" onClick={() => navegar('/clientes')}>Volver a clientes</Boton>}
      />
    ) : (
      <Fallo error={error} reintentar={cargar} />
    )
  }

  if (!cliente) return <Cargando filas={4} etiqueta="Abriendo la ficha del cliente" />

  const persona = cliente.persona
  const pestanas = pestanasFichaCliente({ idCliente, verCompras, verReparaciones }).map((item) => ({
    ...item,
    Icono: ICONOS[item.clave],
  }))

  return (
    <div className="grid gap-5">
      <div>
        <Link to="/clientes" className="text-xs font-semibold uppercase tracking-wide text-crema/60 hover:text-crema">
          ← Clientes
        </Link>

        <Encabezado
          className="mt-2"
          titulo={persona.apellidoNombre}
          tamano="text-3xl"
          derecha={
            <div className="flex flex-wrap items-center gap-3">
              <Marca tono={cliente.tipoCliente.listaPrecioAplicable === 'MAYORISTA' ? 'destacado' : 'neutro'}>
                {cliente.tipoCliente.nombre}
              </Marca>
              {escritura && (
                <Boton tono="papel" onClick={() => setEditando(true)}>
                  <IconoEditar className="size-4" />
                  Editar
                </Boton>
              )}
            </div>
          }
        />
      </div>

      <section className="panel p-5" aria-label="Datos del cliente">
        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
          <Dato rotulo="Documento">
            {persona.numeroDocumento ? (
              <span className="numeral">{persona.tipoDocumento} {persona.numeroDocumento}</span>
            ) : (
              <span className="font-normal text-tinta/55">Sin cargar</span>
            )}
          </Dato>
          <Dato rotulo="WhatsApp">
            {persona.telefonoWhatsapp ? (
              <span className="numeral">{persona.telefonoWhatsapp}</span>
            ) : (
              <span className="font-normal text-tinta/55">Sin cargar</span>
            )}
          </Dato>
          <Dato rotulo="Correo">
            {persona.correo ?? <span className="font-normal text-tinta/55">Sin cargar</span>}
          </Dato>
          <Dato rotulo="Domicilio">
            {persona.domicilio ?? <span className="font-normal text-tinta/55">Sin cargar</span>}
          </Dato>
          {cliente.observaciones && (
            <Dato rotulo="Observaciones" ancho>
              <span className="font-normal">{cliente.observaciones}</span>
            </Dato>
          )}
        </dl>
      </section>

      {pestanas.length > 0 && <Pestanas items={pestanas} />}

      <Outlet />

      {escritura && (
        <FormularioCliente
          abierto={editando}
          cliente={cliente}
          tipos={tipos}
          alCerrar={() => setEditando(false)}
          alGuardar={guardar}
        />
      )}
    </div>
  )
}

export const InicioFichaCliente = () => {
  const { puedeLeer } = useSesion()
  const destino = destinoInicialFicha({
    verCompras: puedeLeer('VENTAS'),
    verReparaciones: puedeLeer('SERVICIO_TECNICO'),
  })

  if (destino) return <Navigate to={destino} replace />

  return (
    <Vacio
      titulo="Sin historial habilitado"
      detalle="Tu perfil no tiene permiso para consultar compras ni reparaciones."
    />
  )
}

