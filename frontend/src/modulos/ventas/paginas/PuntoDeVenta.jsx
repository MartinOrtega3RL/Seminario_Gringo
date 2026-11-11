import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { useCatalogo } from '../../catalogo/ganchos/useCatalogo.js'
import { Buscador } from '../../catalogo/componentes/Buscador.jsx'
import { PanelProducto } from '../../catalogo/componentes/PanelProducto.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { useVenta } from '../ganchos/useVenta.js'
import { PanelVenta } from '../componentes/PanelVenta.jsx'
import { confirmarVenta } from '../ventas.api.js'
import { DialogoPedido } from '../../pedidos/componentes/DialogoPedido.jsx'
import { MODALIDADES_PAGO, CUOTAS_MAXIMAS } from '../ventas.reglas.js'
import { useSesion } from '../../../app/sesion.jsx'
import { api } from '../../../api/cliente.js'
import { Boton } from '../../../ui/Boton.jsx'
import { Cargando, Vacio, Fallo, Aviso } from '../../../ui/Estados.jsx'

const CONDICIONES_INICIALES = {
  idMedioPago: null,
  referenciaPago: '',
  modalidadPago: 'CONTADO',
  cantidadCuotas: null,
  recargoFinanciacion: 0,
  modalidadEntrega: 'RETIRO_LOCAL',
  domicilioEntrega: '',
}

export const PuntoDeVenta = () => {
  const navegar = useNavigate()
  const { puedeEscribir } = useSesion()
  const escritura = puedeEscribir('VENTAS')
  const catalogo = useCatalogo({ tamano: 12 })
  const venta = useVenta()

  const [mediosPago, setMediosPago] = useState([])
  const [condiciones, setCondiciones] = useState(CONDICIONES_INICIALES)
  const [confirmando, setConfirmando] = useState(false)
  const [errorVenta, setErrorVenta] = useState(null)
  const [errorDomicilio, setErrorDomicilio] = useState(null)
  const [pedidoPendiente, setPedidoPendiente] = useState(null)
  const [avisoPedido, setAvisoPedido] = useState(null)

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
    setErrorVenta(null)
    const modalidadInfo = MODALIDADES_PAGO[nuevas.modalidadPago] ?? MODALIDADES_PAGO.CONTADO
    setCondiciones({
      ...nuevas,
      idMedioPago: modalidadInfo.cobraAlVender ? nuevas.idMedioPago : null,
      // Vacio mientras el vendedor escribe: si se completara con 1 al borrar,
      // el digito siguiente quedaria pegado (6 se registraria como 16).
      cantidadCuotas: !modalidadInfo.enCuotas
        ? null
        : nuevas.cantidadCuotas === ''
          ? ''
          : Math.max(1, Math.min(CUOTAS_MAXIMAS, Number(nuevas.cantidadCuotas) || 1)),
      recargoFinanciacion: !modalidadInfo.admiteRecargo ? 0 : Math.max(0, Number(nuevas.recargoFinanciacion) || 0),
    })
  }

  const confirmar = async () => {
    const modalidadInfo = MODALIDADES_PAGO[condiciones.modalidadPago] ?? MODALIDADES_PAGO.CONTADO
    if (modalidadInfo.financia === 'COMERCIO' && !venta.cliente) {
      setErrorVenta('Para financiar con el comercio tenés que asociar un cliente registrado.')
      return
    }
    if (modalidadInfo.enCuotas && condiciones.cantidadCuotas === '') {
      setErrorVenta('Indicá la cantidad de cuotas.')
      return
    }
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
        idMedioPago: modalidadInfo.cobraAlVender ? condiciones.idMedioPago : null,
        referenciaPago: (modalidadInfo.cobraAlVender && condiciones.referenciaPago.trim()) || null,
        modalidadPago: condiciones.modalidadPago,
        cantidadCuotas: modalidadInfo.enCuotas ? condiciones.cantidadCuotas : null,
        recargoFinanciacion: modalidadInfo.admiteRecargo ? (Number(condiciones.recargoFinanciacion) || 0) : 0,
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

        {avisoPedido && <Aviso tono="bien">{avisoPedido}</Aviso>}

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
              (catalogo.texto || escritura) && (
                <div className="flex flex-wrap justify-center gap-3">
                  {catalogo.texto && (
                    <Boton tono="papel" onClick={() => catalogo.escribir('')}>
                      Limpiar la busqueda
                    </Boton>
                  )}
                  {escritura && (
                    <Boton
                      onClick={() => {
                        setAvisoPedido(null)
                        setPedidoPendiente({ producto: null, descripcion: catalogo.texto.trim() })
                      }}
                    >
                      Registrar pedido pendiente
                    </Boton>
                  )}
                </div>
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
                  acciones={
                    escritura && producto.stockActual === 0 ? (
                      <Boton
                        tono="papel"
                        tamano="chico"
                        onClick={() => {
                          setAvisoPedido(null)
                          setPedidoPendiente({ producto, descripcion: '' })
                        }}
                      >
                        Registrar pedido pendiente
                      </Boton>
                    ) : undefined
                  }
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

      <DialogoPedido
        abierto={pedidoPendiente !== null}
        productoInicial={pedidoPendiente?.producto ?? null}
        descripcionInicial={pedidoPendiente?.descripcion ?? ''}
        clienteInicial={venta.cliente}
        alCerrar={() => setPedidoPendiente(null)}
        alGuardar={(nuevo) => {
          setAvisoPedido(
            `Pedido pendiente registrado para ${nuevo.cliente?.apellidoNombre ?? 'el cliente'}.`,
          )
        }}
      />
    </div>
  )
}
