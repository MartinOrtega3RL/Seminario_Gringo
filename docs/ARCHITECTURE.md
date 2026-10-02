# Architecture — Arquitectura del sistema

Sistema de gestión comercial de **El Gringo Celulares**, Formosa. Iteración 1.
Decisiones tomadas el 09/09/2026 siguiendo el recorrido `design-code-architecture`.

Este documento es la evidencia del criterio de verificación de **RNF17** («revisión de la estructura del código fuente») y de **RNF16** («revisión del modelo de datos y de la arquitectura»). No agrega alcance: todo lo que decide es *cómo* se construye lo que la especificación ya pide.

---

## System Context — Contexto del sistema

Sistema web para la operación diaria del comercio: catálogo de productos, control de existencias, padrón de clientes y registro de ventas con emisión de comprobante. Reemplaza el registro en papel y la consulta manual de listas de precios de proveedor.

**Alcance de la iteración 1:** 13 requerimientos funcionales agrupadores, 54 operaciones, 4 de los 6 módulos. El detalle está en `ITERACION_1.md`.

### Integraciones

**Ninguna llamada saliente.** Es un dato, no un descuido:

| Sistema externo | Estado | Evidencia |
|---|---|---|
| Terminal Mercado Pago Point Smart | No se integra. Opera de forma autónoma; el medio de pago y su importe se registran a mano | S11 |
| Impresora | Dispositivo local del sistema operativo, no un servicio de red | H21 |
| Controlador fiscal | Fuera de alcance en esta etapa. Se emiten comprobantes internos no fiscales | S05 |

La consecuencia es directa: no hay temporizadores, cortacircuitos ni compartimentos que diseñar. La fase de resiliencia queda reducida a dos controles internos, registrados más abajo.

### Escala

Con 20 ventas y 5 órdenes de servicio por día (H18) y tres usuarios concurrentes (S03), el sistema no llega a una consulta por segundo ni a 50 MB de crecimiento anual.

**Una instancia de MySQL con los índices que el DDL ya define.** Sin caché, sin réplicas de lectura, sin cola de mensajes, sin particionado: ninguna de esas técnicas se adopta «por las dudas». Se revisa si el comercio supera las 500 operaciones diarias, que está dos órdenes de magnitud arriba.

---

## Layer Map & Dependency Rule — Mapa de capas y regla de dependencias

### Backend

```
Express (rutas)          <- el framework vive aca y solo aca
      |
Controlador              <- traduce peticion en argumentos, respuesta en JSON
      |
Servicio                 <- orquesta: abre la transaccion, llama a las reglas, persiste
      |            \
Reglas (puras)        Modelos Sequelize
                           |
                        MySQL 8
```

Reglas que se cumplen sin excepción:

- **El controlador nunca contiene una regla de negocio.** Traduce y delega.
- **El servicio nunca importa Express.** No conoce `req` ni `res`; recibe y devuelve objetos planos.
- **Ninguna instancia de Sequelize sale del servicio.** Al controlador se le devuelve un objeto plano. Si el ORM llegara al frontend, el esquema de la base quedaría acoplado a la interfaz.
- **Las reglas puras no importan nada.** Ni Sequelize ni Express. Son funciones de datos a datos.

### Frontend

```
Paginas y componentes    <- solo presentacion e interaccion
      |
Ganchos (hooks)          <- estado de pantalla y coordinacion
      |
Servicios de API         <- el unico lugar que sabe de HTTP y de rutas del backend
      |
Backend
```

Ningún componente llama a `fetch` de forma directa. El componente no sabe qué URL existe detrás.

### Estructura de carpetas

