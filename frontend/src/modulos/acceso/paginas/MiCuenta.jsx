import { useState } from 'react'
import { cambiarContrasenaPropia } from '../acceso.api.js'
import { useSesion } from '../../../app/sesion.jsx'
import { Encabezado, Panel, Titulo, Filete } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'
import { Marca } from '../../../ui/Listado.jsx'

// RF01.3 — el usuario cambia su propia contraseña. Nadie más puede cambiarla:
// ni siquiera el Administrador, porque quien puede fijar la clave de otro puede
// después operar a su nombre sin que el historial lo distinga.

const VACIO = { contrasenaActual: '', contrasenaNueva: '', repetida: '' }

export const MiCuenta = () => {
  const { usuario, modulos } = useSesion()

  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [listo, setListo] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const cambiar = (clave) => (evento) => {
    setDatos((previos) => ({ ...previos, [clave]: evento.target.value }))
    setErrores((previos) => ({ ...previos, [clave]: undefined }))
    setListo(false)
  }

  const validar = () => {
    const fallos = {}
    if (!datos.contrasenaActual) fallos.contrasenaActual = 'Escribí tu contraseña actual.'
    if (datos.contrasenaNueva.length < 8) fallos.contrasenaNueva = 'Al menos 8 caracteres.'
    if (datos.contrasenaNueva === datos.contrasenaActual && datos.contrasenaNueva) {
      fallos.contrasenaNueva = 'Tiene que ser distinta de la actual.'
    }
    if (datos.contrasenaNueva !== datos.repetida) fallos.repetida = 'No coinciden.'

    setErrores(fallos)
    return Object.keys(fallos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!validar()) return

    setGuardando(true)
    setError(null)

    try {
      await cambiarContrasenaPropia({
        contrasenaActual: datos.contrasenaActual,
        contrasenaNueva: datos.contrasenaNueva,
      })
      setDatos(VACIO)
      setListo(true)
    } catch (fallo) {
      setError(fallo.message)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-6">
      <Encabezado titulo="Mi cuenta" tamano="text-3xl" />

      <Panel className="p-5">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-tinta/55">
          Sesión iniciada como
        </p>
        <p className="mt-1 font-[family-name:var(--font-cartel)] text-2xl uppercase leading-none tracking-tight text-tinta">
          {usuario.apellidoNombre}
        </p>
        <p className="numeral mt-1.5 text-sm text-tinta/70">
          {usuario.nombreUsuario} · perfil {usuario.perfil}
        </p>

        <div className="mt-4 border-t-2 border-dashed border-tinta/25 pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-tinta/55">
            Módulos habilitados
          </p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {modulos.map((modulo) => (
              <li
                key={modulo.modulo}
                className="border border-tinta/35 px-1.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-tinta/75"
              >
                {modulo.nombre}
                {modulo.escritura && <span className="ms-1 text-escarlata">·</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs leading-relaxed text-tinta/55">
            El punto rojo marca los módulos donde además podés modificar, no solo consultar.
          </p>
        </div>
      </Panel>

      <section>
        <Titulo nivel={2} className="text-xl">
          Cambiar mi contraseña
        </Titulo>
        <Filete className="mt-2 mb-4" />

        <form onSubmit={enviar} noValidate className="grid max-w-md gap-4">
          <Texto
            etiqueta="Contraseña actual"
            obligatorio
            type="password"
            autoComplete="current-password"
            value={datos.contrasenaActual}
            onChange={cambiar('contrasenaActual')}
            error={errores.contrasenaActual}
          />

          <Texto
            etiqueta="Contraseña nueva"
            obligatorio
            type="password"
            autoComplete="new-password"
            value={datos.contrasenaNueva}
            onChange={cambiar('contrasenaNueva')}
            error={errores.contrasenaNueva}
          />

          <Texto
            etiqueta="Repetir la nueva"
            obligatorio
            type="password"
            autoComplete="new-password"
            value={datos.repetida}
            onChange={cambiar('repetida')}
            error={errores.repetida}
          />

          {/* Cambiar la contraseña cierra las demás sesiones abiertas: si
              alguien la tenía comprometida, pierde el acceso en ese momento. */}
          <p className="text-xs leading-relaxed text-crema/60">
            Al cambiarla se cierran las otras sesiones abiertas con tu usuario. Esta no.
          </p>

          {error && <Aviso tono="mal">{error}</Aviso>}
          {listo && <Aviso>Listo. Tu contraseña quedó cambiada.</Aviso>}

          <Boton
            type="submit"
            cargando={guardando}
            disabled={!datos.contrasenaActual || !datos.contrasenaNueva}
            className="justify-self-start"
          >
            Cambiar contraseña
          </Boton>
        </form>
      </section>
    </div>
  )
}
