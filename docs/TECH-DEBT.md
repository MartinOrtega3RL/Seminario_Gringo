# Tech Debt — Deuda técnica y convenciones

Iteración 1. Escrito el 09/09/2026 en la fase 7 del recorrido `design-code-architecture`.

---

## Adopted Conventions — Convenciones adoptadas

### Idioma

**Castellano en todo el código.** El esquema, la especificación, los hallazgos y el equipo hablan castellano; traducir crearía dos vocabularios para una sola cosa. Los identificadores de la base son `snake_case` y en JavaScript se mapean a `camelCase` con `field:` explícito.

### Nombres

- Prohibidos los nombres genéricos: `utils`, `helpers`, `common`, `shared`, `manager`, `data`. Cada archivo y cada carpeta nombra un concepto del negocio.
- Un archivo por responsabilidad: `ventas.servicio.js` orquesta, `ventas.reglas.js` decide, `ventas.controlador.js` traduce.
- Las funciones se llaman como la operación de la especificación: `confirmarVenta`, `anularVenta`, `registrarAjuste`.

### Dónde vive cada cosa

| Tipo de código | Lugar | Nunca |
|---|---|---|
| Reglas de negocio decidibles sin consultar | `*.reglas.js` | En el controlador ni en un componente React |
| Orquestación y transacciones | `*.servicio.js` | En el controlador |
| Traducción petición ↔ respuesta | `*.controlador.js` | Con lógica de negocio adentro |
| Consultas | Modelos de Sequelize, invocados desde el servicio | En el controlador |
| Llamadas HTTP del frontend | `<modulo>.api.js` | `fetch` suelto dentro de un componente |

### Reversibilidad y ortogonalidad

- **Un cambio de una regla toca un archivo.** Si cambiar la política de precios obliga a editar cuatro lugares, el conocimiento está duplicado y hay que unificarlo.
- **No repetir conocimiento, sí tolerar parecidos.** Dos funciones que se parecen pero responden a reglas distintas se dejan separadas: unificarlas las acopla para siempre.
- **Ningún objeto de Sequelize cruza al frontend.** El contrato de la API es de objetos planos y se define desde el negocio, no desde el esquema.

### Librería antes que código propio

Autenticación con `bcrypt` y `jsonwebtoken`. Validación de entrada con una librería establecida. Nada de criptografía propia, esquemas de sesión propios ni utilidades de fecha propias. Se escribe código propio solo para las reglas del negocio, que es lo único que nadie más puede darnos hecho.

---

## Debt Budget & Broken-Windows Policy — Presupuesto de deuda y ventanas rotas

**La regla:** ningún atajo entra sin quedar anotado. Un `TODO` suelto en el código no cuenta — se anota en el Registro de deuda de abajo, con el disparador que obliga a volver.

**El presupuesto:** una tarea de deuda por semana. Si el registro crece dos semanas seguidas sin que se pague ninguna, se frena el desarrollo de funcionalidad nueva hasta emparejar.

**Ventana rota:** el primer atajo que se deja sin anotar autoriza al siguiente. En un equipo de tres personas y con la carpeta en paralelo, es el modo más probable de que el código se degrade sin que nadie lo decida.

---

## Smell Inventory — Inventario de olores

Vacío. La fase 5 (módulos profundos) está diferida porque todavía no hay código que auditar. Se corre al cerrar la iteración 1, y sus hallazgos entran acá.

| Olor | Ubicación | Corrección | Estado |
|---|---|---|---|
| — | — | — | pendiente de la fase 5 |

---

## Debt Ledger — Registro de deuda

Deuda tomada a conciencia. Cada fila tiene el disparador que obliga a revisarla; sin disparador, «después» significa nunca.

| Deuda | Por qué se toma | Disparador para revisarla |
|---|---|---|
| Sin interfaces de repositorio: los servicios usan Sequelize directo | El esquema es un entregable documentado de la carpeta, no un detalle intercambiable | Si alguna vez se plantea cambiar de motor, o si aparece una segunda fuente de datos |
| El modelo de persistencia es también el modelo de dominio | 13 requerimientos no sostienen el costo de entidades duplicadas y mapeadores | Si las reglas de un agregado dejan de caber en `*.reglas.js` y empiezan a repartirse |
| Sin `CHECK (stock_actual >= 0)` en el DDL | La guarda de la sentencia ya cierra el defecto; agregarlo obliga a reimportar el esquema | Si por otro motivo hay que volver a ejecutar el DDL, se agrega en esa misma pasada |
| Sin pruebas automatizadas de interfaz | Montarlas cuesta más de lo que devuelve con tres personas y tres meses | Si una regresión visual llega a una demostración dos veces |
| Sin integración continua: la compuerta se corre a mano | No hay repositorio remoto ni servidor | Si el equipo pasa a trabajar sobre un repositorio compartido |
| Las 17 tablas restantes del esquema existen pero no se mapean | Pertenecen a los módulos diferidos | Al abrir la iteración 2 |
| RF06.7 asocia proveedores a un producto, pero RF15 está diferido | Detectado al contrastar el alcance | **Antes de cerrar la iteración 1**: o se difiere también RF06.7, o RF15 sube |
| El manual de usuario y la bitácora describen el prototipo anterior | Se escribieron sobre la plantilla previa a esta arquitectura | Al terminar la iteración 1, antes de la entrega |

---

## Lo que NO se construye en la iteración 1

Registrado acá para que sea una decisión y no un olvido. El detalle con su motivo está en `ITERACION_1.md`.

| No se construye | Motivo |
|---|---|
| Caché, réplicas de lectura, cola de mensajes | El sistema no llega a una consulta por segundo. No hay número que las justifique |
| Cortacircuitos, temporizadores, compartimentos | No hay una sola llamada saliente (S11) |
| Sistema de estado global en el frontend (Redux, Zustand) | El estado de servidor vive en los ganchos de cada módulo; el compartido se reduce a sesión y permisos |
| Perfiles y permisos configurables (RF03) | Los tres perfiles de H13 vienen precargados |
| Integración con controlador fiscal | S05. La interfaz del comprobante ya deja el lugar preparado |
| Lectura de códigos de barras con lector óptico | S07: el comercio no tiene el equipamiento |
| Módulos de Servicio Técnico y Reportes | Diferidos por alcance |
