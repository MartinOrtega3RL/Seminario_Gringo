import { useEffect, useState } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import {
  listarClientes, listarTiposCliente, registrarCliente, modificarCliente, darDeBajaCliente,
} from '../clientes.api.js'
import { FormularioCliente } from '../componentes/FormularioCliente.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { Confirmar } from '../../../ui/Dialogo.jsx'
import { IconoBuscar, IconoEditar, IconoQuitar, IconoMas } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

export const Clientes = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CLIENTES_PROV')

  const listado = useListadoPaginado(listarClientes, { tamano: 20 })
  const [tipos, setTipos] = useState([])

  const [editando, setEditando] = useState(null) // null | 'nuevo' | cliente
  const [borrando, setBorrando] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  useEffect(() => {
    listarTiposCliente()
      .then(({ datos }) => setTipos(datos))
      .catch(() => setTipos([]))
  }, [])

  const guardar = async (datos) => {
    if (editando === 'nuevo') await registrarCliente(datos)
    else await modificarCliente(editando.idCliente, datos)

    setEditando(null)
    listado.recargar()
  }

  const confirmarBaja = async () => {
    setTrabajando(true)
    try {
      await darDeBajaCliente(borrando.idCliente)
      setBorrando(null)
      listado.recargar()
    } finally {
      setTrabajando(false)
    }
  }

  const { datos: clientes, paginacion, cargando, error } = listado

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-64 flex-1">
          <label htmlFor="buscar-clientes" className="sr-only">
            Buscar cliente por nombre, documento o WhatsApp
          </label>
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
          <input
            id="buscar-clientes"
            type="search"
            value={listado.texto}
            onChange={(evento) => listado.escribir(evento.target.value)}
            placeholder="Nombre, documento o WhatsApp…"
            className="h-12 w-full max-w-xl rounded-[3px] border-2 border-tinta bg-crema pl-11 pr-3 text-base text-tinta shadow-[4px_4px_0_var(--color-azul-hondo)] placeholder:text-tinta/40"
          />
        </div>

        {escritura && (
          <Boton onClick={() => setEditando('nuevo')}>
            <IconoMas />
            Nuevo cliente
          </Boton>
        )}
      </div>

      {error && <Fallo error={error} reintentar={listado.recargar} />}

      {!error && cargando && clientes.length === 0 && <Cargando filas={5} etiqueta="Buscando clientes" />}

      {!error && !cargando && clientes.length === 0 && (
        <Vacio
          titulo={listado.texto ? 'Ningún cliente coincide' : 'Todavía no hay clientes'}
          detalle={
            listado.texto
              ? 'Probá con menos letras, o buscá por el número de WhatsApp.'
              : 'El padrón se llena sobre la marcha: cada vez que una venta necesita un cliente, se da de alta acá.'
          }
          accion={
            listado.texto ? (
              <Boton tono="papel" onClick={() => listado.escribir('')}>
                Limpiar la búsqueda
              </Boton>
            ) : (
              escritura && <Boton onClick={() => setEditando('nuevo')}>Dar de alta el primero</Boton>
            )
          }
        />
      )}

      {clientes.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {clientes.map((cliente) => (
              <Fila
                key={cliente.idCliente}
                principal={cliente.persona.apellidoNombre}
                secundario={
                  [
                    cliente.persona.numeroDocumento &&
                      `${cliente.persona.tipoDocumento} ${cliente.persona.numeroDocumento}`,
                    cliente.persona.telefonoWhatsapp,
                    cliente.persona.domicilio,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin datos de contacto'
                }
                derecha={
                  <Marca tono={cliente.tipoCliente.listaPrecioAplicable === 'MAYORISTA' ? 'destacado' : 'neutro'}>
                    {cliente.tipoCliente.nombre}
                  </Marca>
                }
                alAbrir={escritura ? () => setEditando(cliente) : undefined}
                acciones={
                  escritura && (
                    <>
                      <AccionFila etiqueta="Editar" onClick={() => setEditando(cliente)}>
                        <IconoEditar className="size-4" />
                      </AccionFila>
                      <AccionFila etiqueta="Dar de baja" peligrosa onClick={() => setBorrando(cliente)}>
                        <IconoQuitar className="size-4" />
                      </AccionFila>
                    </>
                  )
                }
              />
            ))}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <FormularioCliente
        abierto={editando !== null}
        cliente={editando === 'nuevo' ? null : editando}
        tipos={tipos}
        alCerrar={() => setEditando(null)}
        alGuardar={guardar}
      />

      <Confirmar
        abierto={borrando !== null}
        alCerrar={() => setBorrando(null)}
        alConfirmar={confirmarBaja}
        trabajando={trabajando}
        titulo="Dar de baja el cliente"
        // RF13.3 es baja logica: importa decirlo, porque "dar de baja" suena
        // a borrar y el operador tiene que saber que el historial queda.
        detalle={`${borrando?.persona.apellidoNombre ?? ''} deja de aparecer en las búsquedas, pero sus ventas anteriores se conservan.`}
        textoAccion="Dar de baja"
      />
    </div>
  )
}
