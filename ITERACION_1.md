# Iteración 1 — Sistema de gestión «El Gringo Celulares»

Lo que hay que desarrollar en esta iteración, contrastado contra la especificación.

> **Fuente de verdad:** `Seminario\Seminario_Britez_Otega_Rivero.docx`. Las tablas de este documento son copia literal de las suyas: se extrajeron del archivo, no se transcribieron. Si la carpeta cambia, hay que regenerar este documento.


## Stack

| Capa | Tecnología |
|---|---|
| **Frontend** | React 19 · Vite 8 · Tailwind CSS v4 |
| **Backend** | Express · Sequelize ORM |
| **Base de datos** | MySQL 8 / InnoDB |

> Tailwind v4 no lleva `tailwind.config.js`: se registra el plugin `@tailwindcss/vite` en `vite.config.js` y se importa con `@import "tailwindcss";` en el CSS. La personalización va en un bloque `@theme` dentro del propio CSS.


## Decisiones de arquitectura

Son decisiones técnicas del equipo. No modifican el alcance y por lo tanto no figuran en la carpeta, pero condicionan todo el código.

> El fundamento completo de cada una, con las alternativas descartadas, está en [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). Ese documento es además la evidencia que piden los criterios de verificación de **RNF16** y **RNF17**.


### La base de datos se crea desde el SQL, no desde Sequelize

El esquema está definido en `gestion_comercial_ddl.sql` (34 tablas) y es lo que documenta el diagrama entidad-relación de la carpeta. Sequelize **no crea las tablas**: se mapea sobre las que ya existen.


El motivo es concreto: `sequelize.sync()` no reproduce las 22 restricciones `CHECK`, la columna generada `bajo_minimo` ni los índices `FULLTEXT`. Si sincronizáramos, el esquema real dejaría de coincidir con el diagrama documentado.


- Ejecutar `gestion_comercial_ddl.sql` y después `gestion_comercial_datos.sql`.
- Cada modelo con `tableName` explícito, `timestamps: false` y `freezeTableName: true`.
- **Nunca** `sequelize.sync()`, y menos con `{ alter: true }` o `{ force: true }`.


### Nombres: `snake_case` en la base, mapeo explícito en el modelo

El esquema usa `snake_case` y claves primarias con prefijo (`id_producto`, no `id`).


```js
const Producto = sequelize.define('Producto', {
  idProducto:    { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true, field: 'id_producto' },
  codigoInterno: { type: DataTypes.STRING(30), allowNull: false, unique: true,     field: 'codigo_interno' },
  stockActual:   { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0,     field: 'stock_actual' },
  activo:        { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'producto', timestamps: false, freezeTableName: true })
```


### Baja lógica con `activo`, no con `paranoid`

El esquema implementa la baja lógica con una columna `activo`. **No usar `paranoid: true`**, que agregaría una columna `deletedAt` que no existe en las tablas. Todo listado filtra por `where: { activo: true }`.


### Bloqueo optimista sobre `version_registro`: solo para la edición de fichas

`producto.version_registro` impide que dos personas editando la ficha del mismo producto se pisen los cambios (**RF06.2**, **RF08**). En Sequelize se declara con `version: 'version_registro'` en las opciones del modelo, no como un atributo común.

**No sirve para impedir que se venda de más.** Son invariantes distintos: el bloqueo optimista evita perder una modificación, no evita que el saldo quede negativo. Además solo actúa si el código lee la instancia y la guarda con `save()`; una actualización escrita como expresión SQL lo saltea sin avisar.


### El descuento de stock: una sola sentencia, dentro de la transacción de la venta

Descontar existencias no puede ser una operación aparte: si el proceso cae entre registrar la venta y descontar el stock, las existencias quedan inconsistentes. **RNF14** lo prohíbe expresamente. Todo ocurre dentro de un único `sequelize.transaction()`.

