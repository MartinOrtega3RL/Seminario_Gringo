import { Router } from 'express'
import { Op } from 'sequelize'
import { z } from 'zod'
import { autenticar } from '../../http/middlewares/autenticar.js'
import { autorizar } from '../../http/middlewares/autorizar.js'
import { ModeloDispositivo, Marca } from '../../modelos/index.js'
import { DatosInvalidos, NoEncontrado } from '../../errores.js'

// RF06.8 — catalogo de modelos de dispositivo, contra el que se declara la
// compatibilidad de un producto.
//
// Cada modelo cuelga de una marca y la base exige que el par (marca,
// denominacion) sea unico: "iPhone 13" existe una sola vez, no una por cada
// funda que le sirve.

const esquemaModelo = z.object({
  idMarca: z.coerce.number().int().positive(),
  denominacion: z.string().trim().min(2, 'Cargá el nombre del modelo.').max(80),
  sistemaOperativo: z.enum(['ANDROID', 'IOS', 'OTRO']).nullish(),
})

export const rutasModelos = Router()

rutasModelos.use(autenticar)
const leer = autorizar('CATALOGO_STOCK', 'lectura')
const escribir = autorizar('CATALOGO_STOCK', 'escritura')

rutasModelos.get('/', leer, async (peticion, respuesta) => {
  const texto = z.string().trim().max(80).optional().parse(peticion.query.texto || undefined)

  const filtro = texto ? { denominacion: { [Op.like]: `%${texto}%` } } : {}

  const modelos = await ModeloDispositivo.findAll({
    where: filtro,
    include: [{ model: Marca, as: 'marca', attributes: ['idMarca', 'nombre'] }],
    order: [['denominacion', 'ASC']],
    limit: 30,
  })

  return respuesta.json({ datos: modelos })
})

rutasModelos.post('/', escribir, async (peticion, respuesta) => {
  const datos = esquemaModelo.parse(peticion.body)

  if (!(await Marca.findOne({ where: { idMarca: datos.idMarca, activo: true } }))) {
    throw new NoEncontrado('La marca')
  }

  const [modelo, creado] = await ModeloDispositivo.findOrCreate({
    where: { idMarca: datos.idMarca, denominacion: datos.denominacion },
    defaults: { sistemaOperativo: datos.sistemaOperativo ?? null },
  })

  if (!creado) throw new DatosInvalidos(`Esa marca ya tiene un modelo "${datos.denominacion}".`)

  return respuesta.status(201).json({
    datos: await ModeloDispositivo.findByPk(modelo.idModelo, {
      include: [{ model: Marca, as: 'marca', attributes: ['idMarca', 'nombre'] }],
    }),
  })
})
