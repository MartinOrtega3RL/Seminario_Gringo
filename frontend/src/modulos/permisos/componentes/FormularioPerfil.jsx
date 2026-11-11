import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Texto, Area } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

export const FormularioPerfil = ({ abierto, perfil, alCerrar, alGuardar }) => {
  const [nombre, setNombre] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [error, setError] = useState(null)
  const [falloNombre, setFalloNombre] = useState(null)
  const [guardando, setGuardando] = useState(false)

  const esAlta = !perfil

  useEffect(() => {
    if (!abierto) return
    setNombre(perfil?.nombre ?? '')
    setDescripcion(perfil?.descripcion ?? '')
    setError(null)
    setFalloNombre(null)
    setGuardando(false)
  }, [abierto, perfil])

  const enviar = async (evento) => {
    evento.preventDefault()
    const limpio = nombre.trim()
    if (limpio.length < 3) {
      setFalloNombre('El nombre necesita al menos 3 caracteres.')
      return
    }

    setGuardando(true)
    setError(null)

    try {
      await alGuardar({ nombre: limpio, descripcion: descripcion.trim() || null })
    } catch (fallo) {
      setError(fallo.message)
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={esAlta ? 'Nuevo perfil' : 'Editar perfil'}
      descripcion={
        esAlta
          ? 'El perfil nace sin permisos. Después los habilitás desde la matriz.'
          : 'Actualizá el nombre o la descripción del perfil.'
      }
      ancho="max-w-md"
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton form="form-perfil" type="submit" cargando={guardando}>
            {esAlta ? 'Crear perfil' : 'Guardar cambios'}
          </Boton>
        </div>
      }
    >
      <form id="form-perfil" onSubmit={enviar} noValidate className="grid gap-4">
        <Texto
          etiqueta="Nombre"
          obligatorio
          autoFocus
          value={nombre}
          onChange={(evento) => {
            setNombre(evento.target.value)
            setFalloNombre(null)
          }}
          error={falloNombre}
          maxLength={50}
          disabled={guardando || perfil?.protegido}
        />

        <Area
          etiqueta="Descripción"
          value={descripcion}
          onChange={(evento) => setDescripcion(evento.target.value)}
          maxLength={200}
          disabled={guardando}
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}