Y el descuento en sí no puede leer el saldo y después restarlo. InnoDB opera en `REPEATABLE READ`: dos ventas simultáneas de la última unidad leen ambas el mismo saldo y las dos pasan. La guarda va dentro de la propia sentencia, sin lectura previa:

```sql
UPDATE producto SET stock_actual = stock_actual - :cantidad
WHERE id_producto = :idProducto AND stock_actual >= :cantidad
```

Si afecta 0 filas, no había existencias: se revierte la transacción y la venta no se registra.


### El invariante de las existencias

`producto.stock_actual` es siempre igual a la suma de `movimiento_stock.cantidad` de ese producto, e igual al `stock_resultante` del último movimiento. Es una denormalización deliberada que exige **RNF02**: recalcular la suma en cada listado no entra en los dos segundos.

La consecuencia operativa: **ninguna operación actualiza una de las dos tablas sin la otra**, y siempre dentro de la misma transacción.


### Todo listado se pagina

**S01** dimensiona el catálogo en 3.000 artículos y **RNF02** exige respuesta en menos de dos segundos. Un endpoint que devuelve el conjunto completo no cumple. La paginación se define una vez —parámetros `pagina` y `tamano`, con tope máximo, y `total` en la respuesta— y se aplica desde el primer listado que se escriba.

La búsqueda de **RF06.5** usa el índice `FULLTEXT` que el DDL ya define, no `LIKE '%...%'`, que no puede aprovechar índice.


### Las copias de seguridad no son código de la aplicación

**RNF13** pide copias automáticas diarias, prioridad Alta. Se resuelve con una tarea programada de Windows que ejecuta `mysqldump`, configurada en el equipo del comercio. Se verifica restaurando una copia, que es el criterio que fija la propia especificación.


### El usuario responsable sale del token, no del cuerpo de la petición

En los movimientos de stock, las ventas y las anulaciones, el identificador del usuario lo resuelve el servidor a partir del token de sesión. Si lo aceptara del cliente, cualquiera podría registrar operaciones a nombre de otro.


## Alcance

|  | Iteración 1 | Especificación completa |
|---|---|---|
| Requerimientos funcionales | 13 | 28 |
| Operaciones | 54 | 100 |
| Requerimientos no funcionales | 16 | 18 |
| Hallazgos involucrados | 18 | 27 |
| Supuestos aplicables | 8 | 11 |
| Tablas del modelo | 17 | 34 |

El criterio de selección está en la carpeta: es la prioridad que manifestó el titular en el hallazgo **H03**, «el control de stock, el sistema de ventas en general es lo que más me preocupa en este momento».


## Requerimientos funcionales

Los identificadores de primer nivel son requerimientos agrupadores: una funcionalidad completa, de la que deriva un caso de uso. Los de segundo nivel son las operaciones que la componen. La **prioridad** expresa el valor para el negocio y se fija en el agrupador; la **dificultad** expresa el esfuerzo técnico y se fija por operación. **Origen** remite a los hallazgos.


### 1 · Administración y seguridad

