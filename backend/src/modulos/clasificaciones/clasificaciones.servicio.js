import { Categoria, Marca, Producto } from '../../modelos/index.js'
import { NoEncontrado, DatosInvalidos } from '../../errores.js'

// RF07.1 y RF07.2 — categorias y marcas.
//
// Son dos colecciones identicas en forma. En vez de escribir dos modulos
// gemelos, se arma uno por coleccion con la misma fabrica: dos copias es como
// terminan comportandose distinto ante el mismo caso.

const COLECCIONES = {
  categoria: { Modelo: Categoria, clave: 'idCategoria', campoProducto: 'idCategoria', que: 'La categoria' },
  marca: { Modelo: Marca, clave: 'idMarca', campoProducto: 'idMarca', que: 'La marca' },
}

export const crearServicio = (tipo) => {
  const { Modelo, clave, campoProducto, que } = COLECCIONES[tipo]

  const buscar = async (id) => {
    const fila = await Modelo.findOne({ where: { [clave]: id, activo: true } })
    if (!fila) throw new NoEncontrado(que)
    return fila
  }

  return {
    listar: () => Modelo.findAll({ where: { activo: true }, order: [['nombre', 'ASC']] }),

    buscar,

    registrar: async ({ nombre }) => {
      // La base tiene UNIQUE sobre el nombre. Verificarlo antes deja un mensaje
      // entendible en vez de que salte la restriccion como error tecnico.
      if (await Modelo.count({ where: { nombre } })) {
        throw new DatosInvalidos(`Ya existe "${nombre}".`)
      }
      return Modelo.create({ nombre })
    },

    modificar: async (id, { nombre }) => {
      const fila = await buscar(id)
      if (fila.nombre !== nombre && (await Modelo.count({ where: { nombre } }))) {
        throw new DatosInvalidos(`Ya existe "${nombre}".`)
      }
      return fila.update({ nombre })
    },

    /**
     * Baja logica. Se niega si todavia hay productos activos usandola: la
     * alternativa seria dejar productos apuntando a una clasificacion dada de
     * baja, que es peor que el error.
     */
    darDeBaja: async (id) => {
      const fila = await buscar(id)

      const enUso = await Producto.count({ where: { [campoProducto]: id, activo: true } })
      if (enUso > 0) {
        throw new DatosInvalidos(
          `No se puede dar de baja: hay ${enUso} producto${enUso === 1 ? '' : 's'} usando "${fila.nombre}".`,
        )
      }

      await fila.update({ activo: false })
    },
  }
}

export const servicioCategorias = crearServicio('categoria')
export const servicioMarcas = crearServicio('marca')
