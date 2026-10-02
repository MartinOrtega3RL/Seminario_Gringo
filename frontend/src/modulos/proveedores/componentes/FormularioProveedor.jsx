import { useEffect, useState } from 'react'
import { Dialogo } from '../../../ui/Dialogo.jsx'
import { Boton } from '../../../ui/Boton.jsx'
import { Select, Texto, Area, Par } from '../../../ui/Formulario.jsx'
import { Aviso } from '../../../ui/Estados.jsx'

// RF15.1 — alta y modificación de un proveedor.
//
// No lleva clasificación: el titular aclaró que la central se registra como un
// proveedor más y no se distingue del resto (H22).

const TIPOS_DOCUMENTO = ['CUIT', 'DNI', 'CUIL', 'PASAPORTE', 'OTRO'].map((valor) => ({
  valor,
  texto: valor,
}))

const VACIO = {
  apellidoNombre: '',
  tipoPersona: 'JURIDICA',
  tipoDocumento: 'CUIT',
  numeroDocumento: '',
  telefonoWhatsapp: '',
  correo: '',
  domicilio: '',
  sitioWeb: '',
  observaciones: '',
}

const desdeProveedor = (proveedor) => ({
  apellidoNombre: proveedor.persona.apellidoNombre ?? '',
  tipoPersona: proveedor.persona.tipoPersona ?? 'JURIDICA',
  tipoDocumento: proveedor.persona.tipoDocumento ?? '',
  numeroDocumento: proveedor.persona.numeroDocumento ?? '',
  telefonoWhatsapp: proveedor.persona.telefonoWhatsapp ?? '',
  correo: proveedor.persona.correo ?? '',
  domicilio: proveedor.persona.domicilio ?? '',
  sitioWeb: proveedor.sitioWeb ?? '',
  observaciones: proveedor.observaciones ?? '',
})

export const FormularioProveedor = ({ abierto, proveedor, alCerrar, alGuardar }) => {
  const [datos, setDatos] = useState(VACIO)
  const [errores, setErrores] = useState({})
  const [error, setError] = useState(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    if (!abierto) return
    setDatos(proveedor ? desdeProveedor(proveedor) : VACIO)
    setErrores({})
    setError(null)
  }, [abierto, proveedor])

  const cambiar = (clave) => (evento) => {
    setDatos((previos) => ({ ...previos, [clave]: evento.target.value }))
    setErrores((previos) => ({ ...previos, [clave]: undefined }))
  }

  const validar = () => {
    const fallos = {}
    if (datos.apellidoNombre.trim().length < 2) fallos.apellidoNombre = 'Cargá el nombre.'

    // La base tiene UNIQUE sobre el par (tipo, número): media carga lo haría
    // saltar como error técnico en vez de un mensaje entendible (RNF08).
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
        tipoDocumento: datos.tipoDocumento || null,
        numeroDocumento: datos.numeroDocumento.trim() || null,
        telefonoWhatsapp: datos.telefonoWhatsapp.trim() || null,
        correo: datos.correo.trim() || null,
        domicilio: datos.domicilio.trim() || null,
        sitioWeb: datos.sitioWeb.trim() || null,
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
      titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      descripcion="Lo único obligatorio es el nombre. El resto sirve para pedir mercadería sin buscar el contacto en otro lado."
      pie={
        <div className="flex justify-end gap-3">
          <Boton tono="desnudo" onClick={alCerrar} disabled={guardando}>
            Cancelar
          </Boton>
          <Boton form="form-proveedor" type="submit" cargando={guardando}>
            {proveedor ? 'Guardar cambios' : 'Dar de alta'}
          </Boton>
        </div>
      }
    >
      <form id="form-proveedor" onSubmit={enviar} noValidate className="grid gap-4">
        <Texto
          etiqueta="Nombre o razón social"
          obligatorio
          autoFocus
          value={datos.apellidoNombre}
          onChange={cambiar('apellidoNombre')}
          error={errores.apellidoNombre}
          maxLength={150}
        />

        <Par>
          <Select
            etiqueta="Tipo"
            value={datos.tipoPersona}
            onChange={cambiar('tipoPersona')}
            opciones={[
              { valor: 'JURIDICA', texto: 'Empresa' },
              { valor: 'FISICA', texto: 'Persona' },
            ]}
          />
          <Texto
            etiqueta="WhatsApp"
            type="tel"
            value={datos.telefonoWhatsapp}
            onChange={cambiar('telefonoWhatsapp')}
            maxLength={30}
            ayuda="Por donde se le hace el pedido."
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
          <Texto
            etiqueta="Correo"
            type="email"
            value={datos.correo}
            onChange={cambiar('correo')}
            maxLength={120}
          />
          {/* H14: algunos pedidos se cursan por la web del proveedor. */}
          <Texto
            etiqueta="Sitio web"
            type="url"
            value={datos.sitioWeb}
            onChange={cambiar('sitioWeb')}
            maxLength={200}
            placeholder="https://"
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
          ayuda="Días de reparto, condiciones, lo que convenga recordar."
        />

        {error && <Aviso tono="mal">{error}</Aviso>}
      </form>
    </Dialogo>
  )
}
