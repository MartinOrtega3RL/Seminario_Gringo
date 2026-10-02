import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Select, Texto, Area, Par } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

// RF13.1, RF13.2, RF13.5 y RF13.6 — alta, modificacion, clasificacion y datos
// de contacto. Un solo formulario para los dos casos: el alta y la edicion
// piden exactamente lo mismo, y duplicarlos es como terminan distintos.

const TIPOS_DOCUMENTO = ['DNI', 'CUIT', 'CUIL', 'PASAPORTE', 'OTRO'].map((valor) => ({
  valor,
  texto: valor,
}))

const VACIO = {
  apellidoNombre: '',
  tipoPersona: 'FISICA',
  tipoDocumento: '',
  numeroDocumento: '',
  telefonoWhatsapp: '',
  correo: '',
  domicilio: '',
  idTipoCliente: '',
  observaciones: '',
}

const desdeCliente = (cliente) => ({
  apellidoNombre: cliente.persona.apellidoNombre ?? '',
  tipoPersona: cliente.persona.tipoPersona ?? 'FISICA',
  tipoDocumento: cliente.persona.tipoDocumento ?? '',
  numeroDocumento: cliente.persona.numeroDocumento ?? '',
  telefonoWhatsapp: cliente.persona.telefonoWhatsapp ?? '',
  correo: cliente.persona.correo ?? '',
  domicilio: cliente.persona.domicilio ?? '',
  idTipoCliente: String(cliente.idTipoCliente ?? ''),
  observaciones: cliente.observaciones ?? '',
})

export const FormularioCliente = ({ abierto, cliente, tipos, alCerrar, alGuardar }) => {
  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setDatos(cliente ? desdeCliente(cliente) : { ...VACIO, idTipoCliente: String(tipos[0]?.idTipoCliente ?? '') })
    setErrores({})
    setError(null)
  }, [abierto, cliente, tipos])

  const cambiar = (clave) => (evento) => {
    setDatos((previos) => ({ ...previos, [clave]: evento.target.value }))
    setErrores((previos) => ({ ...previos, [clave]: undefined }))
  }

  // La base tiene UNIQUE sobre el par (tipo, numero): media carga lo haria
  // saltar como error tecnico en vez de un mensaje entendible (RNF08).
  const validar = () => {
    const fallos = {}
    if (datos.apellidoNombre.trim().length < 2) {
      fallos.apellidoNombre = 'Cargá al menos dos caracteres.'
    }
    if (!datos.idTipoCliente) {
      fallos.idTipoCliente = 'Elegí si es minorista o mayorista.'
    }
    const conTipo = Boolean(datos.tipoDocumento)
    const conNumero = Boolean(datos.numeroDocumento.trim())
    if (conTipo !== conNumero) {
      fallos.numeroDocumento = 'Si cargás documento, necesito el tipo y el número.'
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
        ...datos,
        idTipoCliente: Number(datos.idTipoCliente),
        tipoDocumento: datos.tipoDocumento || null,
        numeroDocumento: datos.numeroDocumento.trim() || null,
        telefonoWhatsapp: datos.telefonoWhatsapp.trim() || null,
        correo: datos.correo.trim() || null,
        domicilio: datos.domicilio.trim() || null,
        observaciones: datos.observaciones.trim() || null,
      })
    } catch (fallo) {
      setError(fallo.message)
      setGuardando(false)
    }
  }

  return (
    <Dialogo
      abierto={abierto}
      alCerrar={alCerrar}
      titulo={cliente ? 'Editar cliente' : 'Nuevo cliente'}
      descripcion={
        cliente
          ? 'Los cambios se aplican también a las ventas futuras, no a las ya registradas.'
          : 'Lo único obligatorio es el nombre y la clasificación. El resto se puede completar después.'
      }
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton form="form-cliente" type="submit" cargando={guardando}>
            {cliente ? 'Guardar cambios' : 'Dar de alta'}
          </Boton>
        </div>
      }
    >
      <form id="form-cliente" onSubmit={enviar} noValidate className="grid gap-4">
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
          <Select
            etiqueta="Clasificación"
            obligatorio
            value={datos.idTipoCliente}
            onChange={cambiar('idTipoCliente')}
            error={errores.idTipoCliente}
            vacio="Elegir…"
            // RF13.5 — decide que lista de precios se aplica en la venta.
            ayuda="Define la lista de precios que se aplica."
            opciones={tipos.map((tipo) => ({
              valor: String(tipo.idTipoCliente),
              texto: tipo.nombre,
            }))}
          />

          <Select
            etiqueta="Tipo de persona"
            value={datos.tipoPersona}
            onChange={cambiar('tipoPersona')}
            opciones={[
              { valor: 'FISICA', texto: 'Persona física' },
              { valor: 'JURIDICA', texto: 'Persona jurídica' },
            ]}
          />
        </Par>

        <Par>
          <Select
            etiqueta="Tipo de documento"
            value={datos.tipoDocumento}
            onChange={cambiar('tipoDocumento')}
            vacio="Sin documento"
            opciones={TIPOS_DOCUMENTO}
          />
          <Texto
            etiqueta="Número"
            value={datos.numeroDocumento}
            onChange={cambiar('numeroDocumento')}
            error={errores.numeroDocumento}
            maxLength={20}
            inputMode="numeric"
          />
        </Par>

        <Par>
          {/* H11: el WhatsApp es el dato que el comercio pide siempre, para
              hacer seguimiento y coordinar los envios. */}
          <Texto
            etiqueta="WhatsApp"
            type="tel"
            value={datos.telefonoWhatsapp}
            onChange={cambiar('telefonoWhatsapp')}
            ayuda="Con el que se le hace el seguimiento."
            maxLength={30}
          />
          <Texto
            etiqueta="Correo"
            type="email"
            value={datos.correo}
            onChange={cambiar('correo')}
            maxLength={120}
          />
        </Par>

        <Texto
          etiqueta="Domicilio"
          value={datos.domicilio}
          onChange={cambiar('domicilio')}
          maxLength={200}
        />

        <Area
          etiqueta="Observaciones"
          value={datos.observaciones}
          onChange={cambiar('observaciones')}
          maxLength={300}
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
