# Sistema de Gestión Integral — «El Gringo Celulares»

Sistema de gestión para un comercio de venta y reparación de telefonía celular
de la ciudad de Formosa, Argentina.

**Seminario de Integración** — Universidad de la Cuenca del Plata
Facultad de Ingeniería, Tecnología y Arquitectura
Licenciatura en Sistemas de Información · Comisión U · Sede Formosa
Año 2026 · Profesor: Mtr. Lic. Cristian Fernando Cerquand

Britez Joaquín Emiliano · Ortega Minardi Martín · Rivero Ruth Camila

---

## Estado

**Iteración 1** — catorce requerimientos agrupadores y cincuenta y seis
operaciones, sobre un total de veintiocho y noventa y nueve que releva la
especificación.

| Módulo | Estado |
|---|---|
| Acceso, perfiles y usuarios | Desarrollado |
| Catálogo y existencias | Desarrollado |
| Ventas y mostrador | Desarrollado |
| Clientes y proveedores | Desarrollado |
| Servicio técnico | Diferido a la iteración siguiente |
| Reportes | Diferido a la iteración siguiente |

El modelo de datos cubre los veintiocho requerimientos, no solo los de esta
iteración: las tablas de los módulos diferidos ya están creadas.

## Tecnologías

| Capa | |
|---|---|
| Base de datos | MySQL 8.0.16 o superior · InnoDB |
| Backend | Node.js 20.11+ · Express 5 · Sequelize 6 · SQL directo para lo complejo |
| Autenticación | JSON Web Tokens · bcrypt |
| Registro | pino |
| Frontend | React 19 · Vite 8 · Tailwind CSS 4 · React Router 7 |
| Pruebas | Vitest |

## Puesta en marcha

### 1. Base de datos

Los tres archivos se ejecutan en orden, con un usuario que pueda crear esquemas:

```bash
mysql -u root -p < basedatos/gestion_comercial_ddl.sql
mysql -u root -p < basedatos/gestion_comercial_datos.sql
mysql -u root -p < basedatos/verificar_instalacion.sql
```

El primero **borra y recrea** el esquema `gestion_comercial`. El tercero no
modifica nada: informa cuántas tablas, restricciones y filas quedaron, para
comprobar que la instalación está completa.

### 2. Backend

```bash
cd backend
npm install
cp .env.example .env
```

Completar `.env` con el usuario y la contraseña de MySQL, y generar el secreto
de los tokens:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Crear el primer administrador — la contraseña se pide por consola, nunca se
pasa como argumento:

```bash
npm run crear-administrador
npm run dev
```

El servidor queda en `http://localhost:3000`.

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`.

## Estructura

```
basedatos/      Esquema, datos iniciales y verificación de la instalación
backend/
  src/
    config/     Entorno validado al arrancar y conexión a la base
    modelos/    Mapeo Sequelize del esquema existente (nunca sync)
    modulos/    Un módulo por área: acceso, catálogo, existencias,
                clientes, proveedores, ventas, clasificaciones
    http/       Middlewares de autenticación, autorización y errores
  scripts/      Alta del administrador y carga de datos de muestra
  pruebas/      Pruebas de las reglas de negocio
frontend/
  src/
    api/        Cliente HTTP con el token de sesión
    modulos/    Mismas áreas que el backend
    ui/         Componentes compartidos
    app/        Rutas y marco de la aplicación
docs/           Arquitectura, plan de diseño, deuda técnica y pruebas
```

## Comandos

| | Backend | Frontend |
|---|---|---|
| Desarrollo | `npm run dev` | `npm run dev` |
| Pruebas | `npm test` | `npm test` |
| Construcción | — | `npm run build` |
| Crear administrador | `npm run crear-administrador` | — |
| Datos de muestra | `npm run cargar-muestra` | — |

Los datos de muestra se quitan con `npm run cargar-muestra -- --borrar`.

## Documentación

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Decisiones de arquitectura y por qué se tomaron |
| [docs/TESTING.md](docs/TESTING.md) | Qué se prueba y qué no |
| [docs/TECH-DEBT.md](docs/TECH-DEBT.md) | Deuda técnica asumida |
| [ITERACION_1.md](ITERACION_1.md) | Alcance de esta iteración contrastado con la especificación |

La especificación de requerimientos completa está en la carpeta del seminario,
que no forma parte de este repositorio.
