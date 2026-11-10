import { mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { DatosInvalidos } from '../../errores.js'

// RF21.7 — recepcion de las fotografias del equipo.
//
// Mismo criterio que la imagen de producto: el archivo va a disco y en la base
// queda el nombre. Con una diferencia que importa: estas fotos NO se sirven como
// archivos estaticos. Son el equipo de un cliente, con lo que haya en pantalla, y
// la carpeta de productos es publica porque es un catalogo. Se las entrega por
// una ruta que exige sesion y permiso (H12 pide control de acceso sobre las
// fichas del servicio tecnico).

export const CARPETA_FOTOS = join(process.cwd(), 'almacen', 'ordenes')

mkdirSync(CARPETA_FOTOS, { recursive: true })

const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif'])

export const recibirFoto = multer({
  storage: multer.diskStorage({
    destination: (_peticion, _archivo, listo) => listo(null, CARPETA_FOTOS),
    // El nombre lo pone el servidor, igual que en el catalogo: el que manda el
    // cliente permitiria sobrescribir archivos ajenos o salir de la carpeta.
    filename: (_peticion, archivo, listo) =>
      listo(null, `${randomUUID()}${extname(archivo.originalname).toLowerCase().slice(0, 8)}`),
  }),

  // Una foto de celular pesa mas que una imagen de catalogo.
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },

  fileFilter: (_peticion, archivo, listo) => {
    if (TIPOS.has(archivo.mimetype)) return listo(null, true)
    listo(new DatosInvalidos('La foto tiene que ser JPG, PNG, WebP o AVIF.'))
  },
}).single('foto')
