import { useEffect, useRef, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Select, Texto, Area, Par } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { Marca } from '../../../ui/Listado.jsx'
import { Compatibilidades } from './Compatibilidades.jsx'
import { ProveedoresDelProducto } from './ProveedoresDelProducto.jsx'
import { puedeVerCosto } from '../catalogo.reglas.js'
import { useSesion } from '../../../app/sesion.jsx'

// RF06.1, RF06.2, RF06.6, RF06.8 y RF08.1-08.3 — la ficha completa del producto.
//
// Nota importante sobre las existencias: el stock actual NO se edita acá. El
// saldo tiene que seguir siendo igual a la suma de los movimientos, y escribirlo
// a mano rompería ese invariante sin dejar rastro de quién lo hizo. En el alta
// se carga una existencia inicial, que el servidor registra como un INGRESO; en
// la edición el campo es de lectura y se corrige por ingreso o por ajuste.

const VACIO = {
  denominacion: '',
  descripcion: '',
  idCategoria: '',
  idMarca: '',
  precioCosto: '',
  precioMinorista: '',
  precioMayorista: '',
  stockInicial: '0',
  stockMinimo: '0',
  compatibilidades: [],
  proveedores: [],
}

const desdeProducto = (producto) => ({
  denominacion: producto.denominacion ?? '',
  descripcion: producto.descripcion ?? '',
  idCategoria: String(producto.idCategoria ?? ''),
  idMarca: String(producto.idMarca ?? ''),
  precioCosto: producto.precioCosto != null ? String(producto.precioCosto) : '',
  precioMinorista: String(producto.precioMinorista ?? ''),
  precioMayorista: String(producto.precioMayorista ?? ''),
  stockInicial: String(producto.stockActual ?? 0),
  stockMinimo: String(producto.stockMinimo ?? 0),
  compatibilidades: producto.compatibilidades ?? [],
  proveedores: producto.proveedores ?? [],
})