```
backend/src/
  main.js                      punto de armado: conecta la base, monta las rutas, arranca
  config/
    base-de-datos.js           instancia de Sequelize
    entorno.js                 lectura y validacion de variables de entorno
  modelos/                     mapeo sobre las tablas existentes
    index.js                   asociaciones entre los 17 modelos, en un solo lugar
    acceso.js                  persona, perfil, modulo, permiso, usuario, sesion
    catalogo.js                categoria, marca, producto
    existencias.js             movimiento_stock
    clientes.js                tipo_cliente, cliente
    ventas.js                  medio_pago, venta, detalle_venta, pago_venta
    sistema.js                 parametro_sistema, con su cache en memoria
  modulos/
    acceso/                    RF01, RF02, RF04
    catalogo/                  RF06, RF07, RF08, RF09
    existencias/               RF11, RF12
    clientes/                  RF13
    ventas/                    RF16, RF17, RF18
      ventas.rutas.js
      ventas.controlador.js
      ventas.servicio.js
      ventas.reglas.js
      comprobante/
        comprobante.puerto.js  la interfaz - S05
        comprobante.html.js    la implementacion de esta etapa
  http/
    middlewares/
      autenticar.js            resuelve el usuario desde el token
      autorizar.js             valida permisos en el servidor - RNF18
      manejar-errores.js       traduce excepciones a mensajes sin detalle tecnico - RNF08
    paginacion.js
  errores.js                   clases de error del dominio

frontend/src/
  main.jsx
  app/                         enrutador, plantilla general, proveedores de contexto
  api/cliente.js               envoltorio de fetch: URL base, token, manejo de error
  modulos/
    acceso/  catalogo/  existencias/  clientes/  ventas/
      paginas/  componentes/  ganchos/  <modulo>.api.js
  ui/                          componentes reutilizables - territorio de `impeccable`
```

Sin `utils`, sin `helpers`, sin `common`, sin `shared`: nombres genéricos prohibidos por convención. Cada carpeta nombra un concepto del negocio.

Los modelos se agrupan por contexto y no uno por archivo: diecisiete archivos de treinta líneas cada uno se leen peor que seis que agrupan lo que cambia junto. Las asociaciones viven todas en `index.js` porque, si cada modelo declarara las suyas, importarse entre ellos crearía ciclos.

### Puntaje contra el diagnóstico de Clean Architecture: 7/10

| Control | Resultado |
|---|---|
| ¿Las reglas de negocio se prueban sin base, sin servidor web y sin framework? | Parcial — solo las reglas puras |
| ¿Todas las dependencias de código apuntan hacia adentro? | No — los servicios importan Sequelize |
| ¿Se puede cambiar de base sin tocar la lógica de negocio? | No |
| ¿Los casos de uso son independientes del mecanismo de entrega? | Sí |
| ¿El framework queda confinado al círculo exterior? | Sí, Express |
| ¿El grafo de componentes no tiene ciclos? | Sí |
| ¿Un único punto de armado inicializa las dependencias? | Sí |

Cuatro de siete. Los tres incumplimientos son la misma renuncia deliberada y están en la tabla siguiente.

| Violación | Ubicación | Corrección disponible | Estado |
|---|---|---|---|
| Los servicios importan modelos de Sequelize directamente | `modulos/*/*.servicio.js` | Interfaces de repositorio definidas por el servicio e implementadas en una capa externa | **Aceptada.** El esquema es un entregable documentado de la carpeta, no un detalle intercambiable. La abstracción compraría una opción que nadie va a ejercer |
| Las reglas de negocio que necesitan datos no se prueban sin base | `modulos/*/*.servicio.js` | Igual que la anterior | **Aceptada.** Se mitiga extrayendo a `*.reglas.js` todo lo que puede decidirse sin consultar |
| El modelo de persistencia y el modelo de dominio son el mismo objeto | `modelos/` | Entidades de dominio separadas, con mapeadores | **Aceptada.** Para 13 requerimientos, mapeadores y entidades duplicadas son la sobrearquitectura que el propio recorrido desaconseja |

Se registra el puntaje en lugar de disimularlo: la renuncia es una decisión de alcance con fundamento, no un descuido.

### El único límite completo: el comprobante

`comprobante.puerto.js` declara la interfaz; `comprobante.html.js` la implementa hoy. El servicio de ventas depende de la interfaz, nunca de la implementación, y `main.js` decide cuál se inyecta.

Es el único punto de volatilidad **documentado**: S05 dice que se emiten comprobantes internos no fiscales «postergando la integración con controladores fiscales para fases futuras». Cuando llegue el controlador fiscal se agrega `comprobante.fiscal.js` y no se toca una línea del servicio de ventas.

---

## Bounded Contexts & Context Map — Contextos delimitados

Los seis módulos de la especificación son los límites naturales. La iteración 1 implementa cuatro.

