import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { recepcionarEquipo, consultarDispositivo, subirFoto } from '../servicio.api.js'
import { listarMarcas, listarModelos } from '../../catalogo/catalogo.api.js'
import { SELLOS } from '../servicio.reglas.js'
import { ElegirCliente } from '../componentes/ElegirCliente.jsx'
import { ConsultaEquipo } from '../componentes/ConsultaEquipo.jsx'
import { Encabezado, Titulo } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Select, Texto, Area, Par } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { IconoFoto, IconoQuitar } from '../../../ui/Iconos.jsx'

// RF21.1 a RF21.8 — recepción del equipo.
//
// Es la pantalla que reemplaza la ficha de papel: "hacemos una ficha para cada
// dispositivo y para cada cliente" (H05). Y es donde se deja constancia de cómo
// llega el equipo, que es lo que respalda al comercio cuando después "sale con
// otro problema adicional" (H06).

const IMEI_VALIDO = /^[A-Za-z0-9/-]{5,30}$/

const Seccion = ({ numero, titulo, ayuda, children }) => (
  <section className="grid gap-4">
    <div className="border-b-2 border-crema/15 pb-2">
      <Titulo nivel={2} className="text-lg">
        <span className="numeral me-2 text-escarlata">{numero}</span>
        {titulo}
      </Titulo>
      {ayuda && <p className="mt-1.5 text-sm leading-relaxed text-crema/60">{ayuda}</p>}
    </div>
    {children}
  </section>
)

