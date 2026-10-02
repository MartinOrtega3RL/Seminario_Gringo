import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { useSesion } from '../../../app/sesion.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Campo } from '../../../ui/Campo.jsx'
import { Filete } from '../../../ui/Panel.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

export const Ingreso = () => {
  const { usuario, rehidratando, ingresar } = useSesion()
  const navegar = useNavigate()

  const [nombreUsuario, setNombreUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [error, setError] = useState(null)
  const [enviando, setEnviando] = useState(false)

  if (usuario && !rehidratando) return <Navigate to="/venta" replace />

  const enviar = async (evento) => {
    evento.preventDefault()
    setError(null)
    setEnviando(true)

    try {
      await ingresar({ nombreUsuario: nombreUsuario.trim(), contrasena })
      navegar('/venta', { replace: true })
    } catch (fallo) {
      setError(fallo.message)
      setContrasena('')
      setEnviando(false)
    }
  }

  return (
    <div className="grid min-h-dvh place-items-center bg-azul px-4 py-10">
      <div className="w-full max-w-sm">
        {/* El nombre del comercio como cartel de chapa. No hay logotipo y no
            se inventa uno: la identidad se resuelve con letra. */}
        <div className="mb-8 -rotate-1 border-[3px] border-tinta bg-ambar px-5 py-4 shadow-[6px_6px_0_var(--color-azul-hondo)]">
          <p className="font-[family-name:var(--font-cartel)] text-3xl uppercase leading-[0.9] tracking-tight text-tinta">
            El Gringo
            <span className="mt-1 block text-[0.62em] text-escarlata">Celulares</span>
          </p>
          <Filete className="mt-3" />
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-tinta/70">
            Sistema de gestion · Formosa
          </p>
        </div>

        <form onSubmit={enviar} noValidate className="grid gap-4">
          <Campo
            etiqueta="Usuario"
            name="usuario"
            autoComplete="username"
            autoFocus
            required
            value={nombreUsuario}
            onChange={(evento) => setNombreUsuario(evento.target.value)}
            disabled={enviando}
          />

          <Campo
            etiqueta="Contrasena"
            name="contrasena"
            type="password"
            autoComplete="current-password"
            required
            value={contrasena}
            onChange={(evento) => setContrasena(evento.target.value)}
            disabled={enviando}
          />

          {error && <Aviso tono="mal">{error}</Aviso>}

          <Boton
            type="submit"
            tamano="cartel"
            cargando={enviando}
            disabled={!nombreUsuario.trim() || !contrasena}
            className="mt-2"
          >
            {enviando ? 'Entrando' : 'Entrar'}
          </Boton>
        </form>
      </div>
    </div>
  )
}