| Contexto | Requerimientos | Estado |
|---|---|---|
| **Acceso** | RF01, RF02, RF04 | Iteración 1 |
| **Catálogo** | RF06 a RF09 | Iteración 1 |
| **Existencias** | RF11, RF12 | Iteración 1 |
| **Clientes** | RF13 | Iteración 1 |
| **Ventas** | RF16 a RF18 | Iteración 1 |
| Servicio Técnico | RF20 a RF24 | Diferido |
| Reportes | RF25 a RF27 | Diferido |

### Relaciones

- **Ventas → Existencias**: relación de cliente y proveedor. Ventas pide descontar; Existencias es dueña de la regla de que el saldo no puede quedar negativo. Ventas no escribe `producto.stock_actual` por su cuenta.
- **Ventas → Catálogo**: solo lectura. Ventas consulta precios y congela el valor en `detalle_venta` al confirmar. Un cambio de precio posterior no altera una venta ya registrada.
- **Ventas → Clientes**: solo lectura. La clasificación del cliente determina la lista aplicable.
- **Acceso → todos**: transversal, aplicado como middleware. No es un contexto de negocio sino una política.

### Palabras que significan cosas distintas

No unificar estos términos en un solo modelo omnisciente:

- **Cliente.** En Ventas es una clasificación de lista de precios (minorista o mayorista). En Servicio Técnico —diferido— es el dueño de un equipo, con su ficha y su historial de reparaciones. Comparten la tabla `persona` como identidad, y ahí termina el parecido.
- **Producto** y **Repuesto**. Un repuesto es un producto del catálogo cuando se vende por mostrador, y es un insumo consumido cuando se usa en una reparación. La tabla `repuesto_utilizado`, del módulo diferido, es la que marca la diferencia. En la iteración 1 solo existe la primera acepción.

### Subdominios

- **Núcleo — Existencias y Ventas.** Es donde se invierte el modelado cuidadoso. H03: «el control de stock, el sistema de ventas en general es lo que más me preocupa en este momento».
- **De soporte — Catálogo y Clientes.** Necesarios, sin nada singular.
- **Genérico — Acceso.** Se resuelve con librerías establecidas (`bcrypt`, `jsonwebtoken`). No se escribe criptografía propia ni un esquema de sesiones propio. RF03, que haría configurables los perfiles, está diferido: los tres perfiles de H13 vienen precargados.

### Agregados y sus invariantes

Cada agregado tiene una raíz y referencia a los demás **por identificador**, nunca embebiéndolos.

**Venta** — raíz `venta`; miembros `detalle_venta`, `pago_venta` y los `movimiento_stock` que la operación genera.
- El total de la venta es la suma de sus líneas.
- Una venta no se confirma sin al menos una línea.
- Cada línea genera exactamente un movimiento de existencias de tipo `VENTA`.
- El precio y el costo se congelan en la línea al confirmar.
- Referencia a `cliente` y a `usuario` por identificador.

**Producto** — raíz `producto`; el historial de `movimiento_stock` pertenece al agregado.
- `stock_actual` **siempre** es igual a la suma de `movimiento_stock.cantidad` del producto, e igual al `stock_resultante` del último movimiento. Es una denormalización deliberada, exigida por RNF02: recalcular la suma en cada listado no entra en los 2 segundos.
- `stock_actual` nunca queda negativo.
- Ninguna operación actualiza una de las dos tablas sin la otra.

**Usuario** — raíz `usuario`; referencia a `persona` y a `perfil` por identificador.
- La contraseña se almacena siempre cifrada con función de hash (RNF09). Nunca se devuelve en una respuesta.

**Cliente** — raíz `cliente`; referencia a `persona` y a `tipo_cliente` por identificador.
- El tipo de cliente determina la lista de precios aplicable.

---

## Domain Glossary (Ubiquitous Language) — Glosario del dominio

Las palabras del negocio son las palabras del código. Sin traducir al inglés: el sistema se habla en castellano y el esquema ya está en castellano.

