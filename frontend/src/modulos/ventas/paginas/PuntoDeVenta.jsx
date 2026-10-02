import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCatalogo } from '../../catalogo/ganchos/useCatalogo.js'
import { Buscador } from '../../catalogo/componentes/Buscador.jsx'
import { PanelProducto } from '../../catalogo/componentes/PanelProducto.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { useVenta } from '../ganchos/useVenta.js'
import { PanelVenta } from '../componentes/PanelVenta.jsx'
import { confirmarVenta } from '../ventas.api.js'
import { api } from '../../../api/cliente.js'
import { Boton } from '../../../ui/Boton.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'

const CONDICIONES_INICIALES = {
  idMedioPago: null,
  modalidadPago: 'CONTADO',
  cantidadCuotas: null,
  modalidadEntrega: 'RETIRO_LOCAL',
  domicilioEntrega: '',
}

export const PuntoDeVenta = () => {
  const navegar = useNavigate()
  const catalogo = useCatalogo({ tamano: 12 })
  const venta = useVenta()

  const [mediosPago, setMediosPago] = useState([])
  const [condiciones, setCondiciones] = useState(CONDICIONES_INICIALES)
  const [confirmando, setConfirmando] = useState(false)
  const [errorVenta, setErrorVenta] = useState(null)
  const [errorDomicilio, setErrorDomicilio] = useState(null)

  useEffect(() => {
    api
      .obtener('/ventas/medios-pago')
      .then(({ datos }) => {
        setMediosPago(datos)
        setCondiciones((previas) => ({
          ...previas,
          idMedioPago: previas.idMedioPago ?? datos[0]?.idMedioPago ?? null,
        }))
      })
      .catch(() => setMediosPago([]))
  }, [])

  // Contado y cuotas no pueden convivir: la base lo verifica con un CHECK, y
  // corregirlo aca evita que salte como error tecnico (RNF08).
  const cambiarCondiciones = (nuevas) => {
    setErrorDomicilio(null)
    setCondiciones({
      ...nuevas,
      cantidadCuotas: nuevas.modalidadPago === 'CONTADO' ? null : (nuevas.cantidadCuotas || 1),
    })
  }

  const confirmar = async () => {
    if (condiciones.modalidadEntrega === 'ENVIO_DOMICILIO' && !condiciones.domicilioEntrega.trim()) {
      setErrorDomicilio('El envio a domicilio necesita que cargues la direccion.')
      return
    }

    setConfirmando(true)
    setErrorVenta(null)

    try {
      const { datos } = await confirmarVenta({
        idCliente: venta.cliente?.idCliente ?? null,
        lineas: venta.lineas.map(({ idProducto, cantidad }) => ({ idProducto, cantidad })),
        idMedioPago: condiciones.idMedioPago,
        modalidadPago: condiciones.modalidadPago,
        cantidadCuotas: condiciones.cantidadCuotas,
        modalidadEntrega: condiciones.modalidadEntrega,
        domicilioEntrega: condiciones.domicilioEntrega.trim() || null,
      })

      // El control unico transforma la pantalla entera en el comprobante, en
      // vez de abrir un dialogo encima de lo que ya estaba.
      venta.vaciar()
      setCondiciones({ ...CONDICIONES_INICIALES, idMedioPago: condiciones.idMedioPago })
      navegar(`/venta/${datos.idVenta}/comprobante`)
    } catch (fallo) {
      // El servidor pudo haber rechazado por falta de stock: el catalogo que
      // se ve quedo viejo, asi que se lo vuelve a pedir.
      setErrorVenta(fallo.message)
      catalogo.reintentar()
      setConfirmando(false)
    }
  }

  const { productos, paginacion, cargando, error } = catalogo

  // El precio que se muestra en el catalogo es el de la lista vigente en la
  // venta: si hay un mayorista asociado, la pared entera cambia de precio.
  const precioVigente = (producto) =>
    venta.lista === 'MAYORISTA' ? producto.precioMayorista : producto.precioMinorista

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
      <div className="grid gap-5">
        <Buscador
          valor={catalogo.texto}
          alEscribir={catalogo.escribir}
          resultados={paginacion.total}
          cargando={cargando}
        />

        {error && <Fallo error={error} reintentar={catalogo.reintentar} />}

        {!error && cargando && productos.length === 0 && (
          <Cargando filas={4} etiqueta="Buscando productos" />
        )}

        {!error && !cargando && productos.length === 0 && (
          <Vacio
            titulo={catalogo.texto ? 'No hay nada con ese nombre' : 'El catalogo esta vacio'}
            detalle={
              catalogo.texto
                ? 'Probá con menos palabras, o revisá el codigo interno.'
                : 'Todavia no hay productos cargados para vender.'
            }
            accion={
              catalogo.texto && (
                <Boton tono="papel" onClick={() => catalogo.escribir('')}>
                  Limpiar la busqueda
                </Boton>
              )
            }
          />
        )}

        {productos.length > 0 && (
          <>
            <div
              className={`grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3 ${
                cargando ? 'opacity-50' : ''
              }`}
            >
              {productos.map((producto) => (
                <PanelProducto
                  key={producto.idProducto}
                  producto={producto}
                  precio={precioVigente(producto)}
                  alSeleccionar={venta.agregar}
                />
              ))}
            </div>

            <Paginacion paginacion={paginacion} alCambiar={catalogo.setPagina} />
          </>
        )}
      </div>

      <PanelVenta
        lineas={venta.lineas}
        unidades={venta.unidades}
        totalCentavos={venta.totalCentavos}
        lista={venta.lista}
        cliente={venta.cliente}
        alElegirCliente={venta.setCliente}
        mediosPago={mediosPago}
        condiciones={condiciones}
        alCambiarCondiciones={cambiarCondiciones}
        errorDomicilio={errorDomicilio}
        alCambiarCantidad={venta.cambiarCantidad}
        alQuitar={venta.quitar}
        alVaciar={venta.vaciar}
        alConfirmar={confirmar}
        confirmando={confirmando}
        error={errorVenta}
      />
    </div>
  )
}
