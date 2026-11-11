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
import { IconoFoto, IconoQuitar, IconoTilde, IconoFlecha } from '../../../ui/Iconos.jsx'

// RF21.1 a RF21.8 — recepción del equipo.
//
// Es la pantalla que reemplaza la ficha de papel: "hacemos una ficha para cada
// dispositivo y para cada cliente" (H05). Y es donde se deja constancia de cómo
// llega el equipo, que es lo que respalda al comercio cuando después "sale con
// otro problema adicional" (H06).
//
// Va de a un paso por vez: con el cliente esperando enfrente, ver los cuatro
// bloques abiertos juntos confunde más de lo que ayuda. Lo ya cargado queda
// resumido arriba, con su «Cambiar», y lo que falta se ve cerrado abajo.

const IMEI_VALIDO = /^[A-Za-z0-9/-]{5,30}$/

const PASOS = ['Cliente', 'Equipo', 'Cómo llega', 'Fotos y confirmación']

/**
 * Un paso del alta. Abierto muestra su contenido; hecho, un resumen de una
 * línea y el botón para volver; pendiente, solo el título.
 */
const Paso = ({ numero, titulo, situacion, resumen, alCambiar, children }) => {
  const abierto = situacion === 'actual'

  return (
    <section
      aria-current={abierto ? 'step' : undefined}
      className={`scroll-mt-4 border-2 ${
        abierto ? 'border-crema/40 bg-azul-hondo' : 'border-crema/12'
      }`}
    >
      <div className="flex items-center gap-4 px-5 py-4">
        <span
          aria-hidden="true"
          className={`grid size-9 shrink-0 place-items-center border-2 text-sm font-bold ${
            situacion === 'hecho'
              ? 'border-crema bg-crema text-tinta'
              : abierto
                ? 'border-escarlata bg-escarlata text-crema'
                : 'border-crema/25 text-crema/45'
          }`}
        >
          {situacion === 'hecho' ? <IconoTilde className="size-5" /> : <span className="numeral">{numero}</span>}
        </span>

        <div className="min-w-0 flex-1">
          <Titulo nivel={2} className={`text-lg ${situacion === 'pendiente' ? 'text-crema/45' : 'text-crema'}`}>
            {titulo}
          </Titulo>
          {situacion === 'hecho' && resumen && (
            <p className="mt-0.5 truncate text-sm text-crema/70">{resumen}</p>
          )}
        </div>

        {situacion === 'hecho' && (
          <Boton tono="desnudo" tamano="chico" onClick={alCambiar}>
            Cambiar
          </Boton>
        )}
      </div>

      {abierto && <div className="grid gap-5 border-t-2 border-crema/12 px-5 pb-5 pt-5">{children}</div>}
    </section>
  )
}

/** Una fila del resumen final, en el papel de la ficha. */
const Linea = ({ rotulo, children }) => (
  <div className="grid gap-0.5 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4">
    <dt className="text-xs font-semibold text-tinta/60">{rotulo}</dt>
    <dd className="whitespace-pre-wrap text-sm font-semibold leading-snug text-tinta">{children}</dd>
  </div>
)