| Término | Significado en el negocio | Nombre en el código |
|---|---|---|
| Producto | Artículo del catálogo con precio y existencias | `producto` / `Producto` |
| Existencias | Cantidad disponible de un producto | `stockActual` |
| Movimiento de existencias | Toda variación del saldo, con su origen y su responsable | `MovimientoStock` |
| Ajuste | Corrección manual de existencias, con motivo obligatorio | `tipoMovimiento: 'AJUSTE'` |
| Venta | Operación de venta con su detalle y su medio de pago | `venta` / `Venta` |
| Línea de venta | Un producto y su cantidad dentro de una venta | `detalle_venta` / `DetalleVenta` |
| Comprobante | Documento no fiscal que se entrega al cliente | `Comprobante` |
| Lista de precios | Minorista o mayorista, según la clasificación del cliente | `tipoCliente.listaPrecios` |
| Perfil | Conjunto de permisos: Administrador, Vendedor, Técnico | `perfil` / `Perfil` |
| Baja lógica | El registro se inactiva y conserva su historial | `activo = false` |
| Anulación | Reverso de una venta registrada, con responsable | `anularVenta` |

---

## Data & Storage Decisions — Decisiones de datos y persistencia

### Motor y modelo

MySQL 8 sobre InnoDB. Modelo relacional, elegido por el patrón de acceso: muchas relaciones de muchos a muchos (permisos, compatibilidades, detalle de venta) y consultas ad hoc por período, cliente, categoría y marca. No hay ningún caso que justifique un segundo motor.

Un solo almacén. Sin persistencia políglota.

### Nivel de aislamiento y su consecuencia

**InnoDB opera por omisión en `REPEATABLE READ`.** Una consulta dentro de una transacción devuelve una foto consistente del momento en que empezó. Eso significa que **leer las existencias y después restarlas es una condición de carrera**: dos ventas simultáneas de la última unidad leen ambas el mismo saldo y las dos pasan. Es el patrón que la bibliografía llama *write skew*, y no lo detecta ninguna prueba de un solo usuario.

### El descuento de existencias

Una sola sentencia, con la guarda incorporada. Sin lectura previa, no hay ventana para la carrera:

```sql
UPDATE producto SET stock_actual = stock_actual - :cantidad
WHERE id_producto = :idProducto AND stock_actual >= :cantidad
```

Si afecta 0 filas, no había existencias suficientes: se lanza `StockInsuficiente`, la transacción se revierte y la venta no se registra. Todo dentro del mismo `sequelize.transaction()` que crea la venta, sus líneas y sus movimientos — RNF14.

**No se agrega `CHECK (stock_actual >= 0)` al DDL.** La guarda de la sentencia ya cierra el defecto y evitar el cambio ahorra reimportar el esquema. Queda registrado como red de seguridad disponible si alguna vez se toca el DDL por otro motivo.

### Corrección: qué protege realmente `version_registro`

`ITERACION_1.md` atribuye RNF14 al bloqueo optimista sobre `version_registro`. **Es una atribución equivocada y hay que corregirla.**

| Mecanismo | Qué protege | Dónde se usa |
|---|---|---|
| `version_registro` (bloqueo optimista) | Que dos personas editando la ficha del mismo producto no se pisen los cambios | RF06.2 · RF08 — modificación de producto y de precios |
| `UPDATE` con guarda dentro de la transacción | Que no se venda más de lo que hay | RF16.7 · RF11 — venta y movimientos de existencias |

Son invariantes distintos y necesitan mecanismos distintos. El bloqueo optimista además solo actúa si el código lee la instancia y la guarda con `save()`; una actualización escrita como expresión SQL lo saltea por completo sin avisar.

### Sistema de registro y datos derivados

MySQL es el sistema de registro para todo. El único dato derivado es `producto.stock_actual`, que se mantiene sincrónicamente dentro de la misma transacción que escribe el movimiento — no es un proceso aparte ni se reconstruye después. Su invariante está declarado arriba, en el agregado Producto.

Las 5 vistas de `gestion_comercial_datos.sql` sirven al módulo de Reportes, que está diferido. No se mapean en esta iteración.

### Paginación

**Todo listado se pagina desde el primer endpoint que se escriba.** S01 dimensiona el catálogo en 3.000 artículos y RNF02 exige respuesta en menos de 2 segundos; un endpoint que devuelve el conjunto completo es la causa de falla más común en producción. `http/paginacion.js` centraliza el contrato: `pagina` y `tamano`, con tope máximo, y respuesta con `total`.

La búsqueda por texto de RF06.5 usa el índice `FULLTEXT ft_producto_busqueda` que el DDL ya define. No se resuelve con `LIKE '%...%'`, que no puede usar índice.

### El esquema sale del DDL, nunca del diagrama

