# Design Code Architecture Plan

Recorrido de diseño arquitectónico del sistema de gestión de **El Gringo Celulares**.
Iniciado el 09/09/2026. Modo abreviado acordado con el equipo: fases 1, 2 y 7.

## Context

Respuestas de admisión, tomadas de la especificación (`Seminario\Seminario_Britez_Otega_Rivero.docx`) y no inventadas.

| Pregunta | Respuesta | Evidencia |
|---|---|---|
| Qué hace el sistema, y cuál es la ventaja real | Gestión comercial de un comercio de telefonía: catálogo, existencias, clientes y ventas. Lo que más importa es el control de existencias en tiempo real ligado a la venta | H03 |
| Stack | React 19 · Vite 8 · Tailwind CSS v4 / Express · Sequelize / MySQL 8 InnoDB | Decisión del equipo |
| Carga realista del primer año | 15 a 20 ventas y 3 a 5 órdenes por día; 3 usuarios concurrentes | H18, S03 |
| Dependencias salientes | **Ninguna.** La terminal Point Smart opera de forma autónoma y no se integra; la impresora es local | S11, H21 |
| Sistema de registro y segundos patrones de lectura | MySQL es el sistema de registro. Segundo patrón: búsqueda por texto sobre el catálogo, resuelta con índice `FULLTEXT` | RF06.5, RNF02, S01 |
| ¿Alguien validó que hace falta? | Sí: relevamiento con entrevista al titular del comercio, 27 hallazgos registrados | Anexo de entrevista |
| Cuántos equipos, cuánto del recorrido | Un equipo de 3 personas, 3 meses. Fases 1, 2 y 7 abreviadas | Decisión del equipo |

## Phase Status

| Phase | Skill | Status | Artifact | Date |
|---|---|---|---|---|
| 1 — Draw the boundaries | clean-architecture | done | ARCHITECTURE.md | 09/09/2026 |
| 2 — Model the domain | domain-driven-design | done (modo Brief) | ARCHITECTURE.md | 09/09/2026 |
| 3 — Size the system | system-design | skipped: menos de una consulta por segundo y menos de 50 MB anuales. Una instancia de MySQL con índices es la respuesta; el cálculo queda registrado en ARCHITECTURE.md | ARCHITECTURE.md | 09/09/2026 |
| 4 — Make data decisions | ddia-systems | done (modo Brief) | ARCHITECTURE.md | 09/09/2026 |
| 5 — Keep modules deep | software-design-philosophy | deferred: no hay código todavía. Se corre al cerrar la iteración 1 | TECH-DEBT.md | |
| 6 — Design for failure | release-it | skipped: no hay una sola llamada saliente que auditar (S11). Los dos controles que sí aplican —paginación de listados y copia de seguridad— quedan en el Registro de decisiones | RELIABILITY.md | 09/09/2026 |
| 7 — Prove wiring, lock in habits | pragmatic-programmer | done (modo Brief, abreviada) | TESTING.md + TECH-DEBT.md | 09/09/2026 |
| 8 — Cut scope to essential | 37signals-way | done: `ITERACION_1.md` ya fija el alcance en 13 requerimientos y declara lo diferido con su motivo | ITERACION_1.md | 09/09/2026 |
| Optional — Align teams to boundaries | team-topologies | skipped: un solo equipo de 3 personas | OPERATIONS.md | |

Statuses: pending · in-progress · awaiting-evidence · done · deferred: \<reason\> · skipped: \<reason\>

## Key Decisions

