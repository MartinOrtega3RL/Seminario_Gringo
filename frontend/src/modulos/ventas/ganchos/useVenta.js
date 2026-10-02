import { useCallback, useMemo, useState } from 'react'

// El total se calcula en centavos enteros y no en punto flotante: sumar
// decimales arrastra errores de redondeo que en un comprobante se ven.
const aCentavos = (valor) => Math.round(Number(valor) * 100)

export const aPesos = (centavos) =>
  (centavos / 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** RF16.5 — la clasificacion del cliente decide la lista. Sin cliente, minorista. */
export const listaDelCliente = (cliente) =>
  cliente?.tipoCliente?.listaPrecioAplicable ?? 'MINORISTA'

const precioSegunLista = (linea, lista) =>
  lista === 'MAYORISTA' ? linea.precioMayorista : linea.precioMinorista

/**
 * La venta en curso. Vive en esta pantalla y no en un estado global: nadie mas
 * la necesita, y si se navega a otro lado la venta se abandona a proposito.
 *
 * Cada renglon guarda los DOS precios del producto, no el que estaba vigente
 * al agregarlo: si despues se asocia un cliente mayorista, la venta entera
 * tiene que reflejar la lista nueva sin volver a pedirle nada al servidor.
 *
 * El precio que se muestra es informativo. El que vale es el que congela el
 * servidor al confirmar (RF16.5): aca no se decide plata.
 */
export const useVenta = () => {
  const [lineas, setLineas] = useState([])
  const [cliente, setCliente] = useState(null)

  const lista = listaDelCliente(cliente)

  const agregar = useCallback((producto) => {
    setLineas((previas) => {
      const existente = previas.find((linea) => linea.idProducto === producto.idProducto)

      // Agregar dos veces el mismo producto suma cantidad, no duplica el
      // renglon: en el mostrador se toca el mismo articulo varias veces.
      if (existente) {
        if (existente.cantidad >= existente.disponible) return previas
        return previas.map((linea) =>
          linea.idProducto === producto.idProducto
            ? { ...linea, cantidad: linea.cantidad + 1 }
            : linea,
        )
      }

      return [
        ...previas,
        {
          idProducto: producto.idProducto,
          denominacion: producto.denominacion,
          codigoInterno: producto.codigoInterno,
          precioMinorista: producto.precioMinorista,
          precioMayorista: producto.precioMayorista,
          disponible: producto.stockActual,
          cantidad: 1,
        },
      ]
    })
  }, [])

  const cambiarCantidad = useCallback((idProducto, cantidad) => {
    setLineas((previas) =>
      previas.flatMap((linea) => {
        if (linea.idProducto !== idProducto) return [linea]
        // Bajar de uno quita el renglon: es lo que el usuario quiso decir.
        if (cantidad < 1) return []
        return [{ ...linea, cantidad: Math.min(cantidad, linea.disponible) }]
      }),
    )
  }, [])

  const quitar = useCallback((idProducto) => {
    setLineas((previas) => previas.filter((linea) => linea.idProducto !== idProducto))
  }, [])

  const vaciar = useCallback(() => {
    setLineas([])
    setCliente(null)
  }, [])

  // Los renglones que se muestran ya llevan el precio de la lista vigente.
  const renglones = useMemo(
    () => lineas.map((linea) => ({ ...linea, precioUnitario: precioSegunLista(linea, lista) })),
    [lineas, lista],
  )

  const totalCentavos = useMemo(
    () => renglones.reduce((total, l) => total + aCentavos(l.precioUnitario) * l.cantidad, 0),
    [renglones],
  )

  const unidades = useMemo(() => renglones.reduce((suma, l) => suma + l.cantidad, 0), [renglones])

  return {
    lineas: renglones,
    cliente,
    setCliente,
    lista,
    agregar,
    cambiarCantidad,
    quitar,
    vaciar,
    totalCentavos,
    unidades,
  }
}