**`gestion_comercial_ddl.sql` es la fuente. El modelo EER de Workbench es solo para sacar la captura de la carpeta.**

No es una preferencia de estilo. Crear el esquema con la ingeniería directa de Workbench, a partir del modelo EER, **pierde las restricciones `CHECK` sin avisar**. Ya pasó una vez: la base quedó con sus 34 tablas, sus 54 claves foráneas y sus 22 índices únicos, y con **cero** de las 24 restricciones. Un movimiento de existencias con cantidad cero —que el esquema prohíbe— entraba sin problema.

Al repararlo apareció un segundo defecto, este del propio DDL: MySQL no admite que una columna esté a la vez en un `CHECK` y en una clave foránea con acción referencial. Siete claves tenían las dos cosas y dos tablas fallaban al crearse. Se quitó la cascada al actualizar, que no protegía nada: las claves referenciadas son `AUTO_INCREMENT` y nunca cambian de valor.

Si hay que rehacer el diagrama, la ingeniería inversa se hace **desde el DDL corregido**, no desde un modelo guardado. Un `.mwb` viejo reintroduce las dos cosas.

Para comprobar que una instalación quedó bien: `verificar_instalacion.sql`. Las restricciones `CHECK` son el control que más veces falló.

### Cuándo Sequelize y cuándo SQL crudo

Se usan los dos. El criterio no es «lo complejo en SQL», que no dice nada, sino esto:

**SQL crudo cuando el ORM no puede o genera algo malo.** Cuatro casos, y son los únicos:

- Una operación que tiene que ser **una sola sentencia atómica**. El descuento de existencias es el ejemplo: la API de instancia obliga a leer, restar en JavaScript y guardar, y esa lectura previa es la condición de carrera.
- Algo que el ORM **no sabe expresar**: `MATCH ... AGAINST` para la búsqueda por texto, funciones de ventana.
- **Agregaciones** sobre el conjunto filtrado. El total del período en el historial de ventas se calcula aparte del listado: sumar en JavaScript daría el total de los veinticinco renglones visibles, no el del período.
- **Operaciones masivas**: la actualización de precios toca una categoría entera en una sentencia. Recorrerla con el ORM serían miles de consultas.

**Sequelize para todo lo demás.** Un `INSERT` de producto escrito a mano pierde el mapeo de campos, la validación y el manejo de `version_registro`, y no gana nada.

**Regla que no se negocia:** el SQL crudo va siempre con parámetros nombrados, nunca armando la cadena. Donde hace falta un nombre de columna variable —la actualización masiva es el único caso— sale de una lista blanca en `catalogo.reglas.js`, porque un nombre de columna no se puede pasar como parámetro.

### Registro de eventos

`pino` con salida legible en desarrollo. Vive en `src/registro.js` y **no es la tabla `bitacora`**: esa es del dominio y audita qué hizo cada usuario; esto es técnico y solo sirve para operar el servidor.

Lo que hace que sirva:

- **Un error previsto no se registra como error.** Una contraseña incorrecta, un permiso denegado o un stock insuficiente son flujo normal del negocio y van como advertencia. Si los 404 gritaran, el registro se llenaría de ruido y el error de verdad pasaría desapercibido.
- **Contraseñas, hashes y tokens se censuran** antes de escribirse, por ruta. Un archivo de registro se copia, se pega en un chat y se sube a un repositorio.
- **El cuerpo de la petición no se registra.** Ahí viajan datos personales de clientes (Ley 25.326, RNF10).
- Cada petición lleva un identificador que vuelve en la respuesta, para encontrarla después sin buscar por hora aproximada.
- El SQL va a nivel `debug`: se enciende con `NIVEL_REGISTRO=debug` sin tocar código.

### Copias de seguridad — RNF13

Prioridad Alta en la especificación y sin dueño hasta ahora. **No es código de la aplicación**: es una tarea programada de Windows que ejecuta `mysqldump` a diario y conserva las últimas copias. Se configura en el equipo del comercio y se verifica restaurando una, que es el criterio que la propia especificación fija.

---

## Decision Log — Registro de decisiones

