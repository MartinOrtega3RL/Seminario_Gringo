import { useEffect, useState } from 'react'
import { useCatalogo } from '../ganchos/useCatalogo.js'
import {
  listarCategorias, listarMarcas, registrarProducto, modificarProducto,
  darDeBajaProducto, subirImagenProducto, actualizarPreciosMasivo, rutaEtiqueta,
} from '../catalogo.api.js'
import { abrirDocumento } from '../../../api/cliente.js'
import { Buscador } from '../componentes/Buscador.jsx'
import { PanelProducto } from '../componentes/PanelProducto.jsx'
import { Paginacion } from '../componentes/Paginacion.jsx'
import { FormularioProducto } from '../componentes/FormularioProducto.jsx'
import { PreciosMasivos } from '../componentes/PreciosMasivos.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { AccionFila } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'
import { Confirmar } from '../../../ui/Dialogo.jsx'
import { IconoMas, IconoEditar, IconoQuitar, IconoEtiqueta, IconoBalanza } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

const FILTRO = 'h-10 rounded-[3px] border-2 border-tinta bg-crema px-2.5 text-sm font-semibold text-tinta'

export const Catalogo = () => {
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('CATALOGO_STOCK')

  const [idCategoria, setIdCategoria] = useState('')
  const [idMarca, setIdMarca] = useState('')
  const [soloBajoMinimo, setSoloBajoMinimo] = useState(false)

  const catalogo = useCatalogo({
    tamano: 24,
    idCategoria: idCategoria || undefined,
    idMarca: idMarca || undefined,
    soloBajoMinimo: soloBajoMinimo || undefined,
  })

  const [categorias, setCategorias] = useState([])
  const [marcas, setMarcas] = useState([])
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [preciosAbierto, setPreciosAbierto] = useState(false)
  const [trabajando, setTrabajando] = useState(false)
  const [errorDocumento, setErrorDocumento] = useState(null)

  // El pliego se pide con la cabecera de autorizacion: window.open no la lleva.
  const verEtiqueta = async (idProducto) => {
    setErrorDocumento(null)
    try {
      await abrirDocumento(rutaEtiqueta(idProducto))
    } catch (fallo) {
      setErrorDocumento(fallo.message)
    }
  }

  useEffect(() => {
    listarCategorias().then(({ datos }) => setCategorias(datos)).catch(() => setCategorias([]))
    listarMarcas().then(({ datos }) => setMarcas(datos)).catch(() => setMarcas([]))
  }, [])

  const guardar = async (datos, imagen) => {
    const respuesta = editando === 'nuevo'
      ? await registrarProducto(datos)
      : await modificarProducto(editando.idProducto, datos)

    // La imagen viaja aparte porque es multipart: el alta tiene que existir
    // antes de poder colgarle un archivo.
    if (imagen) {
      const id = respuesta?.datos?.idProducto ?? editando.idProducto
      await subirImagenProducto(id, imagen).catch(() => {})
    }

    setEditando(null)
    catalogo.reintentar()
  }

  const confirmarBaja = async () => {
    setTrabajando(true)
    try {
      await darDeBajaProducto(borrando.idProducto)
      setBorrando(null)
      catalogo.reintentar()
    } finally {
      setTrabajando(false)
    }
  }

  const aplicarPrecios = async (datos) => {
    await actualizarPreciosMasivo(datos)
    setPreciosAbierto(false)
    catalogo.reintentar()
  }

  const { productos, paginacion, cargando, error } = catalogo
  const conFiltro = Boolean(catalogo.texto || idCategoria || idMarca || soloBajoMinimo)

  return (
    <div className="grid gap-5">
      {escritura && (
        <div className="flex flex-wrap justify-end gap-2">
          <Boton tono="papel" onClick={() => setPreciosAbierto(true)}>
            <IconoBalanza />
            Precios
          </Boton>
          <Boton onClick={() => setEditando('nuevo')}>
            <IconoMas />
            Nuevo producto
          </Boton>
        </div>
      )}

      <Buscador
        valor={catalogo.texto}
        alEscribir={catalogo.escribir}
        resultados={paginacion.total}
        cargando={cargando}
      />

      <div className="flex flex-wrap items-center gap-2">
        <label htmlFor="filtro-categoria" className="sr-only">
          Filtrar por categoría
        </label>
        <select
          id="filtro-categoria"
          className={FILTRO}
          value={idCategoria}
          onChange={(evento) => setIdCategoria(evento.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.idCategoria} value={c.idCategoria}>
              {c.nombre}
            </option>
          ))}
        </select>

        <label htmlFor="filtro-marca" className="sr-only">
          Filtrar por marca
        </label>
        <select
          id="filtro-marca"
          className={FILTRO}
          value={idMarca}
          onChange={(evento) => setIdMarca(evento.target.value)}
        >
          <option value="">Todas las marcas</option>
          {marcas.map((m) => (
            <option key={m.idMarca} value={m.idMarca}>
              {m.nombre}
            </option>
          ))}
        </select>

        {/* RF12.3 — el filtro de lo que llegó al mínimo es lo que convierte la
            alerta en una lista accionable de reposición. */}
        <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[3px] border-2 border-crema/30 px-3 text-sm font-semibold text-crema/80 hover:border-crema/60 has-checked:border-escarlata has-checked:bg-escarlata/15 has-checked:text-crema">
          <input
            type="checkbox"
            checked={soloBajoMinimo}
            onChange={(evento) => setSoloBajoMinimo(evento.target.checked)}
            className="size-4 accent-escarlata"
          />
          Solo los que llegaron al mínimo
        </label>

        {conFiltro && (
          <button
            type="button"
            onClick={() => {
              catalogo.escribir('')
              setIdCategoria('')
              setIdMarca('')
              setSoloBajoMinimo(false)
            }}
            className="text-xs font-semibold uppercase tracking-wide text-crema/55 underline underline-offset-4 hover:text-crema"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {errorDocumento && <Aviso tono="mal">{errorDocumento}</Aviso>}

      {error && <Fallo error={error} reintentar={catalogo.reintentar} />}

      {!error && cargando && productos.length === 0 && <Cargando filas={6} etiqueta="Buscando" />}

      {!error && !cargando && productos.length === 0 && (
        <Vacio
          titulo={conFiltro ? 'No hay nada que coincida' : 'El catálogo está vacío'}
          detalle={
            conFiltro
              ? 'Probá con menos filtros, o revisá el código interno.'
              : 'Cargá el primer producto y el sistema le genera el código interno solo.'
          }
          accion={
            conFiltro ? (
              <Boton tono="papel" onClick={() => { catalogo.escribir(''); setIdCategoria(''); setIdMarca(''); setSoloBajoMinimo(false) }}>
                Limpiar filtros
              </Boton>
            ) : (
              escritura && <Boton onClick={() => setEditando('nuevo')}>Cargar el primero</Boton>
            )
          }
        />
      )}

      {productos.length > 0 && (
        <>
          <div
            className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 ${
              cargando ? 'opacity-50' : ''
            }`}
          >
            {productos.map((producto) => (
              <PanelProducto
                key={producto.idProducto}
                producto={producto}
                acciones={
                  escritura && (
                    <>
                      <AccionFila
                        sobre="claro"
                        etiqueta="Imprimir etiqueta"
                        onClick={() => verEtiqueta(producto.idProducto)}
                      >
                        <IconoEtiqueta className="size-4" />
                      </AccionFila>
                      <AccionFila sobre="claro" etiqueta="Editar" onClick={() => setEditando(producto)}>
                        <IconoEditar className="size-4" />
                      </AccionFila>
                      <AccionFila sobre="claro" etiqueta="Dar de baja" peligrosa onClick={() => setBorrando(producto)}>
                        <IconoQuitar className="size-4" />
                      </AccionFila>
                    </>
                  )
                }
              />
            ))}
          </div>

          <Paginacion paginacion={paginacion} alCambiar={catalogo.setPagina} />
        </>
      )}

      <FormularioProducto
        abierto={editando !== null}
        producto={editando === 'nuevo' ? null : editando}
        categorias={categorias}
        marcas={marcas}
        alCerrar={() => setEditando(null)}
        alGuardar={guardar}
      />

      <PreciosMasivos
        abierto={preciosAbierto}
        categorias={categorias}
        marcas={marcas}
        alCerrar={() => setPreciosAbierto(false)}
        alAplicar={aplicarPrecios}
      />

      <Confirmar
        abierto={borrando !== null}
        alCerrar={() => setBorrando(null)}
        alConfirmar={confirmarBaja}
        trabajando={trabajando}
        titulo="Dar de baja el producto"
        detalle={`${borrando?.denominacion ?? ''} deja de aparecer en el catálogo y en las ventas, pero su historial de movimientos se conserva.`}
        textoAccion="Dar de baja"
      />
    </div>
  )
}