| Date | Phase | Decision | Rationale |
|---|---|---|---|
| 09/09/2026 | 1 | Monolito modular, cinco módulos en un solo despliegue | Un equipo, una base de datos. Separar en servicios con el mismo modelo de datos produce un monolito distribuido, estrictamente peor |
| 09/09/2026 | 1 | Un único límite completo: el generador de comprobantes | S05 anuncia por escrito la futura integración con controladores fiscales. Es la única volatilidad documentada |
| 09/09/2026 | 1 | Capas colapsadas en persistencia y transporte | El esquema es un entregable de la carpeta con su diagrama, no un detalle intercambiable. Interfaces de repositorio serían una opción que nadie va a ejercer |
| 09/09/2026 | 1 | Puntaje 7/10 aceptado a conciencia | Se renuncia a la independencia de la base a cambio de que el proyecto entre en tres meses. Las reglas puras sí quedan testeables sin base |
| 09/09/2026 | 2 | Núcleo del dominio: existencias y ventas | H03: es lo que el titular declaró como su mayor preocupación. Acceso y permisos son genéricos y se resuelven con librerías |
| 09/09/2026 | 2 | «Cliente» no se unifica entre Ventas y Servicio Técnico | En Ventas es una clasificación de lista de precios; en Servicio Técnico es el dueño de un equipo. Un modelo omnisciente arruinaría los dos |
| 09/09/2026 | 4 | Descuento de existencias con `UPDATE` guardado en una sola sentencia | Elimina la lectura previa y con ella la condición de carrera. Corrige la atribución errónea de RNF14 a `version_registro` |
| 09/09/2026 | 4 | Sin `CHECK (stock_actual >= 0)` en el DDL | La guarda en la sentencia ya cierra el defecto. Evita reimportar el esquema y rehacer capturas |
| 09/09/2026 | 6 | Todo listado paginado desde el primer endpoint | S01 dimensiona 3.000 artículos y RNF02 exige menos de 2 segundos |
| 09/09/2026 | 7 | Rebanada trazadora: autenticar → catálogo paginado → venta de una línea → comprobante | Atraviesa las cinco capas y las tres decisiones difíciles de revertir |

## Estado de la implementación

| Fecha | Hecho | Verificación |
|---|---|---|
| 09/09/2026 | Andamiaje del backend: configuración, 17 modelos, middlewares, tres módulos de la rebanada trazadora | 213 paquetes instalados; el árbol de imports resuelve; los 17 modelos se definen sobre las 17 tablas |
| 09/09/2026 | Pruebas de las reglas puras | 26 pruebas en verde, sin base de datos |
| 09/09/2026 | Invariantes de arquitectura verificados por búsqueda | Sin `sync()`; ningún `idUsuario` leído del cuerpo; ningún servicio importa Express; las reglas puras no importan nada |

| 10/09/2026 | Rebanada trazadora corrida contra la base real | 25 controles en verde: autenticación, token inválido, paginación con tope, búsqueda FULLTEXT y por código exacto, venta transaccional, invariante de existencias, guarda de stock, comprobante y cierre de sesión. La prueba creó sus propios datos y los borró: la base quedó igual |

Hallazgo de la corrida: `verificar_instalacion.sql` esperaba 18 filas en `permiso` y la semilla carga 12, porque solo inserta las combinaciones habilitadas y la ausencia de fila significa denegar. El error estaba en el verificador, no en los datos. Corregido.

Backend de la iteración 1: **verificado de punta a punta**. Siguiente: frontend.

## Next Actions

- [ ] Verificar la instalación de la base con `verificar_instalacion.sql` en Workbench (equipo, antes de correr la rebanada)
- [ ] Copiar `backend/.env.example` como `backend/.env` y completar la contraseña de MySQL y `JWT_SECRETO` (equipo)
- [ ] Dar de alta el primer usuario Administrador con contraseña cifrada, para poder autenticarse (equipo)
- [ ] Resolver en la carpeta la dependencia entre RF06.7 y RF15, hoy diferido (equipo, antes de cerrar la iteración)
- [ ] Corregir en `ITERACION_1.md` la atribución de RNF14 a `version_registro` (ver ARCHITECTURE.md § Data & Storage Decisions)
- [ ] Programar la copia de seguridad diaria de RNF13 como tarea de Windows con `mysqldump` (equipo, antes de la entrega)
- [ ] Correr la fase 5 (módulos profundos) al cerrar la iteración 1, con el código ya escrito