| ID | Nombre | Descripción | Prioridad | Dificultad | Origen |
|---|---|---|---|---|---|
| RF01 | Acceso al sistema | Gestionar el acceso de los usuarios al sistema | Alta | — | H12 |
| RF01.1 | Autenticar usuario | Autenticar al usuario mediante nombre de usuario y contraseña, emitiendo un token de sesión | Alta | Media | H12 |
| RF01.2 | Cerrar sesión | Cerrar la sesión del usuario, invalidando el token vigente | Alta | Baja | H12 |
| RF01.3 | Modificar contraseña propia | Permitir al usuario modificar su propia contraseña | Media | Baja | H12 |
| RF02 | Administración de usuarios | Administrar los usuarios del sistema | Alta | — | H13 |
| RF02.1 | Registrar usuario | Registrar un nuevo usuario del sistema | Alta | Baja | H13 |
| RF02.2 | Modificar usuario | Modificar los datos de un usuario existente | Media | Baja | H13 |
| RF02.3 | Dar de baja usuario | Dar de baja lógica un usuario, conservando su registro de operaciones | Media | Baja | H13 |
| RF02.4 | Asignar perfil | Asignar a cada usuario un perfil de acceso | Alta | Media | H13 |
| RF02.5 | Consultar usuarios | Consultar la nómina de usuarios del sistema y sus perfiles asignados | Media | Baja | H13 |
| RF04 | Control de acceso | Controlar el acceso a las funcionalidades conforme a los permisos asignados | Alta | — | H12 |
| RF04.1 | Restringir interfaz | Presentar al usuario únicamente los módulos y acciones habilitados para su perfil | Alta | Media | H12, H13 |
| RF04.2 | Restringir datos sensibles | Restringir la visualización de precios de costo y de información de rentabilidad a los perfiles habilitados | Alta | Media | H12 |

### 2 · Catálogo y existencias

| ID | Nombre | Descripción | Prioridad | Dificultad | Origen |
|---|---|---|---|---|---|
| RF06 | Gestión de productos | Gestionar los productos del catálogo | Alta | — | H01, H03 |
| RF06.1 | Registrar producto | Registrar un nuevo producto en el catálogo | Alta | Baja | H01 |
| RF06.2 | Modificar producto | Modificar los datos de un producto existente | Alta | Baja | H01 |
| RF06.3 | Dar de baja producto | Dar de baja lógica un producto, conservando su historial de operaciones | Media | Baja | H01 |
| RF06.4 | Consultar catálogo | Listar y consultar los productos del catálogo | Alta | Baja | H01 |
| RF06.5 | Buscar producto | Buscar productos por denominación, código interno, categoría o marca | Alta | Media | H01 |
| RF06.6 | Asociar imagen | Asociar una imagen al producto | Media | Media | H15 |
| RF06.7 | Asociar proveedor | Asociar uno o más proveedores al producto | Media | Baja | H14 |
| RF06.8 | Registrar compatibilidad | Registrar los modelos de dispositivo compatibles con el producto | Baja | Media | H23, H24 |
| RF07 | Gestión de clasificaciones | Gestionar las clasificaciones del catálogo | Media | — | H01 |
| RF07.1 | Administrar categorías | Registrar, modificar y dar de baja categorías de productos | Media | Baja | H01 |
| RF07.2 | Administrar marcas | Registrar, modificar y dar de baja marcas de productos | Media | Baja | H01 |
| RF08 | Gestión de precios | Gestionar los precios de los productos | Alta | — | H04 |
| RF08.1 | Registrar costo | Registrar el precio de costo del producto | Alta | Baja | H04 |
| RF08.2 | Registrar precio minorista | Registrar el precio de venta minorista | Alta | Baja | H04 |
| RF08.3 | Registrar precio mayorista | Registrar el precio de venta mayorista | Alta | Baja | H04 |
| RF08.4 | Actualizar precios masivamente | Actualizar precios de forma masiva mediante la aplicación de un porcentaje sobre una categoría o marca | Media | Media | Decisión del equipo (S09) |
| RF09 | Identificación de productos | Gestionar la identificación de los productos mediante códigos de barras | Alta | — | H02 |
| RF09.1 | Generar código interno | Generar y asignar automáticamente un código de barras interno al registrar un producto | Alta | Baja | H02 |
| RF09.2 | Generar etiqueta | Generar una etiqueta imprimible con el código de barras, la denominación y el precio del producto | Alta | Alta | H02 |
| RF11 | Movimientos de existencias | Registrar los movimientos que afectan las existencias | Alta | — | H03 |
| RF11.1 | Registrar ingreso de mercadería | Registrar el ingreso de mercadería, incrementando las existencias del producto | Alta | Media | H03 |
| RF11.2 | Descontar por venta | Descontar automáticamente las existencias al confirmarse una venta | Alta | Media | H03 |
| RF11.3 | Descontar por reparación | Descontar las existencias de los repuestos utilizados en una orden de servicio técnico | Alta | Media | H03, H05 |
| RF11.4 | Restituir por anulación | Restituir las existencias ante la anulación de una venta | Media | Media | H03 |
| RF11.5 | Registrar ajuste manual | Registrar ajustes manuales de inventario, consignando motivo y usuario responsable | Media | Media | H03 |
| RF12 | Control de niveles de existencias | Controlar los niveles de existencias del catálogo | Alta | — | H03 |
| RF12.1 | Consultar existencias | Consultar el estado de existencias por producto, categoría o marca | Alta | Baja | H03 |
| RF12.2 | Definir stock mínimo | Definir un nivel de existencias mínimo para cada producto | Media | Baja | H03 |
| RF12.3 | Alertar stock mínimo | Emitir una alerta cuando las existencias de un producto alcancen el nivel mínimo definido | Media | Media | H03 |
| RF12.4 | Consultar historial de movimientos | Consultar el historial de movimientos de existencias de un producto | Media | Media | H03 |

