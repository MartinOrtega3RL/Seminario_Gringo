import { mkdirSync } from 'node:fs'
import { extname, join } from 'node:path'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { DatosInvalidos } from '../../errores.js'

// RF10.2 — recepcion de imagenes de comprobantes (fotos de celular o escaneos)
// y carpeta local persistente para los datos del idioma de Tesseract.

export const CARPETA_COMPROBANTES = join(process.cwd(), 'almacen', 'comprobantes')
export const CARPETA_OCR_DATOS = join(process.cwd(), 'almacen', 'ocr-datos')

mkdirSync(CARPETA_COMPROBANTES, { recursive: true })
mkdirSync(CARPETA_OCR_DATOS, { recursive: true })

const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp'])

export const recibirComprobante = multer({
  storage: multer.diskStorage({
    destination: (_peticion, _archivo, listo) => listo(null, CARPETA_COMPROBANTES),
    filename: (_peticion, archivo, listo) => {
      const ext = extname(archivo.originalname).toLowerCase().slice(0, 8) || '.jpg'
      listo(null, `${randomUUID()}${ext}`)
    },
  }),

  limits: { fileSize: 12 * 1024 * 1024, files: 1 },

  fileFilter: (_peticion, archivo, listo) => {
    if (TIPOS.has(archivo.mimetype)) return listo(null, true)
    listo(new DatosInvalidos('El comprobante tiene que ser una imagen JPG, PNG o WebP (máximo 12 MB).'))
  },
}).single('imagen')