export const NuevaOrden = () => {
  const navegar = useNavigate()

  const [cliente, setCliente] = useState(null)
  const [marcas, setMarcas] = useState([])
  const [idMarca, setIdMarca] = useState('')
  const [modelo, setModelo] = useState('')
  const [sugeridos, setSugeridos] = useState([])
  const [imei, setImei] = useState('')
  const [color, setColor] = useState('')
  const [falla, setFalla] = useState('')
  const [estadoIngreso, setEstadoIngreso] = useState('')
  const [accesorios, setAccesorios] = useState('')
  const [sellos, setSellos] = useState('SIN_SELLO')
  const [fotos, setFotos] = useState([])

  const [consulta, setConsulta] = useState(null)
  const [vincular, setVincular] = useState(false)

  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  const selector = useRef(null)

  useEffect(() => {
    listarMarcas().then(({ datos }) => setMarcas(datos)).catch(() => setMarcas([]))
  }, [])

  // Sugerencias de modelo, a medida que se tipea. El catalogo de modelos es el
  // mismo que usa la compatibilidad de los repuestos (RF06.8): un modelo se da de
  // alta una vez y despues se reutiliza.
  useEffect(() => {
    const reloj = setTimeout(async () => {
      try {
        const { datos } = await listarModelos(modelo.trim() || undefined)
        setSugeridos(datos)
      } catch {
        setSugeridos([])
      }
    }, 250)
    return () => clearTimeout(reloj)
  }, [modelo])

  // RF24.2 — apenas hay un IMEI se consulta si el equipo ya estuvo. Se vuelve a
  // consultar si cambian los sellos: con los sellos rotos, la garantia se anula.
  useEffect(() => {
    const limpio = imei.trim()
    if (!IMEI_VALIDO.test(limpio)) {
      setConsulta(null)
      setVincular(false)
      return undefined
    }

    let vigente = true
    const reloj = setTimeout(async () => {
      try {
        const { datos } = await consultarDispositivo({ imei: limpio, sellos })
        if (!vigente) return
        setConsulta(datos)

        // Un equipo conocido completa marca y modelo: no se tipean dos veces.
        if (datos.dispositivo && !idMarca && !modelo) {
          setIdMarca(String(datos.dispositivo.modelo.idMarca))
          setModelo(datos.dispositivo.modelo.denominacion)
        }
        if (!datos.garantia?.vigente) setVincular(false)
      } catch {
        if (vigente) setConsulta(null)
      }
    }, 450)

    return () => {
      vigente = false
      clearTimeout(reloj)
    }
    // idMarca y modelo se leen para no pisar lo que ya se cargo, pero no deben
    // volver a disparar la consulta cada vez que se tipea una letra del modelo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imei, sellos])

  const modeloExistente = useMemo(
    () => sugeridos.find((m) =>
      String(m.idMarca) === String(idMarca) && m.denominacion.toLowerCase() === modelo.trim().toLowerCase()),
    [sugeridos, idMarca, modelo],
  )

  // Las vistas previas son URLs de objeto: se sueltan al sacar la foto o al salir.
  const previas = useMemo(() => fotos.map((archivo) => URL.createObjectURL(archivo)), [fotos])
  useEffect(() => () => previas.forEach((url) => URL.revokeObjectURL(url)), [previas])

  const agregarFotos = (evento) => {
    const nuevas = [...evento.target.files].filter((archivo) => archivo.type.startsWith('image/'))
    setFotos((actuales) => [...actuales, ...nuevas].slice(0, 8))
    evento.target.value = ''
  }

  const validar = () => {
    const fallos = {}
    if (!cliente) fallos.cliente = 'Elegí a quién pertenece el equipo, o dalo de alta.'
    if (!idMarca) fallos.marca = 'Elegí la marca.'
    if (modelo.trim().length < 2) fallos.modelo = 'Escribí el modelo.'
    if (imei.trim() && !IMEI_VALIDO.test(imei.trim())) {
      fallos.imei = 'Tiene entre 5 y 30 letras o números.'
    }
    if (falla.trim().length < 3) fallos.falla = 'Anotá lo que dice el cliente que le pasa.'
    if (estadoIngreso.trim().length < 3) fallos.estadoIngreso = 'Describí cómo llega: golpes, rayones, si enciende.'

    setErrores(fallos)
    return fallos
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    setError(null)

    const fallos = validar()
    if (Object.keys(fallos).length > 0) {
      // Llevar al primer error: en una pantalla larga, un error fuera de vista
      // es un boton que "no hace nada".
      const primero = document.querySelector('[aria-invalid="true"]') ?? selector.current
      primero?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return
    }

    setEnviando(true)
    try {
      const { datos: orden } = await recepcionarEquipo({
        idCliente: cliente.idCliente,
        dispositivo: {
          ...(modeloExistente
            ? { idModelo: modeloExistente.idModelo }
            : { nuevoModelo: { idMarca: Number(idMarca), denominacion: modelo.trim() } }),
          imeiSerie: imei.trim() || null,
          color: color.trim() || null,
        },
        fallaDeclarada: falla.trim(),
        estadoIngreso: estadoIngreso.trim(),
        accesoriosRecibidos: accesorios.trim() || null,
        estadoSellos: sellos,
        idOrdenAnterior: vincular && consulta?.garantia?.vigente ? consulta.ordenConGarantia.idOrden : null,
      })

      // RF21.7 — las fotos van despues: la orden tiene que existir para
      // colgarles archivos. Si una falla, la orden NO se pierde: ya esta
      // creada y el cliente ya esta adelante. Se avisa en la ficha.
      let fotosFallidas = 0
      for (const archivo of fotos) {
        try {
          await subirFoto(orden.idOrden, archivo, { momento: 'INGRESO' })
        } catch {
          fotosFallidas += 1
        }
      }

      navegar(`/servicio/${orden.idOrden}`, { state: { recien: true, fotosFallidas } })
    } catch (fallo) {
      setError(fallo.message)
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} noValidate className="mx-auto grid max-w-3xl gap-8">
      <div>
        <Link to="/servicio" className="text-xs font-semibold uppercase tracking-wide text-crema/60 hover:text-crema">
          ← Órdenes de servicio
        </Link>
        <Encabezado titulo="Recibir un equipo" tamano="text-3xl" className="mt-2" />
      </div>

      <Seccion
        numero="1"
        titulo="Cliente"
        ayuda="La orden es de una persona: es a quien se le avisa cuando el equipo está listo."
      >
        <div ref={selector}>
          <ElegirCliente cliente={cliente} alElegir={setCliente} error={errores.cliente} deshabilitado={enviando} />
        </div>
      </Seccion>

      <Seccion numero="2" titulo="Equipo">
        <Par>
          <Select
            etiqueta="Marca"
            obligatorio
            value={idMarca}
            onChange={(evento) => { setIdMarca(evento.target.value); setErrores((e) => ({ ...e, marca: undefined })) }}
            error={errores.marca}
            vacio="Elegir…"
            disabled={enviando}
            opciones={marcas.map((m) => ({ valor: String(m.idMarca), texto: m.nombre }))}
          />

          <div>
            <Texto
              etiqueta="Modelo"
              obligatorio
              list="modelos-sugeridos"
              autoComplete="off"
              value={modelo}
              onChange={(evento) => { setModelo(evento.target.value); setErrores((e) => ({ ...e, modelo: undefined })) }}
              error={errores.modelo}
              maxLength={80}
              placeholder="iPhone 13, Galaxy A54…"
              disabled={enviando}
            />
            <datalist id="modelos-sugeridos">
              {sugeridos
                .filter((m) => !idMarca || String(m.idMarca) === String(idMarca))
                .map((m) => <option key={m.idModelo} value={m.denominacion} />)}
            </datalist>
            {modelo.trim().length >= 2 && idMarca && !modeloExistente && (
              <p className="mt-1.5 text-xs text-crema/60">
                Es un modelo nuevo: se agrega al catálogo junto con la orden.
              </p>
            )}
          </div>
        </Par>

        <Par>
          <Texto
            etiqueta="IMEI o número de serie"
            value={imei}
            onChange={(evento) => { setImei(evento.target.value); setErrores((e) => ({ ...e, imei: undefined })) }}
            error={errores.imei}
            maxLength={30}
            inputMode="numeric"
            disabled={enviando}
            ayuda="Se marca con *#06#. Si el equipo no enciende, se puede dejar vacío."
          />
          <Texto etiqueta="Color" value={color} onChange={(e) => setColor(e.target.value)} maxLength={30} disabled={enviando} />
        </Par>

        <ConsultaEquipo consulta={consulta} vincular={vincular} alVincular={setVincular} />
      </Seccion>

      <Seccion
        numero="3"
        titulo="Cómo llega"
        ayuda="Lo que se anota acá es lo que respalda al comercio si después aparece un problema que el equipo no tenía."
      >
        <Area
          etiqueta="Falla declarada por el cliente"
          obligatorio
          filas={2}
          value={falla}
          onChange={(evento) => { setFalla(evento.target.value); setErrores((e) => ({ ...e, falla: undefined })) }}
          error={errores.falla}
          maxLength={2000}
          disabled={enviando}
          placeholder="No carga, se apaga sola, se le rompió la pantalla…"
        />

        <Area
          etiqueta="Estado físico y funcional al ingresar"
          obligatorio
          filas={3}
          value={estadoIngreso}
          onChange={(evento) => { setEstadoIngreso(evento.target.value); setErrores((e) => ({ ...e, estadoIngreso: undefined })) }}
          error={errores.estadoIngreso}
          maxLength={2000}
          disabled={enviando}
          placeholder="Rayón en la tapa, marco abollado, enciende y se ve la imagen…"
        />

        <Texto
          etiqueta="Accesorios que deja"
          value={accesorios}
          onChange={(evento) => setAccesorios(evento.target.value)}
          maxLength={300}
          disabled={enviando}
          placeholder="Funda, cargador, chip…"
        />

        {/* RF21.8 — lo que anula la garantía es el estado del sello al volver,
            no el hecho de haberlo mirado. */}
        <fieldset disabled={enviando}>
          <legend className="mb-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-crema/75">
            Sellos del comercio
          </legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(SELLOS).map(([valor, texto]) => (
              <label
                key={valor}
                className={`flex cursor-pointer items-center gap-2 border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                  sellos === valor
                    ? valor === 'VIOLADOS'
                      ? 'border-escarlata bg-escarlata/15 text-crema'
                      : 'border-crema bg-crema/10 text-crema'
                    : 'border-crema/25 text-crema/65 hover:border-crema/55'
                }`}
              >
                <input
                  type="radio"
                  name="sellos"
                  value={valor}
                  checked={sellos === valor}
                  onChange={() => setSellos(valor)}
                  className="size-4 accent-escarlata"
                />
                {texto}
              </label>
            ))}
          </div>
          {sellos === 'VIOLADOS' && (
            <p className="mt-2 text-xs leading-relaxed text-ambar">
              Con los sellos rotos o cortados, la ficha anula la garantía de una reparación anterior.
            </p>
          )}
        </fieldset>
      </Seccion>

      <Seccion
        numero="4"
        titulo="Fotos del equipo"
        ayuda="Opcional. Una foto al ingresar vale más que cualquier descripción si después hay un reclamo."
      >
        <div className="flex flex-wrap items-start gap-3">
          {fotos.map((archivo, indice) => (
            <figure key={`${archivo.name}-${indice}`} className="relative size-24 overflow-hidden border-2 border-crema/30">
              <img src={previas[indice]} alt={`Foto ${indice + 1}: ${archivo.name}`} className="size-full object-cover" />
              <button
                type="button"
                onClick={() => setFotos((actuales) => actuales.filter((_, i) => i !== indice))}
                disabled={enviando}
                aria-label={`Sacar la foto ${archivo.name}`}
                className="absolute right-0.5 top-0.5 grid size-6 place-items-center border-2 border-tinta bg-crema text-tinta hover:bg-escarlata hover:text-crema"
              >
                <IconoQuitar className="size-3.5" />
              </button>
            </figure>
          ))}

          {fotos.length < 8 && (
            <label className="grid size-24 cursor-pointer place-items-center border-2 border-dashed border-crema/35 text-center text-xs font-semibold uppercase tracking-wide text-crema/65 hover:border-crema hover:text-crema">
              <span>
                <IconoFoto className="mx-auto mb-1 size-6" />
                Agregar
              </span>
              <input type="file" accept="image/*" multiple onChange={agregarFotos} disabled={enviando} className="sr-only" />
            </label>
          )}
        </div>
      </Seccion>

      {error && <Aviso tono="mal">{error}</Aviso>}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t-2 border-crema/15 pt-5">
        <Boton tono="desnudo" onClick={() => navegar('/servicio')} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton type="submit" cargando={enviando} className="min-w-56">
          {enviando && fotos.length > 0 ? 'Guardando fotos…' : 'Recibir el equipo'}
        </Boton>
      </div>
    </form>
  )
}