### 3 · Clientes y proveedores

| ID | Nombre | Descripción | Prioridad | Dificultad | Origen |
|---|---|---|---|---|---|
| RF13 | Gestión de clientes | Gestionar el padrón de clientes del comercio | Alta | — | H11 |
| RF13.1 | Registrar cliente | Registrar un nuevo cliente | Alta | Baja | H11 |
| RF13.2 | Modificar cliente | Modificar los datos de un cliente existente | Media | Baja | H11 |
| RF13.3 | Dar de baja cliente | Dar de baja lógica un cliente | Baja | Baja | H11 |
| RF13.4 | Buscar cliente | Buscar y consultar clientes por denominación, documento o número de contacto | Alta | Baja | H11 |
| RF13.5 | Clasificar cliente | Clasificar al cliente como minorista o mayorista | Alta | Baja | H04 |
| RF13.6 | Registrar contacto | Registrar los datos de contacto del cliente, incluyendo su número de WhatsApp | Alta | Baja | H11 |

### 4 · Ventas

| ID | Nombre | Descripción | Prioridad | Dificultad | Origen |
|---|---|---|---|---|---|
| RF16 | Registro de venta | Registrar una operación de venta | Alta | — | H03, H27 |
| RF16.1 | Iniciar venta | Iniciar una nueva operación de venta | Alta | Baja | H03 |
| RF16.2 | Agregar producto por código o búsqueda rápida | Incorporar productos a la venta mediante el ingreso directo de su código interno/SKU o selección predictiva en el catálogo | Alta | Baja | H01, H02 |
| RF16.3 | Modificar detalle de venta | Modificar la cantidad de un producto incorporado o quitarlo de la venta en curso | Alta | Baja | H03 |
| RF16.4 | Asociar cliente | Asociar un cliente registrado a la operación de venta | Alta | Baja | H11 |
| RF16.5 | Aplicar lista de precios | Aplicar automáticamente el precio minorista o mayorista según la clasificación del cliente asociado | Alta | Media | H04 |
| RF16.6 | Registrar medio de pago | Registrar el medio de pago utilizado en la operación | Alta | Baja | H17 |
| RF16.7 | Confirmar venta | Confirmar la venta, registrando la operación y actualizando las existencias de manera transaccional | Alta | Alta | H03 |
| RF16.8 | Registrar modalidad de pago | Registrar la modalidad de la operación —contado, financiación propia del comercio, financiación con tarjeta o financiación a través de Go Cuotas— y, cuando corresponda, la cantidad de cuotas convenida | Media | Baja | H27 |
| RF17 | Emisión de comprobante | Emitir el comprobante correspondiente a la operación | Alta | — | H01 |
| RF17.1 | Generar comprobante | Generar un comprobante de venta no fiscal con el detalle de la operación | Alta | Media | H01 |
| RF17.2 | Imprimir comprobante | Imprimir el comprobante de venta | Alta | Media | H01 |
| RF17.3 | Registrar modalidad de entrega | Registrar la modalidad de entrega de la operación: retiro en el local o envío a domicilio | Media | Baja | H19 |
| RF18 | Administración de ventas | Administrar las ventas registradas | Alta | — | H03 |
| RF18.1 | Consultar historial de ventas | Consultar el historial de ventas, con filtros por período y por cliente | Alta | Media | H03 |
| RF18.2 | Anular venta | Anular una venta registrada, conservando el registro de la anulación y su responsable | Media | Alta | H03, RNF14 |

