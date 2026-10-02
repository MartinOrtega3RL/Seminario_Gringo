import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Select, Texto, Par } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

// RF02.1, RF02.2 y RF02.4 — alta, modificación y asignación de perfil.
//
// La contraseña solo se pide en el alta. Editar un usuario no muestra ni
// permite cambiar la contraseña ajena: el hash no vuelve nunca del servidor, y
// un administrador que puede fijar la clave de otro puede después operar a su
// nombre sin que el historial lo distinga.

const VACIO = { apellidoNombre: '', nombreUsuario: '', contrasena: '', repetida: '', idPerfil: '' }

export const FormularioUsuario = ({ abierto, usuario, perfiles, alCerrar, alGuardar }) => {
  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const esAlta = !usuario

  useEffect(() => {
    if (!abierto) return
    setDatos(
      usuario
        ? {
            ...VACIO,
            apellidoNombre: usuario.persona?.apellidoNombre ?? '',
            nombreUsuario: usuario.nombreUsuario ?? '',
            idPerfil: String(usuario.idPerfil ?? ''),
          }
        : { ...VACIO, idPerfil: String(perfiles[0]?.idPerfil ?? '') },
    )
    setErrores({})
    setError(null)
  }, [abierto, usuario, perfiles])

  const cambiar = (clave) => (evento) => {
    setDatos((previos) => ({ ...previos, [clave]: evento.target.value }))
    setErrores((previos) => ({ ...previos, [clave]: undefined }))
  }

  const validar = () => {
    const fallos = {}
    if (datos.apellidoNombre.trim().length < 2) fallos.apellidoNombre = 'Cargá el nombre.'
    if (!/^[a-zA-Z0-9._-]{3,50}$/.test(datos.nombreUsuario.trim())) {
      fallos.nombreUsuario = 'Entre 3 y 50 caracteres, sin espacios ni acentos.'
    }
    if (!datos.idPerfil) fallos.idPerfil = 'Asigná un perfil.'

    if (esAlta) {
      if (datos.contrasena.length < 8) fallos.contrasena = 'Al menos 8 caracteres.'
      if (datos.contrasena !== datos.repetida) fallos.repetida = 'Las contraseñas no coinciden.'
    }

    setErrores(fallos)
    return Object.keys(fallos).length === 0
  }

  const enviar = async (evento) => {
    evento.preventDefault()
    if (!validar()) return

    setGuardando(true)
    setError(null)
    try {
      await alGuardar({
        apellidoNombre: datos.apellidoNombre.trim(),
        nombreUsuario: datos.nombreUsuario.trim(),
        idPerfil: Number(datos.idPerfil),
        ...(esAlta ? { contrasena: datos.contrasena } : {}),
      })
    } catch (fallo) {
      setError(fallo.message)
      setGuardando(false)
    }
  }

  const perfilElegido = perfiles.find((p) => String(p.idPerfil) === datos.idPerfil)

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={esAlta ? 'Nuevo usuario' : 'Editar usuario'}
      descripcion={
        esAlta
          ? 'El usuario elige su propia contraseña la primera vez que entra, cambiándola desde su cuenta.'
          : 'La contraseña no se edita desde acá: solo la cambia su dueño.'
      }
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton form="form-usuario" type="submit" cargando={guardando}>
            {esAlta ? 'Dar de alta' : 'Guardar cambios'}
          </Boton>
        </div>
      }
    >
      <form id="form-usuario" onSubmit={enviar} noValidate className="grid gap-4">
        <Texto
          etiqueta="Apellido y nombre"
          obligatorio
          autoFocus
          value={datos.apellidoNombre}
          onChange={cambiar('apellidoNombre')}
          error={errores.apellidoNombre}
          maxLength={150}
        />

        <Par>
          <Texto
            etiqueta="Nombre de usuario"
            obligatorio
            value={datos.nombreUsuario}
            onChange={cambiar('nombreUsuario')}
            error={errores.nombreUsuario}
            autoComplete="off"
            maxLength={50}
            ayuda="Con el que inicia sesión."
          />

          {/* RF02.4 — el perfil decide a qué módulos entra. */}
          <Select
            etiqueta="Perfil"
            obligatorio
            value={datos.idPerfil}
            onChange={cambiar('idPerfil')}
            error={errores.idPerfil}
            vacio="Elegir…"
            opciones={perfiles.map((p) => ({ valor: String(p.idPerfil), texto: p.nombre }))}
          />
        </Par>

        {perfilElegido?.descripcion && (
          <p className="-mt-2 border-l-2 border-ambar ps-3 text-xs leading-relaxed text-crema/65">
            {perfilElegido.descripcion}
          </p>
        )}

        {esAlta && (
          <Par>
            <Texto
              etiqueta="Contraseña inicial"
              obligatorio
              type="password"
              autoComplete="new-password"
              value={datos.contrasena}
              onChange={cambiar('contrasena')}
              error={errores.contrasena}
            />
            <Texto
              etiqueta="Repetir"
              obligatorio
              type="password"
              autoComplete="new-password"
              value={datos.repetida}
              onChange={cambiar('repetida')}
              error={errores.repetida}
            />
          </Par>
        )}

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
