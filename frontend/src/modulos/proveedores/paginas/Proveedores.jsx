import { useEffect, useState } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import {
  listarProveedores, listarProductosDelProveedor,
  registrarProveedor, modificarProveedor, darDeBajaProveedor,
} from '../proveedores.api.js'
import { FormularioProveedor } from '../componentes/FormularioProveedor.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { Confirmar, Dialogo } from '../../../ui/Dialogo.jsx'
import { IconoBuscar, IconoEditar, IconoQuitar, IconoMas, IconoCatalogo } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF15 — gestión de proveedores. H14: «Tenemos varios proveedores... Tecnomóvil,
// Benjasel, Blanca, son varios».

/** RF15.2 — qué se le compra a este proveedor. */
const QueLeCompramos = ({ proveedor, alCerrar }) => {
  const [productos, setProductos] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!proveedor) return undefined

    let vigente = true
    setProductos(null)
    setError(null)

    listarProductosDelProveedor(proveedor.idProveedor)
      .then(({ datos }) => vigente && setProductos(datos))
      .catch((fallo) => vigente && setError(fallo))

    return () => {
      vigente = false
    }
  }, [proveedor])

  return (
    <Dialogo
      abierto={proveedor !== null}
      alCerrar={alCerrar}
      titulo="Qué le compramos"
      descripcion={proveedor?.persona.apellidoNombre}
      pie={
        <div className="flex justify-end">
          <Boton tono="desnudo" onClick={alCerrar}>
            Cerrar
          </Boton>
        </div>
      }
    >
      {error && <Fallo error={error} />}
      {!error && productos === null && <Cargando filas={3} etiqueta="Buscando" />}

      {productos?.length === 0 && (
        <p className="py-6 text-center text-sm leading-relaxed text-crema/60">
          Todavía no hay ningún producto asociado a este proveedor. Se asocian desde la ficha
          de cada producto, en el listado.
        </p>
      )}

      {productos?.length > 0 && (
        <Listado>
          {productos.map((producto) => (
            <Fila
              key={producto.idProducto}
              principal={producto.denominacion}
              secundario={`${producto.codigoInterno} · ${producto.categoria?.nombre} · ${producto.marca?.nombre}`}
              derecha={
                <span className="numeral text-sm font-semibold text-crema/70">
                  {producto.stockActual} en stock
                </span>
              }
            />
          ))}
        </Listado>
      )}
    </Dialogo>
  )
}

export const Proveedores = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CLIENTES_PROV')

  const listado = useListadoPaginado(listarProveedores, { tamano: 20 })
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const [trabajando, setTrabajando] = useState(false)

  const guardar = async (datos) => {
    if (editando === 'nuevo') await registrarProveedor(datos)
    else await modificarProveedor(editando.idProveedor, datos)

    setEditando(null)
    listado.recargar()
  }

  const confirmarBaja = async () => {
    setTrabajando(true)
    try {
      await darDeBajaProveedor(borrando.idProveedor)
      setBorrando(null)
      listado.recargar()
    } finally {
      setTrabajando(false)
    }
  }

  const { datos: proveedores, paginacion, cargando, error } = listado

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative min-w-64 flex-1">
          <label htmlFor="buscar-proveedores" className="sr-only">
            Buscar proveedor por nombre, documento o WhatsApp
          </label>
          <IconoBuscar className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-tinta/45" />
          <input
            id="buscar-proveedores"
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
            Nuevo proveedor
          </Boton>
        )}
      </div>

      {error && <Fallo error={error} reintentar={listado.recargar} />}

      {!error && cargando && proveedores.length === 0 && (
        <Cargando filas={4} etiqueta="Buscando proveedores" />
      )}

      {!error && !cargando && proveedores.length === 0 && (
        <Vacio
          titulo={listado.texto ? 'Ningún proveedor coincide' : 'Todavía no hay proveedores'}
          detalle={
            listado.texto
              ? 'Probá con menos letras, o buscá por el número de WhatsApp.'
              : 'Cargá a quiénes les comprás. Después, en la ficha de cada producto, marcás de quién viene.'
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

      {proveedores.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {proveedores.map((proveedor) => (
              <Fila
                key={proveedor.idProveedor}
                principal={proveedor.persona.apellidoNombre}
                secundario={
                  [
                    proveedor.persona.numeroDocumento &&
                      `${proveedor.persona.tipoDocumento} ${proveedor.persona.numeroDocumento}`,
                    proveedor.persona.telefonoWhatsapp,
                    proveedor.sitioWeb,
                    proveedor.observaciones,
                  ]
                    .filter(Boolean)
                    .join(' · ') || 'Sin datos de contacto'
                }
                derecha={
                  proveedor.persona.tipoPersona === 'JURIDICA' ? <Marca>Empresa</Marca> : <Marca>Persona</Marca>
                }
                alAbrir={escritura ? () => setEditando(proveedor) : undefined}
                acciones={
                  <>
                    <AccionFila etiqueta="Qué le compramos" onClick={() => setViendo(proveedor)}>
                      <IconoCatalogo className="size-4" />
                    </AccionFila>
                    {escritura && (
                      <>
                        <AccionFila etiqueta="Editar" onClick={() => setEditando(proveedor)}>
                          <IconoEditar className="size-4" />
                        </AccionFila>
                        <AccionFila
                          etiqueta="Dar de baja"
                          peligrosa
                          onClick={() => setBorrando(proveedor)}
                        >
                          <IconoQuitar className="size-4" />
                        </AccionFila>
                      </>
                    )}
                  </>
                }
              />
            ))}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <FormularioProveedor
        abierto={editando !== null}
        proveedor={editando === 'nuevo' ? null : editando}
        alCerrar={() => setEditando(null)}
        alGuardar={guardar}
      />

      <QueLeCompramos proveedor={viendo} alCerrar={() => setViendo(null)} />

      <Confirmar
        abierto={borrando !== null}
        alCerrar={() => setBorrando(null)}
        alConfirmar={confirmarBaja}
        trabajando={trabajando}
        titulo="Dar de baja el proveedor"
        detalle={`${borrando?.persona.apellidoNombre ?? ''} deja de aparecer en las búsquedas, pero las compras que se le hicieron se conservan.`}
        textoAccion="Dar de baja"
      />
    </div>
  )
}