## Requerimientos no funcionales

Se excluyen RNF03 y RNF04, que miden el módulo de reportes y el de servicio técnico, ambos diferidos.

| ID | Nombre | Categoría | Descripción | Prioridad | Criterio de verificación | Origen |
|---|---|---|---|---|---|---|
| RNF01 | Tiempo de registro de venta | Rendimiento | El sistema debe registrar una operación de venta completa en un tiempo inferior a tres segundos | Alta | Medición del tiempo transcurrido entre la confirmación de la venta y la emisión del comprobante, con un volumen de hasta treinta operaciones diarias | H18 |
| RNF02 | Tiempo de búsqueda | Rendimiento | El sistema debe devolver el resultado de una búsqueda de productos en un tiempo inferior a dos segundos | Alta | Medición sobre un catálogo de prueba de tres mil artículos (estimación de dimensionamiento técnico S01) | H01, H18 |
| RNF05 | Uso simultáneo | Concurrencia | El sistema debe permitir el uso simultáneo de al menos tres usuarios sin generar inconsistencias en las existencias | Alta | Prueba de operaciones concurrentes sobre un mismo producto | H13 |
| RNF06 | Interfaz gráfica moderna | Usabilidad | El sistema debe presentar una interfaz gráfica moderna, con navegación por menús e íconos, evitando presentaciones de tipo planilla de cálculo | Alta | Validación con el cliente sobre prototipo de interfaz | H16 |
| RNF07 | Curva de aprendizaje | Usabilidad | Un usuario sin conocimientos técnicos debe poder registrar una venta completa tras una capacitación no mayor a treinta minutos | Alta | Prueba de usuario con personal del comercio | H13, H16 |
| RNF08 | Mensajes de error comprensibles | Usabilidad | El sistema debe presentar mensajes de error comprensibles, sin exponer información técnica interna | Media | Revisión del catálogo de mensajes del sistema | H16 |
| RNF09 | Cifrado de contraseñas | Seguridad | Las contraseñas de los usuarios deben almacenarse cifradas mediante funciones de hash | Alta | Inspección de la base de datos | H12 |
| RNF10 | Protección de datos personales | Seguridad | El tratamiento de los datos personales de los clientes debe ajustarse a lo establecido por la Ley N.º 25.326 de Protección de Datos Personales | Alta | Revisión de las políticas de acceso y conservación de datos | H12 |
| RNF11 | Cierre de sesión por inactividad | Seguridad | El sistema debe cerrar la sesión del usuario automáticamente tras un período de inactividad | Media | Verificación del cierre tras el intervalo configurado | H12 |
| RNF12 | Disponibilidad en horario comercial | Disponibilidad | El sistema debe permanecer operativo durante la totalidad del horario comercial del local | Alta | Registro de interrupciones durante el período de prueba | H03 |
| RNF13 | Copias de seguridad | Fiabilidad | El sistema debe realizar copias de seguridad automáticas diarias de la base de datos | Alta | Verificación de la existencia y restauración de una copia | H12 |
| RNF14 | Integridad de las existencias | Integridad | Ninguna operación debe dejar las existencias en un estado inconsistente ante fallos o interrupciones | Alta | Prueba de interrupción durante la confirmación de una venta | H03 |
| RNF15 | Compatibilidad de dispositivos | Compatibilidad | El sistema debe funcionar sobre los dispositivos disponibles en el comercio: computadora personal, dispositivo móvil e impresora | Alta | Prueba de operación sobre cada dispositivo | H21 |
| RNF16 | Crecimiento del sistema | Escalabilidad | El sistema debe permitir la incorporación de nuevos productos, usuarios y eventuales sucursales sin requerir modificaciones en su arquitectura | Media | Revisión del modelo de datos y de la arquitectura | H04 |
| RNF17 | Modularidad | Mantenibilidad | El sistema debe estructurarse en módulos independientes que permitan su modificación de manera aislada | Media | Revisión de la estructura del código fuente | Decisión arquitectónica del equipo (S06) |
| RNF18 | Validación de permisos en el servidor | Seguridad | El sistema debe validar los permisos del usuario en el servidor ante cada operación solicitada, con independencia de las restricciones aplicadas en la interfaz | Alta | Prueba de invocación directa de operaciones no habilitadas para el perfil | H12 |

