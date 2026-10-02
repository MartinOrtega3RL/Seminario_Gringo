import { useEffect, useState } from 'react'
import { useListadoPaginado } from '../../../ganchos/useListadoPaginado.js'
import {
  listarUsuarios, listarPerfiles, registrarUsuario, modificarUsuario, darDeBajaUsuario,
} from '../acceso.api.js'
import { FormularioUsuario } from '../componentes/FormularioUsuario.jsx'
import { Paginacion } from '../../catalogo/componentes/Paginacion.jsx'
import { Encabezado } from '../../../ui/Panel.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Listado, Fila, AccionFila, Marca } from '../../../ui/Listado.jsx'
import { Cargando, Vacio, Fallo } from '../../../ui/Estados.jsx'
import { Confirmar } from '../../../ui/Dialogo.jsx'
import { IconoMas, IconoEditar, IconoQuitar } from '../../../ui/Iconos.jsx'
import { useSesion } from '../../../app/sesion.jsx'

// RF02 — administración de usuarios. Módulo exclusivo del Administrador.

export const Usuarios = () => {
  const { usuario: propio, puedeEscribir } = useSesion()
  const escritura = puedeEscribir('ADMIN_SEGURIDAD')

  const listado = useListadoPaginado(listarUsuarios, { tamano: 20 })
  const [perfiles, setPerfiles] = useState([])
  const [editando, setEditando] = useState(null)
  const [borrando, setBorrando] = useState(null)
  const [trabajando, setTrabajando] = useState(false)
  // La baja es logica: el usuario sigue en la nomina, atenuado y con su marca,
  // porque sus ventas y movimientos quedan a su nombre. Este filtro deja
  // esconderlos, que es lo que se espera al mirar "quien puede entrar hoy".
  const [verDeBaja, setVerDeBaja] = useState(true)

  useEffect(() => {
    listarPerfiles()
      .then(({ datos }) => setPerfiles(datos))
      .catch(() => setPerfiles([]))
  }, [])

  const guardar = async (datos) => {
    if (editando === 'nuevo') await registrarUsuario(datos)
    else await modificarUsuario(editando.idUsuario, datos)

    setEditando(null)
    listado.recargar()
  }

  const confirmarBaja = async () => {
    setTrabajando(true)
    try {
      await darDeBajaUsuario(borrando.idUsuario)
      setBorrando(null)
      listado.recargar()
    } finally {
      setTrabajando(false)
    }
  }

  const { datos: todos, paginacion, cargando, error } = listado
  const usuarios = verDeBaja ? todos : todos.filter((u) => u.activo)
  const cuantosDeBaja = todos.filter((u) => !u.activo).length

  return (
    <div className="grid gap-5">
      <Encabezado
        titulo="Usuarios"
        tamano="text-3xl"
        derecha={
          escritura && (
            <Boton onClick={() => setEditando('nuevo')}>
              <IconoMas />
              Nuevo usuario
            </Boton>
          )
        }
      />

      {cuantosDeBaja > 0 && (
        <label className="inline-flex h-10 w-fit cursor-pointer items-center gap-2 rounded-[3px] border-2 border-crema/30 px-3 text-sm font-semibold text-crema/80 hover:border-crema/60 has-checked:border-escarlata has-checked:bg-escarlata/15 has-checked:text-crema">
          <input
            type="checkbox"
            checked={verDeBaja}
            onChange={(evento) => setVerDeBaja(evento.target.checked)}
            className="size-4 accent-escarlata"
          />
          Mostrar los {cuantosDeBaja} dados de baja
        </label>
      )}

      {error && <Fallo error={error} reintentar={listado.recargar} />}

      {!error && cargando && usuarios.length === 0 && <Cargando filas={4} etiqueta="Cargando usuarios" />}

      {!error && !cargando && usuarios.length === 0 && (
        <Vacio titulo="No hay usuarios" detalle="Algo anda mal: al menos tu propio usuario debería aparecer acá." />
      )}

      {usuarios.length > 0 && (
        <>
          <Listado className={cargando ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
            {usuarios.map((fila) => {
              const esPropio = fila.idUsuario === propio.idUsuario

              return (
                <Fila
                  key={fila.idUsuario}
                  atenuado={!fila.activo}
                  principal={
                    <>
                      {fila.persona?.apellidoNombre}
                      {esPropio && (
                        <span className="ms-2 text-[11px] font-normal uppercase tracking-wider text-ambar">
                          vos
                        </span>
                      )}
                    </>
                  }
                  secundario={fila.nombreUsuario}
                  derecha={
                    <span className="flex items-center gap-2">
                      {!fila.activo && <Marca>De baja</Marca>}
                      <Marca tono={fila.perfil?.nombre === 'Administrador' ? 'destacado' : 'neutro'}>
                        {fila.perfil?.nombre}
                      </Marca>
                    </span>
                  }
                  alAbrir={escritura ? () => setEditando(fila) : undefined}
                  acciones={
                    escritura && (
                      <>
                        <AccionFila etiqueta="Editar" onClick={() => setEditando(fila)}>
                          <IconoEditar className="size-4" />
                        </AccionFila>
                        <AccionFila
                          etiqueta={esPropio ? 'No podés darte de baja a vos mismo' : 'Dar de baja'}
                          peligrosa
                          // Darse de baja a uno mismo deja el sistema sin
                          // administrador si es el único: la interfaz lo impide
                          // y el servidor tiene que impedirlo también.
                          disabled={esPropio}
                          onClick={() => setBorrando(fila)}
                        >
                          <IconoQuitar className="size-4" />
                        </AccionFila>
                      </>
                    )
                  }
                />
              )
            })}
          </Listado>

          <Paginacion paginacion={paginacion} alCambiar={listado.setPagina} />
        </>
      )}

      <FormularioUsuario
        abierto={editando !== null}
        usuario={editando === 'nuevo' ? null : editando}
        perfiles={perfiles}
        alCerrar={() => setEditando(null)}
        alGuardar={guardar}
      />

      <Confirmar
        abierto={borrando !== null}
        alCerrar={() => setBorrando(null)}
        alConfirmar={confirmarBaja}
        trabajando={trabajando}
        titulo="Dar de baja el usuario"
        detalle={`${borrando?.persona?.apellidoNombre ?? ''} no va a poder iniciar sesión, pero las ventas y los movimientos que registró se conservan a su nombre.`}
        textoAccion="Dar de baja"
      />
    </div>
  )
}
