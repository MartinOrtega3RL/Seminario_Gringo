import { useCallback, useEffect, useRef, useState } from 'react'

const VACIO = { datos: [], paginacion: { pagina: 1, tamano: 25, total: 0, totalPaginas: 1 } }

/**
 * Listado paginado con busqueda por texto. Lo usan catalogo, clientes,
 * usuarios, movimientos y ventas: escribir el antirrebote y el descarte de
 * respuestas viejas una vez por pantalla es como terminan distintos entre si.
 *
 * Dos cosas que resuelve y que no se ven hasta que fallan:
 *
 *  - Antirrebote de 250 ms desde la ultima tecla. Sin esto, tipear "funda"
 *    dispara cinco consultas.
 *  - Descarte por orden de llegada. Si la respuesta de "fun" llega despues de
 *    la de "funda", el listado mostraria el resultado de una busqueda que el
 *    usuario ya abandono.
 *
 * @param {(params: object) => Promise<object>} consultar  funcion del modulo api
 * @param {object} opciones  tamano de pagina y filtros fijos
 */
export const useListadoPaginado = (consultar, { tamano = 25, filtros = {} } = {}) => {
  const [texto, setTexto] = useState('')
  const [pagina, setPagina] = useState(1)
  const [resultado, setResultado] = useState(VACIO)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)

  const peticion = useRef(0)
  // Los filtros llegan como objeto nuevo en cada render; se compara su
  // contenido y no su identidad, o el efecto se dispararia sin parar.
  const filtrosSerializados = JSON.stringify(filtros)

  const buscar = useCallback(async () => {
    const propia = ++peticion.current
    setCargando(true)
    setError(null)

    try {
      const respuesta = await consultar({
        texto: texto.trim() || undefined,
        pagina,
        tamano,
        ...JSON.parse(filtrosSerializados),
      })
      if (propia !== peticion.current) return
      setResultado(respuesta ?? VACIO)
    } catch (fallo) {
      if (propia !== peticion.current) return
      setError(fallo)
      setResultado(VACIO)
    } finally {
      if (propia === peticion.current) setCargando(false)
    }
  }, [consultar, texto, pagina, tamano, filtrosSerializados])

  useEffect(() => {
    const reloj = setTimeout(buscar, texto ? 250 : 0)
    return () => clearTimeout(reloj)
  }, [buscar, texto])

  // Cambiar el texto o un filtro vuelve a la primera pagina: quedarse en la
  // cuatro de una busqueda nueva es como no tener resultados.
  const escribir = useCallback((valor) => {
    setTexto(valor)
    setPagina(1)
  }, [])

  useEffect(() => setPagina(1), [filtrosSerializados])

  return {
    texto,
    escribir,
    pagina,
    setPagina,
    datos: resultado.datos,
    paginacion: resultado.paginacion,
    cargando,
    error,
    recargar: buscar,
  }
}
