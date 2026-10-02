import 'dotenv/config'
import { z } from 'zod'

// Validar el entorno al arrancar y no a mitad de una peticion: si falta una
// variable, el servidor no levanta y el error dice cual, en vez de fallar
// cuando alguien intenta iniciar sesion.
const esquema = z.object({
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),

  PORT: z.coerce.number().int().positive().default(3000),
  ORIGEN_FRONTEND: z.string().url().default('http://localhost:5173'),

  JWT_SECRETO: z.string().min(32, 'JWT_SECRETO debe tener al menos 32 caracteres'),
  JWT_VIGENCIA: z.string().default('8h'),
})

const resultado = esquema.safeParse(process.env)

if (!resultado.success) {
  const faltantes = resultado.error.issues
    .map((problema) => `  - ${problema.path.join('.')}: ${problema.message}`)
    .join('\n')

  console.error(`\nNo se puede arrancar: revisar el archivo .env\n${faltantes}\n`)
  console.error('Copiar .env.example como .env y completar los valores.\n')
  process.exit(1)
}

export const entorno = resultado.data
