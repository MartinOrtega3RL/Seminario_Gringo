# Testing — Estrategia de pruebas

Iteración 1. Escrito el 09/09/2026 en la fase 7 del recorrido `design-code-architecture`.

Dimensionado para lo que un equipo de tres personas puede sostener en tres meses **mientras además escribe la carpeta**. No promete cobertura total: promete que lo que puede romperse en silencio está cubierto.

---

## Test Strategy — Estrategia

Tres niveles, con esfuerzo muy desparejo a propósito.

### 1. Reglas puras — donde va el grueso de las pruebas

Las funciones de `*.reglas.js` no tocan la base ni la red. Se prueban en milisegundos y no necesitan que nada esté levantado. Es el mejor retorno por hora invertida:

| Regla | Requerimiento | Qué se prueba |
|---|---|---|
| Selección de lista de precios | RF16.5 | Cliente mayorista toma el precio mayorista; minorista el minorista; sin cliente asociado, minorista |
| Cálculo del total de la venta | RF16 | Suma de líneas con cantidades y precios distintos; venta de una sola línea; redondeo a dos decimales |
| Visibilidad del precio de costo | RF04.2 | El perfil Vendedor no recibe `precioCosto` en la respuesta; el Administrador sí |
| Admisibilidad de anulación | RF18.2 | Una venta ya anulada no se puede anular de nuevo |
| Generación del código interno | RF09.1 | Respeta el prefijo `PREFIJO_CODIGO_INTERNO` y no se repite |

### 2. Servicios contra base de pruebas — solo los caminos que pueden corromper datos

Requieren un esquema real, así que son más lentos y son pocos, deliberadamente. Solo lo que deja datos mal si falla:

- **Confirmación de venta** (RF16.7): la venta, sus líneas, sus movimientos y el descuento ocurren todos o ninguno.
- **Existencias insuficientes**: intentar vender más de lo que hay revierte la transacción completa y no deja una venta huérfana.
- **Concurrencia** (RNF05, RNF14): dos confirmaciones simultáneas de la última unidad — una tiene que fallar. Esta es la prueba que justifica el `UPDATE` con guarda; sin ella nadie se entera de que el descuento estaba mal.
- **Anulación** (RF11.4): restituye exactamente lo descontado y deja registrado el responsable.
- **Invariante de existencias**: tras cualquier secuencia de operaciones, `producto.stock_actual` sigue siendo igual a la suma de `movimiento_stock.cantidad`.

### 3. Interfaz — verificación manual guiada

No se automatiza. Con tres personas y tres meses, montar pruebas de navegador cuesta más de lo que devuelve. Se cubre con el manual de usuario recorrido a mano antes de cada entrega, y con los criterios de verificación que la propia especificación ya fija para los RNF de usabilidad (RNF06, RNF07, RNF08).

---

## Safety Net Map — Red de seguridad

### La rebanada trazadora

**Autenticar → listar catálogo paginado → registrar una venta de una línea → emitir el comprobante.**

Es lo primero que se construye, antes de completar ningún módulo. Delgada pero real: se queda en el sistema como código de producción y como primera prueba de punta a punta.

Atraviesa las cinco capas y ejercita las tres decisiones difíciles de revertir:

| Lo que demuestra | Decisión que valida |
|---|---|
| El token se emite, se valida y el middleware resuelve el usuario | El responsable sale del token, no del cuerpo |
| El listado responde paginado | Paginación obligatoria |
| La venta, sus líneas, su movimiento y el descuento ocurren en una transacción | RNF14 e integridad de existencias |
| El comprobante se genera a través de la interfaz, no de la implementación | El único límite completo |
| React consume la API sin conocer Sequelize | La regla de dependencias del frontend |

Si esta rebanada anda, el esqueleto está probado y lo que queda es rellenarlo. Si no anda, no tiene sentido escribir el segundo módulo.

### Cobertura por riesgo

| Zona | Riesgo si falla | Cobertura |
|---|---|---|
| Descuento de existencias | Vender lo que no hay; inventario corrupto | Prueba de concurrencia + invariante |
| Transacción de venta | Venta registrada sin descuento, o al revés | Prueba de integración |
| Precio de costo en respuestas | Fuga de información de rentabilidad a perfiles no habilitados | Prueba de regla pura |
| Permisos en el servidor | Cualquiera invoca cualquier endpoint | Prueba de integración por perfil |
| Contraseñas | Almacenamiento en claro | Inspección de la base, criterio de RNF09 |

---

## CI Gates — Compuertas antes de entregar

**No hay servidor de integración continua ni repositorio remoto.** Decirlo es más honesto que documentar una automatización que no existe. La compuerta es un guion que se corre a mano, y la regla es que se corre **antes de cada entrega y antes de cada demostración**, sin excepción:

1. `npm test` en el backend — reglas puras y servicios. Todo en verde.
2. La rebanada trazadora, de punta a punta, contra una base recién creada desde el DDL.
3. `npm run build` en el frontend — que compile sin advertencias nuevas.
4. Revisión de que ningún listado nuevo quedó sin paginar.

El punto 2 es el que más veces va a atrapar algo: correr contra una base recién creada revela toda dependencia oculta de datos que alguien dejó cargados a mano.
