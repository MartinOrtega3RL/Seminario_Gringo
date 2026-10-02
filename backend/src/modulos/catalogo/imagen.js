import { mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { DatosInvalidos } from '../../errores.js'

// RF06.6 — recepcion de la imagen del producto.
//
// El archivo va a disco y en la base queda la ruta (producto.imagen_ruta). No
// se guarda el binario en MySQL: inflaria la base y las copias de seguridad
// diarias de RNF13 pasarian de megabytes a gigabytes.

export const CARPETA_IMAGENES = join(process.cwd(), 'almacen', 'productos')
export const RUTA_PUBLICA = '/almacen/productos'

mkdirSync(CARPETA_IMAGENES, { recursive: true })

const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export const recibirImagen = multer({
  storage: multer.diskStorage({
    destination: (_peticion, _archivo, listo) => listo(null, CARPETA_IMAGENES),
    // El nombre lo pone el servidor. Usar el que vino del cliente permitiria
    // sobrescribir archivos ajenos o escribir fuera de la carpeta.
    filename: (_peticion, archivo, listo) =>
      listo(null, `${randomUUID()}${extname(archivo.originalname).toLowerCase().slice(0, 8)}`),
  }),

  limits: { fileSize: 4 * 1024 * 1024, files: 1 },

  fileFilter: (_peticion, archivo, listo) => {
    if (TIPOS.has(archivo.mimetype)) return listo(null, true)
    listo(new DatosInvalidos('La imagen tiene que ser JPG, PNG, WebP o AVIF.'))
  },
}).single('imagen')
