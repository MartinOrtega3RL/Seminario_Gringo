// Alta del primer usuario Administrador.
//
// Existe por un problema de arranque: para dar de alta usuarios (RF02) hay que
// estar autenticado, y para autenticarse hace falta un usuario. Se corre una
// sola vez, con la base ya instalada:
//
//   npm run crear-administrador
//
// La contrasena se pide por entrada estandar y no se muestra al tipearla: si
// se pasara como argumento quedaria en el historial del shell y en la lista
// de procesos, visible para cualquiera con acceso a la maquina.

import { createInterface } from 'node:readline/promises'
import { sequelize } from '../src/config/base-de-datos.js'
import { Persona, Usuario, Perfil } from '../src/modelos/index.js'
import { cifrarContrasena } from '../src/modulos/acceso/acceso.servicio.js'

// UNA sola interfaz para toda la tanda de preguntas, y creada recien cuando se
// va a preguntar.
//
// Dos motivos. Cerrar una interfaz cierra process.stdin, asi que si se creara
// una por pregunta, la segunda leeria una entrada ya terminada: question() no
// dispara nunca y el proceso se cuelga sin decir nada. Y crearla antes de
// hablar con la base la deja consumiendo stdin durante las consultas, de modo
// que lo que llegue en ese rato se descarta sin que nadie lo pida.
const preguntar = async (lector, consigna) => (await lector.question(consigna)).trim()

// Oculta lo que se tipea sin ocultar la consigna. Se interviene el metodo
// interno de readline y no process.stdout.write: parchear la salida entera
// tambien se traga el texto de la pregunta, y el usuario no ve que se le pide.
// _writeToOutput es API privada de Node, estable desde hace anos; es la forma
// habitual de enmascarar en readline sin sumar una dependencia por un script
// que se corre una vez.
const preguntarOculto = async (lector, consigna) => {
  const original = lector._writeToOutput

  lector._writeToOutput = (texto) => {
    if (texto.includes(consigna)) return original.call(lector, texto)
    // Un asterisco por caracter tipeado; los saltos de linea pasan enteros.
    return original.call(lector, texto.includes('\n') ? texto : '*')
  }

  try {
    return (await lector.question(consigna)).trim()
  } finally {
    lector._writeToOutput = original
    process.stdout.write('\n')
  }
}

class Abortar extends Error {}
const abortar = (mensaje) => { throw new Abortar(mensaje) }

const verificarBaseLista = async () => {
  const perfil = await Perfil.findOne({ where: { nombre: 'Administrador' } })
  if (!perfil) abortar('No existe el perfil Administrador. Falta ejecutar gestion_comercial_datos.sql.')

  const yaHay = await Usuario.count({ where: { idPerfil: perfil.idPerfil } })
  if (yaHay > 0) abortar(`Ya hay ${yaHay} administrador(es) dados de alta. Este script se corre una sola vez.`)

  return perfil
}

const pedirDatos = async () => {
  const lector = createInterface({ input: process.stdin, output: process.stdout })

  try {
    console.log('\nAlta del primer Administrador\n')

    const apellidoNombre = await preguntar(lector, 'Apellido y nombre : ')
    if (!apellidoNombre) abortar('El apellido y el nombre son obligatorios.')

    const nombreUsuario = await preguntar(lector, 'Nombre de usuario : ')
    if (!nombreUsuario) abortar('El nombre de usuario es obligatorio.')

    const contrasena = await preguntarOculto(lector, 'Contrasena        : ')
    if (contrasena.length < 8) abortar('La contrasena necesita al menos 8 caracteres.')

    const repetida = await preguntarOculto(lector, 'Repetir contrasena: ')
    if (contrasena !== repetida) abortar('Las contrasenas no coinciden.')

    return { apellidoNombre, nombreUsuario, contrasena }
  } finally {
    lector.close()
  }
}

const darDeAlta = async ({ apellidoNombre, nombreUsuario, contrasena }, perfil) => {
  const contrasenaHash = await cifrarContrasena(contrasena)

  await sequelize.transaction(async (transaction) => {
    const persona = await Persona.create({ apellidoNombre, tipoPersona: 'FISICA' }, { transaction })

    await Usuario.create({
      idPersona: persona.idPersona,
      idPerfil: perfil.idPerfil,
      nombreUsuario,
      contrasenaHash,
    }, { transaction })
  })
}

const main = async () => {
  await sequelize.authenticate()

  const perfil = await verificarBaseLista()
  const datos = await pedirDatos()
  await darDeAlta(datos, perfil)

  console.log(`\nListo. Ya podes iniciar sesion como "${datos.nombreUsuario}".\n`)
}

try {
  await main()
} catch (error) {
  const mensaje = error instanceof Abortar ? error.message : `No se pudo crear el administrador: ${error.message}`
  console.error(`\n${mensaje}\n`)
  process.exitCode = 1
} finally {
  await sequelize.close().catch(() => {})
}