| Date | Decision | Why | Alternatives rejected |
|---|---|---|---|
| 09/09/2026 | Monolito modular: cinco módulos, un despliegue | Un equipo, una base de datos, menos de una consulta por segundo | Microservicios: con un modelo de datos compartido producen un monolito distribuido, estrictamente peor |
| 09/09/2026 | Capas colapsadas en persistencia; sin interfaces de repositorio | El esquema es un entregable documentado con su diagrama, no un detalle intercambiable | Repositorios e inversión de dependencia completa: compra la opción de cambiar de motor, que nadie va a ejercer |
| 09/09/2026 | Los modelos de Sequelize son también el modelo de dominio | 13 requerimientos no sostienen el costo de entidades duplicadas y mapeadores | Entidades de dominio separadas: es la sobrearquitectura que el propio recorrido desaconseja a esta escala |
| 09/09/2026 | Reglas decidibles sin consulta, extraídas a `*.reglas.js` puros | Recupera testeabilidad sin base para lista de precios, totales, visibilidad de costo y admisibilidad de anulación | Dejar todo en el servicio: obliga a levantar una base para probar una multiplicación |
| 09/09/2026 | Un único límite completo: el generador de comprobantes | S05 anuncia por escrito la integración fiscal futura. Es la única volatilidad documentada | Ningún límite: obligaría a tocar el servicio de ventas cuando llegue el controlador fiscal |
| 09/09/2026 | Una instancia de MySQL, sin caché ni réplicas ni cola | Menos de una consulta por segundo y menos de 50 MB anuales | Caché, réplicas de lectura, cola de mensajes: no hay número que las justifique. Se revisan si se superan 500 operaciones diarias |
| 09/09/2026 | Descuento de existencias con `UPDATE` guardado, en una sola sentencia | `REPEATABLE READ` hace que leer y después restar sea una condición de carrera | `SELECT ... FOR UPDATE`: correcto pero más lento y más fácil de olvidar. Bloqueo optimista: protege otro invariante |
| 09/09/2026 | Sin `CHECK (stock_actual >= 0)` en el DDL | La guarda de la sentencia ya cierra el defecto; evita reimportar el esquema y rehacer capturas | Agregar la restricción: mejor defensa en profundidad, a cambio de rehacer la instalación |
| 09/09/2026 | Paginación obligatoria en todo listado | 3.000 artículos (S01) contra un límite de 2 segundos (RNF02) | Devolver el conjunto completo: la causa de falla más frecuente en producción |
| 09/09/2026 | El usuario responsable sale del token, nunca del cuerpo de la petición | Si lo aceptara del cliente, cualquiera podría registrar operaciones a nombre de otro | Recibir `id_usuario` en el cuerpo: suplantación trivial |
| 09/09/2026 | Permisos validados en el servidor en cada operación | RNF18 lo exige explícitamente; ocultar botones no es control de acceso | Confiar en la restricción de interfaz de RF04.1: se saltea invocando el endpoint directamente |
| 24/09/2026 | «Catálogo» y «Existencias» se unifican en una sección «Productos» con tres vistas | El módulo 2 de la especificación es uno solo y tiene un único permiso. Mostrarlo partido obligaba a adivinar dónde buscar: el listado mostraba existencias y «Existencias» mostraba movimientos, así que ninguno de los dos nombres decía lo que hacía | Renombrar y dejarlos separados: arregla la ambigüedad pero mantiene seis destinos donde la especificación define cinco |
| 24/09/2026 | Sequelize por omisión, SQL crudo en cuatro casos acotados | Atomicidad, lo que el ORM no expresa, agregaciones y operaciones masivas. Fuera de eso el ORM aporta mapeo, validación y bloqueo optimista | SQL en todo: se pierden esas tres cosas. ORM en todo: condiciones de carrera y consultas de miles de sentencias |
| 24/09/2026 | Registro con `pino`; los errores previstos van como advertencia | Un registro donde cada 404 aparece como error no se lee, y el error real se pierde entre el ruido | `console.log`: sin niveles, sin censura de contraseñas, sin correlación por petición |
| 24/09/2026 | El código interno y el número de comprobante se derivan del identificador de la base | Es la única forma de que dos altas simultáneas no pidan el mismo. Se escribe un provisorio y se reemplaza en la misma transacción | Un contador en la aplicación: tiene esa carrera exacta |
| 09/09/2026 | El castellano es el idioma del código | El esquema, la especificación y el equipo hablan castellano. Traducir crea dos vocabularios para una sola cosa | Nombrar en inglés: rompe el lenguaje ubicuo contra la carpeta |