export const NuevaOrden = () => {
  const navegar = useNavigate()

  const [paso, setPaso] = useState(0)

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

  const pasos = useRef([])

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

  // Al cambiar de paso, el paso abierto queda a la vista y con el foco en su
  // primer campo: se sigue tipeando sin buscar dónde. Al entrar a la pantalla
  // no se mueve nada: el menú y el título tienen que quedar a la vista.
  const pasoMostrado = useRef(paso)
  useEffect(() => {
    if (pasoMostrado.current === paso) return
    pasoMostrado.current = paso
    const seccion = pasos.current[paso]
    if (!seccion) return
    seccion.scrollIntoView({ block: 'start', behavior: 'smooth' })
    seccion.querySelector('input:not([type=radio]):not([type=file]), select, textarea')?.focus({ preventScroll: true })
  }, [paso])

  // Si un paso no deja seguir, el foco va al primer campo marcado. Se hace
  // después de dibujar: antes, el campo todavía no figura como inválido.
  useEffect(() => {
    if (Object.keys(errores).length === 0) return
    pasos.current[paso]?.querySelector('[aria-invalid="true"]')?.focus()
  }, [errores, paso])

  const agregarFotos = (evento) => {
    const nuevas = [...evento.target.files].filter((archivo) => archivo.type.startsWith('image/'))
    setFotos((actuales) => [...actuales, ...nuevas].slice(0, 8))
    evento.target.value = ''
  }

  const nombreMarca = marcas.find((m) => String(m.idMarca) === String(idMarca))?.nombre ?? ''

  // Lo que pide cada paso para poder seguir. El último no pide nada: las fotos
  // son opcionales.
  const fallosDelPaso = (numero) => {
    const fallos = {}
    if (numero === 0 && !cliente) fallos.cliente = 'Elegí a quién pertenece el equipo, o dalo de alta.'
    if (numero === 1) {
      if (!idMarca) fallos.marca = 'Elegí la marca.'
      if (modelo.trim().length < 2) fallos.modelo = 'Escribí el modelo.'
      if (imei.trim() && !IMEI_VALIDO.test(imei.trim())) fallos.imei = 'Tiene entre 5 y 30 letras o números.'
    }
    if (numero === 2) {
      if (falla.trim().length < 3) fallos.falla = 'Anotá lo que dice el cliente que le pasa.'
      if (estadoIngreso.trim().length < 3) fallos.estadoIngreso = 'Describí cómo llega: golpes, rayones, si enciende.'
    }
    return fallos
  }

  const seguir = () => {
    const fallos = fallosDelPaso(paso)
    setErrores(fallos)
    if (Object.keys(fallos).length > 0) return
    setPaso((actual) => Math.min(actual + 1, PASOS.length - 1))
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    setError(null)

    // Enter en un paso intermedio avanza; solo el último guarda.
    if (paso < PASOS.length - 1) return seguir()

    // Por si se volvió atrás y se borró algo: se revisan todos los pasos.
    for (let numero = 0; numero < PASOS.length - 1; numero += 1) {
      const fallos = fallosDelPaso(numero)
      if (Object.keys(fallos).length > 0) {
        setErrores(fallos)
        setPaso(numero)
        return undefined
      }
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
    return undefined
  }

  const situacion = (numero) => (numero < paso ? 'hecho' : numero === paso ? 'actual' : 'pendiente')
  const volverA = (numero) => { setErrores({}); setPaso(numero) }

  const resumenCliente = cliente
    ? [cliente.persona.apellidoNombre, cliente.persona.telefonoWhatsapp ? `WhatsApp ${cliente.persona.telefonoWhatsapp}` : 'sin WhatsApp'].join(' · ')
    : ''
  const resumenEquipo = [`${nombreMarca} ${modelo.trim()}`.trim(), imei.trim() && `IMEI ${imei.trim()}`, color.trim()]
    .filter(Boolean).join(' · ')

  // Los botones de cada paso: volver y seguir, o recibir en el último.
  const pie = (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-crema/12 pt-4">
      {paso > 0
        ? <Boton tono="desnudo" onClick={() => volverA(paso - 1)} disabled={enviando}>Volver</Boton>
        : <Boton tono="desnudo" onClick={() => navegar('/servicio')} disabled={enviando}>Cancelar</Boton>}
      {paso < PASOS.length - 1 ? (
        <Boton type="submit" className="w-full sm:w-auto sm:min-w-48">
          Seguir
          <IconoFlecha className="size-4" />
        </Boton>
      ) : (
        <Boton type="submit" cargando={enviando} className="w-full sm:w-auto sm:min-w-56">
          {enviando && fotos.length > 0 ? 'Guardando fotos…' : 'Recibir el equipo'}
        </Boton>
      )}
    </div>
  )

  return (
    <form onSubmit={enviar} noValidate className="mx-auto grid max-w-3xl gap-6">
      <div>
        <Link to="/servicio" className="text-xs font-semibold uppercase tracking-wide text-crema/60 hover:text-crema">
          ← Órdenes de servicio
        </Link>
        <Encabezado
          titulo="Recibir un equipo"
          tamano="text-3xl"
          className="mt-2"
          derecha={
            <span className="text-sm text-crema/60">
              Paso <span className="numeral font-semibold text-crema">{paso + 1}</span> de {PASOS.length}
            </span>
          }
        />
      </div>

      <div className="grid gap-3">
        <div ref={(nodo) => { pasos.current[0] = nodo }}>
          <Paso numero={1} titulo={PASOS[0]} situacion={situacion(0)} resumen={resumenCliente} alCambiar={() => volverA(0)}>
            <p className="text-sm leading-relaxed text-crema/65">
              La orden es de una persona: es a quien se le avisa cuando el equipo está listo.
            </p>
            {/* Elegir al cliente ya es todo el paso: se pasa solo al siguiente. */}
            <ElegirCliente
              cliente={cliente}
              alElegir={(elegido) => { setCliente(elegido); setErrores({}); if (elegido) setPaso(1) }}
              error={errores.cliente}
              deshabilitado={enviando}
            />
            {pie}
          </Paso>
        </div>

        <div ref={(nodo) => { pasos.current[1] = nodo }}>
          <Paso numero={2} titulo={PASOS[1]} situacion={situacion(1)} resumen={resumenEquipo} alCambiar={() => volverA(1)}>
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
            {pie}
          </Paso>
        </div>

        <div ref={(nodo) => { pasos.current[2] = nodo }}>
          <Paso
            numero={3}
            titulo={PASOS[2]}
            situacion={situacion(2)}
            resumen={falla.trim()}
            alCambiar={() => volverA(2)}
          >
            <p className="text-sm leading-relaxed text-crema/65">
              Lo que se anota acá es lo que respalda al comercio si después aparece un problema que el equipo no tenía.
            </p>

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
            {pie}
          </Paso>
        </div>

        <div ref={(nodo) => { pasos.current[3] = nodo }}>
          <Paso numero={4} titulo={PASOS[3]} situacion={situacion(3)}>
            <div className="grid gap-3">
              <p className="text-sm leading-relaxed text-crema/65">
                Opcional. Una foto al ingresar vale más que cualquier descripción si después hay un reclamo.
              </p>
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
            </div>

            {/* Lo que va a quedar en la ficha, en el papel, antes de guardarla:
                se revisa con el cliente enfrente. */}
            <div className="panel grid gap-3 p-5">
              <Titulo nivel={3} className="text-base text-tinta">Así queda la orden</Titulo>
              <dl className="grid gap-2.5">
                <Linea rotulo="Cliente">{resumenCliente}</Linea>
                <Linea rotulo="Equipo">{resumenEquipo}</Linea>
                <Linea rotulo="Falla declarada">{falla.trim()}</Linea>
                <Linea rotulo="Cómo llega">{estadoIngreso.trim()}</Linea>
                <Linea rotulo="Accesorios">{accesorios.trim() || 'Ninguno'}</Linea>
                <Linea rotulo="Sellos">{SELLOS[sellos]}</Linea>
                {vincular && consulta?.garantia?.vigente && (
                  <Linea rotulo="Garantía">
                    Reingreso por garantía de {consulta.ordenConGarantia.numeroOrden}
                  </Linea>
                )}
              </dl>
            </div>

            {error && <Aviso tono="mal">{error}</Aviso>}
            {pie}
          </Paso>
        </div>
      </div>
    </form>
  )
}