export const FormularioProducto = ({ abierto, producto, categorias, marcas, alCerrar, alGuardar }) => {
  const { usuario } = useSesion()

  // RF04.2 — a quien no puede ver el costo, el servidor no se lo manda. Si el
  // formulario mostrara el campo vacío y lo enviara igual, guardar borraría el
  // costo del producto. Se oculta Y se omite del envío: ocultarlo sin omitirlo
  // sería la misma pérdida de datos, solo que invisible.
  const conCosto = puedeVerCosto(usuario.perfil)

  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [imagen, setImagen] = useState(null)
  const [vistaPrevia, setVistaPrevia] = useState(null)
  const archivo = useRef(null)

  useEffect(() => {
    if (!abierto) return
    setDatos(producto ? desdeProducto(producto) : VACIO)
    setErrores({})
    setError(null)
    setImagen(null)
    setVistaPrevia(producto?.imagenRuta ?? null)
  }, [abierto, producto])

  // La URL del objeto se libera al cambiarla o al cerrar: si no, cada imagen
  // elegida queda retenida en memoria hasta recargar la página.
  useEffect(() => {
    if (!imagen) return undefined
    const url = URL.createObjectURL(imagen)
    setVistaPrevia(url)
    return () => URL.revokeObjectURL(url)
  }, [imagen])

  const cambiar = (clave) => (evento) => {
    setDatos((previos) => ({ ...previos, [clave]: evento.target.value }))
    setErrores((previos) => ({ ...previos, [clave]: undefined }))
  }

  const validar = () => {
    const fallos = {}
    const numero = (valor) => (valor === '' ? NaN : Number(valor))

    if (datos.denominacion.trim().length < 2) fallos.denominacion = 'Cargá el nombre del producto.'
    if (!datos.idCategoria) fallos.idCategoria = 'Elegí una categoría.'
    if (!datos.idMarca) fallos.idMarca = 'Elegí una marca.'

    if (!(numero(datos.precioMinorista) >= 0)) fallos.precioMinorista = 'Cargá el precio minorista.'
    if (!(numero(datos.precioMayorista) >= 0)) fallos.precioMayorista = 'Cargá el precio mayorista.'
    if (conCosto && datos.precioCosto !== '' && !(numero(datos.precioCosto) >= 0)) {
      fallos.precioCosto = 'El costo no puede ser negativo.'
    }
    if (!(numero(datos.stockMinimo) >= 0)) fallos.stockMinimo = 'No puede ser negativo.'

    setErrores(fallos)
    return Object.keys(fallos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!validar()) return

    setGuardando(true)
    setError(null)

    try {
      await alGuardar(
        {
          denominacion: datos.denominacion.trim(),
          descripcion: datos.descripcion.trim() || null,
          idCategoria: Number(datos.idCategoria),
          idMarca: Number(datos.idMarca),
          // Ausente del cuerpo = el servidor conserva el valor que ya tenía.
          ...(conCosto ? { precioCosto: datos.precioCosto === '' ? 0 : Number(datos.precioCosto) } : {}),
          precioMinorista: Number(datos.precioMinorista),
          precioMayorista: Number(datos.precioMayorista),
          stockMinimo: Number(datos.stockMinimo),
          compatibilidades: datos.compatibilidades.map((modelo) => modelo.idModelo),
          proveedores: datos.proveedores.map((proveedor) => proveedor.idProveedor),
          // Solo en el alta: el servidor lo registra como movimiento de INGRESO.
          ...(producto ? {} : { stockInicial: Number(datos.stockInicial) }),
        },
        imagen,
      )
    } catch (fallo) {
      setError(fallo.message)
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      ancho="max-w-2xl"
      titulo={producto ? 'Editar producto' : 'Nuevo producto'}
      descripcion={
        producto
          ? `Código interno ${producto.codigoInterno}. El código no cambia nunca: ya puede estar impreso en una etiqueta.`
          : 'El código interno lo genera el sistema al guardar (RF09.1). No hace falta inventarlo.'
      }
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton form="form-producto" type="submit" cargando={guardando}>
            {producto ? 'Guardar cambios' : 'Dar de alta'}
          </Boton>
        </div>
      }
    >
      <form id="form-producto" onSubmit={enviar} noValidate className="grid gap-4">
        <Texto
          etiqueta="Denominación"
          obligatorio
          autoFocus
          value={datos.denominacion}
          onChange={cambiar('denominacion')}
          error={errores.denominacion}
          maxLength={150}
        />

        <Par>
          <Select
            etiqueta="Categoría"
            obligatorio
            value={datos.idCategoria}
            onChange={cambiar('idCategoria')}
            error={errores.idCategoria}
            vacio="Elegir…"
            opciones={categorias.map((c) => ({ valor: String(c.idCategoria), texto: c.nombre }))}
          />
          <Select
            etiqueta="Marca"
            obligatorio
            value={datos.idMarca}
            onChange={cambiar('idMarca')}
            error={errores.idMarca}
            vacio="Elegir…"
            opciones={marcas.map((m) => ({ valor: String(m.idMarca), texto: m.nombre }))}
          />
        </Par>

        <Area
          etiqueta="Descripción"
          value={datos.descripcion}
          onChange={cambiar('descripcion')}
          ayuda="Entra en la búsqueda por texto, así que conviene nombrar el modelo y el color."
        />

        <fieldset className="grid gap-4 border-2 border-crema/15 p-3">
          <legend className="px-1 text-[11px] font-bold uppercase tracking-[0.16em] text-ambar">
            Precios
          </legend>

          <Par>
            <Texto
              etiqueta="Minorista"
              obligatorio
              type="number"
              min="0"
              step="0.01"
              prefijo="$"
              value={datos.precioMinorista}
              onChange={cambiar('precioMinorista')}
              error={errores.precioMinorista}
            />
            <Texto
              etiqueta="Mayorista"
              obligatorio
              type="number"
              min="0"
              step="0.01"
              prefijo="$"
              value={datos.precioMayorista}
              onChange={cambiar('precioMayorista')}
              error={errores.precioMayorista}
            />
          </Par>

          {/* RF04.2 — el costo solo lo carga y lo ve quien está habilitado. */}
          {conCosto ? (
            <Texto
              etiqueta="Costo"
              type="number"
              min="0"
              step="0.01"
              prefijo="$"
              value={datos.precioCosto}
              onChange={cambiar('precioCosto')}
              error={errores.precioCosto}
              ayuda="Solo lo ve el perfil Administrador. No aparece en ninguna pantalla compartida."
            />
          ) : (
            <p className="border-l-2 border-crema/25 ps-3 text-xs leading-relaxed text-crema/55">
              El precio de costo lo administra el perfil Administrador. Si el producto ya tiene uno
              cargado, guardar desde acá no lo modifica.
            </p>
          )}
        </fieldset>

        <Par>
          <div>
            <Texto
              etiqueta={producto ? 'Existencias actuales' : 'Existencias iniciales'}
              type="number"
              min="0"
              value={datos.stockInicial}
              onChange={cambiar('stockInicial')}
              disabled={Boolean(producto)}
              ayuda={
                producto
                  ? 'No se edita acá: se corrige por ingreso o por ajuste, y queda el movimiento.'
                  : 'Se registra como un movimiento de ingreso a tu nombre.'
              }
            />
          </div>
          <Texto
            etiqueta="Stock mínimo"
            type="number"
            min="0"
            value={datos.stockMinimo}
            onChange={cambiar('stockMinimo')}
            error={errores.stockMinimo}
            ayuda="Cuando el saldo lo alcanza, el producto se marca en el catálogo."
          />
        </Par>

        <Compatibilidades
          elegidos={datos.compatibilidades}
          alCambiar={(valores) => setDatos((previos) => ({ ...previos, compatibilidades: valores }))}
          marcas={marcas}
          idMarcaProducto={datos.idMarca}
          deshabilitado={guardando}
        />

        <ProveedoresDelProducto
          elegidos={datos.proveedores}
          alCambiar={(valores) => setDatos((previos) => ({ ...previos, proveedores: valores }))}
          deshabilitado={guardando}
        />

        <div>
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
            Imagen
          </span>

          <div className="flex items-center gap-3">
            {vistaPrevia ? (
              <img
                src={vistaPrevia}
                alt=""
                className="size-20 shrink-0 border-2 border-tinta bg-crema object-cover"
              />
            ) : (
              <span className="grid size-20 shrink-0 place-items-center border-2 border-dashed border-crema/25 text-[10px] uppercase tracking-wider text-crema/40">
                Sin foto
              </span>
            )}

            <div className="grid gap-2">
              <input
                ref={archivo}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(evento) => setImagen(evento.target.files?.[0] ?? null)}
              />
              <Boton tono="papel" tamano="chico" onClick={() => archivo.current?.click()}>
                Elegir imagen
              </Boton>
              {imagen && <Marca tono="destacado">{imagen.name}</Marca>}
            </div>
          </div>
        </div>

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