## Hallazgos que respaldan esta iteración

Evidencia del relevamiento de la que nacen los requerimientos de arriba.

| ID | Evidencia del relevamiento | Necesidad detectada |
|---|---|---|
| H01 | "Tenemos que fijarnos en la ficha de los proveedores o la lista de precios para poder sacar el precio en el momento" | Catálogo centralizado con búsqueda inmediata |
| H02 | Solicitud expresa del cliente: generación de códigos de barras propios, distintos de los del fabricante | Generación de códigos internos y etiquetas |
| H03 | "El control de stock, el sistema de ventas en general es lo que más me preocupa en este momento" | Control de existencias en tiempo real |
| H04 | "Estamos enfocando lo que es la venta mayorista, tanto accesorios como repuesto de celulares" | Diferenciación entre venta minorista y mayorista |
| H05 | "Hacemos una ficha para cada dispositivo y para cada cliente" (en soporte papel) | Digitalización de las órdenes de servicio |
| H11 | "Siempre preferentemente le pedimos el WhatsApp al cliente para poder comunicarnos y hacerle un seguimiento" | Base de clientes con datos de contacto |
| H12 | "Los datos de los clientes más que nada, y las fichas de los celulares, del servicio técnico" (información sensible) | Control de acceso diferenciado por rol |
| H13 | Personal relevado: titular, colaboradora y técnico; decisiones compartidas entre los dos socios | Tres perfiles de usuario diferenciados |
| H14 | "Tenemos varios proveedores... Tecnomóvil, Benjasel, Blanca, son varios" | Registro de proveedores asociados a productos |
| H15 | "Me gustaría que sea algo un poquito más interactivo, que puedas cargar imágenes del producto" | Producto con imagen asociada |
| H16 | "Algunos sistemas que se ofrecen son muy obsoletos... parecen un Excel" | Interfaz moderna y usable |
| H17 | Medios de pago relevados: efectivo y Mercado Pago, plataforma a través de la cual se canalizan también los pagos con transferencia y tarjeta mediante terminal Point Smart instalada en el local | Registro del medio de pago por operación |
| H18 | Volumen operativo consignado por el titular en consulta de seguimiento: 15 a 20 ventas diarias y 3 a 5 órdenes de servicio por día | Base para el dimensionamiento del sistema |
| H19 | "También estamos trabajando con lo que es envíos a domicilio", coordinados por WhatsApp e Instagram | Registro de la modalidad de entrega |
| H21 | "Los tres, PC, celular, impresora" (dispositivos utilizados actualmente en el comercio) | Compatibilidad multiplataforma con el equipamiento informático existente |
| H23 | "Si no tenemos algún stock de un film de vidrio, alguna funda, nos facilita bastante lo que es la IA porque nos encuentra algo similar o algo que se pueda adaptar al celular" | Identificación de productos compatibles o sustitutos ante falta de existencias |
| H24 | "Somos especialistas también en lo que es marca Apple, y por supuesto que Android también" | Catálogo y compatibilidad orientados a las dos plataformas de dispositivos |
| H27 | Consulta de seguimiento al titular: el comercio opera con pago al contado y ofrece tres modalidades de pago en plazos: financiación propia, financiación con tarjeta y financiación a través de Go Cuotas. Observación directa: el local cuenta con terminal Mercado Pago Point Smart, que habilita el cobro con tarjeta | Registro de la modalidad de pago y administración de las cuotas cuando el comercio es quien financia |

