import { createRequire } from 'node:module'
import sharp from 'sharp'
import { createWorker, OEM } from 'tesseract.js'
import { CARPETA_OCR_DATOS } from './comprobantes.js'
import { extraerLineas } from './recepciones.reglas.js'

const require = createRequire(import.meta.url)
const { version: VERSION_TESSERACT } = require('tesseract.js/package.json')

const MOTOR_LOCAL = `tesseract.js ${VERSION_TESSERACT} + sharp`

/**
 * Si la foto fue tomada sobre una superficie oscura (mesada, escritorio),
 * recorta los margenes oscuros exteriores para que Tesseract no convierta
 * la textura del fondo en caracteres falsos en los bordes de cada renglon.
 */
const detectarAreaPapel = async (rutaImagen) => {
  const { data: mini, info } = await sharp(rutaImagen)
    .rotate()
    .resize({ width: 300 })
    .grayscale()
    .normalize()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const { width: w, height: h } = info
  const colMedia = new Float32Array(w)
  const rowMedia = new Float32Array(h)
  for (let y = 0; y < h; y++) {
    let suma = 0
    for (let x = 0; x < w; x++) {
      const v = mini[y * w + x]
      suma += v
      colMedia[x] += v
    }
    rowMedia[y] = suma / w
  }
  for (let x = 0; x < w; x++) colMedia[x] /= h

  let x1 = 0; let x2 = w - 1; let y1 = 0; let y2 = h - 1
  while (x1 < w - 10 && colMedia[x1] < 105) x1++
  while (x2 > x1 + 10 && colMedia[x2] < 105) x2--
  while (y1 < h - 10 && rowMedia[y1] < 105) y1++
  while (y2 > y1 + 10 && rowMedia[y2] < 105) y2--

  const meta = await sharp(rutaImagen).rotate().metadata()
  const ow = meta.width || 0
  const oh = meta.height || 0
  if (!ow || !oh) return null

  const left = Math.max(0, Math.round((x1 / w) * ow) - 10)
  const top = Math.max(0, Math.round((y1 / h) * oh) - 10)
  const cropW = Math.min(ow - left, Math.round(((x2 - x1 + 1) / w) * ow) + 20)
  const cropH = Math.min(oh - top, Math.round(((y2 - y1 + 1) / h) * oh) + 20)

  if (cropW > ow * 0.35 && cropH > oh * 0.35 && (cropW < ow * 0.94 || cropH < oh * 0.94)) {
    return { left, top, width: cropW, height: cropH }
  }
  return null
}

/**
 * Optimiza fotos sacadas con celular para OCR local:
 * endereza orientacion EXIF, recorta mesada/fondo oscuro alrededor del ticket,
 * escala a 1800-2200 px, reduce ruido de papel termico con filtro mediana,
 * normaliza contraste y enfoca.
 */
const preprocesarParaLocal = async (rutaImagen) => {
  let pipeline = sharp(rutaImagen).rotate()
  const recorte = await detectarAreaPapel(rutaImagen).catch(() => null)
  let anchoBase
  if (recorte) {
    pipeline = pipeline.extract(recorte)
    anchoBase = recorte.width
  } else {
    const meta = await sharp(rutaImagen).rotate().metadata()
    anchoBase = meta.width || 1800
  }

  const anchoDestino = anchoBase < 1500 ? 1800 : Math.min(anchoBase, 2200)
  return pipeline
    .resize({ width: anchoDestino })
    .grayscale()
    .median(3)
    .normalize()
    .sharpen({ sigma: 1.2 })
    .png()
    .toBuffer()
}

// RF10.2 — el OCR corre en el servidor, sin enviar el comprobante a servicios externos.
export const procesarImagenOcr = async (rutaImagen) => {
  let worker = null
  try {
    let entrada = rutaImagen
    try {
      entrada = await preprocesarParaLocal(rutaImagen)
    } catch {
      // Fallback directo si sharp no pudo preprocesar
    }

    worker = await createWorker('spa', OEM.LSTM_ONLY, {
      cachePath: CARPETA_OCR_DATOS,
      errorHandler: () => {},
    })

    const { data } = await worker.recognize(entrada)
    const texto = String(data?.text ?? '')
    const confianzaBruta = Number(data?.confidence)
    const confianza = Number.isFinite(confianzaBruta)
      ? Math.max(0, Math.min(100, Math.round(confianzaBruta * 100) / 100))
      : 0

    return {
      ok: true,
      motor: MOTOR_LOCAL,
      texto,
      confianza,
      lineas: extraerLineas(texto),
      error: null,
    }
  } catch (error) {
    return {
      ok: false,
      motor: MOTOR_LOCAL,
      texto: null,
      confianza: null,
      lineas: [],
      error: String(error?.message || 'No se pudo procesar la imagen con OCR.').slice(0, 300),
    }
  } finally {
    if (worker) await worker.terminate().catch(() => {})
  }
}