## Supuestos aplicables

Lo que no se relevó y se declaró como decisión, en lugar de convertirse en requerimiento.

| ID | Dimensión / Requerimiento asociado | Descripción del supuesto o decisión técnica | Justificación metodológica |
|---|---|---|---|
| S01 | Volumen de catálogo (RNF02) | Se dimensiona y evalúa el tiempo de búsqueda sobre un catálogo simulado de 3.000 artículos | Estimación del equipo para pruebas de estrés y rendimiento; el cliente no precisó la cantidad exacta de artículos en stock |
| S02 | Infraestructura y conectividad (RNF12, RNF15) | Se asume la disponibilidad de red de área local (Wi-Fi/LAN) y acceso estable a internet en el comercio | Condición necesaria para la interoperabilidad entre PC, dispositivos móviles e impresora relevados en H21 |
| S03 | Concurrencia de usuarios (RNF05) | Se establece una concurrencia máxima simultánea de tres usuarios | Derivado de la dotación de personal operativo relevada en H13 (titular, colaboradora y técnico) |
| S05 | Régimen de comprobantes (RF17.1) | Se asume la emisión de comprobantes internos no fiscales en esta etapa | Alcance inicial acordado con el comercio, postergando la integración con controladores fiscales para fases futuras |
| S06 | Arquitectura modular (RNF17) | Estructuración del sistema en módulos independientes y desacoplados | Decisión arquitectónica del equipo de desarrollo basada en buenas prácticas de ingeniería de software |
| S07 | Identificación de productos (RF09, RF16.2) | El comercio no dispone de lector óptico de códigos de barras ni prevé su incorporación en esta etapa; el código interno se emplea como identificador imprimible en etiqueta y como clave de ingreso manual y búsqueda predictiva | Derivado del equipamiento informático relevado en H21, que comprende computadora personal, dispositivo móvil e impresora |
| S09 | Actualización masiva de precios (RF08.4) | Se incorpora la actualización de precios por aplicación de un porcentaje sobre una categoría o marca | Decisión de ingeniería del equipo; no fue solicitada por el cliente, y se adopta por la frecuencia de reajuste que impone el contexto de precios |
| S11 | Integración con la terminal de cobro (RF16.6) | No se especifica integración automática con la terminal Mercado Pago Point Smart; el medio de pago y su importe se registran manualmente en el sistema | Decisión de alcance del equipo: la terminal opera de forma autónoma y su integración excede el alcance de esta etapa |

## Modelo de datos — las 17 tablas de esta iteración

De las 34 que crea el esquema, estas son las que toca la primera iteración. El resto existe en la base pero no se mapea todavía.

| Tabla | Rol | Claves foráneas |
|---|---|---|
| `persona` | Supertipo de usuario y cliente: identidad, documento, WhatsApp, correo, domicilio | — |
| `perfil` | Administrador, Vendedor y Técnico. Precargados | — |
| `modulo` | Los seis módulos del sistema. Precargados | — |
| `permiso` | Asociativa perfil × módulo, con lectura y escritura. Es la matriz de RF03 | `id_perfil` → `perfil`, `id_modulo` → `modulo` |
| `usuario` | Credenciales y perfil asignado | `id_persona` → `persona`, `id_perfil` → `perfil` |
| `sesion` | Tokens emitidos. Sin persistirlos no se puede invalidar una sesión (RF01.2) | `id_usuario` → `usuario` |
| `parametro_sistema` | Prefijo del código interno, minutos de inactividad, plazos y recargos | — |
| `categoria` | Clasificación del catálogo | — |
| `marca` | Clasificación del catálogo | — |
| `producto` | Código interno, tres precios, existencias, mínimo, columna generada y versión | `id_categoria` → `categoria`, `id_marca` → `marca` |
| `movimiento_stock` | Toda variación de existencias con su origen, que es excluyente | `id_producto` → `producto`, `id_usuario` → `usuario`, `id_recepcion` → `recepcion_mercaderia`, `id_venta` → `venta`, `id_orden` → `orden_servicio` |
| `tipo_cliente` | Minorista y Mayorista, con la lista de precios aplicable | — |
| `cliente` | Padrón, especializado de persona | `id_persona` → `persona`, `id_tipo_cliente` → `tipo_cliente` |
| `medio_pago` | Efectivo y Mercado Pago. Precargados | — |
| `venta` | Comprobante, lista aplicada, modalidad de pago, cuotas, entrega, estado y anulación | `id_cliente` → `cliente`, `id_usuario` → `usuario`, `id_usuario_anulacion` → `usuario` |
| `detalle_venta` | Líneas con precio y costo congelados al momento de la operación | `id_venta` → `venta`, `id_producto` → `producto` |
| `pago_venta` | Medio de pago aplicado. Uno por operación | `id_venta` → `venta`, `id_medio_pago` → `medio_pago` |

## Lo que no entra en esta iteración

| Diferido | Motivo |
|---|---|
| Módulo 5 — Servicio técnico (RF20 a RF24) | Es el bloque más extenso de la especificación |
| Módulo 6 — Reportes (RF25 a RF27) | Su utilidad requiere un volumen previo de operaciones registradas |
| RF10 — Recepción de mercadería con OCR | Concentra el mayor riesgo técnico del proyecto |
| RF03 — Perfiles y permisos configurables | Se suple con los tres perfiles relevados en H13, precargados |
| RF29 — Gestión de financiación propia | Depende del circuito de venta ya consolidado |
| RF19 — Pedidos pendientes | Diferido junto con el resto del módulo de ventas ampliado |
| RF14 y RF15 — Historial del cliente y proveedores | No condicionan el circuito de venta |

> El diferimiento no altera la especificación ni su trazabilidad: los requerimientos permanecen especificados y se implementan en etapas posteriores.


## Pendiente antes de escribir código

1. Verificar la instalación de la base con `Seminario\verificar_instalacion.sql` en Workbench. Los dos controles que suelen fallar son las restricciones `CHECK` y las 5 vistas.
2. Crear `backend/.env` con `DB_NAME=gestion_comercial`, que es el esquema que crea el DDL.
3. Resolver en la carpeta la dependencia entre **RF06.7**, que asocia proveedores a un producto, y **RF15**, que quedó diferido. O se difiere también RF06.7, o RF15 sube a esta iteración.
4. Programar la copia de seguridad diaria de **RNF13** en el equipo del comercio.

Lo primero que se construye no es un módulo completo, sino la **rebanada trazadora**: autenticar → listar catálogo paginado → registrar una venta de una línea → emitir el comprobante. Atraviesa las cinco capas y prueba que el esqueleto conecta antes de rellenarlo. El detalle está en [`docs/TESTING.md`](docs/TESTING.md).


---

*Generado desde `Seminario_Britez_Otega_Rivero.docx` y `gestion_comercial_ddl.sql`. 13 requerimientos, 54 operaciones, 16 no funcionales, 18 hallazgos y 8 supuestos.*
