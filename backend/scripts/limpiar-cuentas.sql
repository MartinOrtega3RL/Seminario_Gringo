-- =====================================================================
--  Limpieza de cuentas de prueba
--  Ejecutar en MySQL Workbench, PARTE POR PARTE. No corras el archivo
--  entero de una: la parte 1 no borra nada y hay que leerla antes.
--
--  ATENCION — esto NO es lo que hace el sistema.
--  El sistema da de baja logica (RF02.3): pone activo = 0 y conserva el
--  registro de operaciones. Este script BORRA de verdad, y existe solo
--  para dejar limpia una base de desarrollo antes de empezar en serio.
--  No lo uses nunca contra la base del comercio.
-- =====================================================================
USE gestion_comercial;


-- =====================================================================
--  PARTE 1 — DIAGNOSTICO. No borra nada. Leer antes de seguir.
-- =====================================================================

-- Que cuentas hay, y que las ata. Cualquier columna con un numero
-- distinto de cero BLOQUEA el borrado: esas diez tablas apuntan a
-- usuario con ON DELETE RESTRICT.
SELECT
  u.id_usuario,
  u.nombre_usuario,
  p.nombre  AS perfil,
  u.activo,
  per.apellido_nombre                                                          AS persona,
  (SELECT COUNT(*) FROM bitacora                WHERE id_usuario = u.id_usuario) AS bitacora,
  (SELECT COUNT(*) FROM venta                   WHERE id_usuario = u.id_usuario) AS ventas,
  (SELECT COUNT(*) FROM venta                   WHERE id_usuario_anulacion = u.id_usuario) AS anulaciones,
  (SELECT COUNT(*) FROM movimiento_stock        WHERE id_usuario = u.id_usuario) AS movimientos,
  (SELECT COUNT(*) FROM recepcion_mercaderia    WHERE id_usuario = u.id_usuario) AS recepciones,
  (SELECT COUNT(*) FROM cuota                   WHERE id_usuario_cobro = u.id_usuario) AS cuotas,
  (SELECT COUNT(*) FROM pedido_pendiente        WHERE id_usuario = u.id_usuario) AS pedidos,
  (SELECT COUNT(*) FROM orden_servicio          WHERE id_usuario_recepcion = u.id_usuario
                                                   OR id_usuario_tecnico  = u.id_usuario) AS ordenes,
  (SELECT COUNT(*) FROM orden_estado_historial  WHERE id_usuario = u.id_usuario) AS historial,
  (SELECT COUNT(*) FROM tarea_realizada         WHERE id_usuario = u.id_usuario) AS tareas,
  (SELECT COUNT(*) FROM sesion                  WHERE id_usuario = u.id_usuario) AS sesiones
FROM usuario u
JOIN perfil  p   ON p.id_perfil   = u.id_perfil
JOIN persona per ON per.id_persona = u.id_persona
ORDER BY u.id_usuario;
-- Nota: `sesiones` NO bloquea. La tabla sesion cae sola por CASCADE.


-- Que personas hay y de que cuelgan. Una persona puede ser usuario,
-- cliente y proveedor a la vez; mientras cuelgue de alguno no se borra.
SELECT
  per.id_persona,
  per.apellido_nombre,
  per.tipo_documento,
  per.numero_documento,
  IF(u.id_usuario   IS NULL, '-', CONCAT('usuario #',   u.id_usuario))   AS es_usuario,
  IF(c.id_cliente   IS NULL, '-', CONCAT('cliente #',   c.id_cliente))   AS es_cliente,
  IF(pr.id_proveedor IS NULL, '-', CONCAT('proveedor #', pr.id_proveedor)) AS es_proveedor
FROM persona per
LEFT JOIN usuario   u  ON u.id_persona  = per.id_persona
LEFT JOIN cliente   c  ON c.id_persona  = per.id_persona
LEFT JOIN proveedor pr ON pr.id_persona = per.id_persona
ORDER BY per.id_persona;


-- =====================================================================
--  PARTE 2 — BORRAR LAS CUENTAS
--
--  Seleccionar desde START TRANSACTION hasta el SELECT de control y
--  ejecutar solo eso (Ctrl+Shift+Enter con el bloque seleccionado).
--  Despues mirar el resultado y recien ahi hacer COMMIT o ROLLBACK.
--
--  Si alguna cuenta tenia ventas o movimientos, el DELETE va a fallar
--  con "Cannot delete or update a parent row". Eso no es un error del
--  script: es la base protegiendo el registro de quien hizo cada
--  operacion. En ese caso, mirar la parte 2-bis.
-- =====================================================================

START TRANSACTION;

-- La bitacora apunta a usuario con RESTRICT: va primero.
DELETE FROM bitacora WHERE id_usuario > 0;

-- Las sesiones caen solas por CASCADE, no hace falta borrarlas.
DELETE FROM usuario WHERE id_usuario > 0;

-- Control: las dos cuentas tienen que dar 0.
SELECT
  (SELECT COUNT(*) FROM usuario) AS usuarios_restantes,
  (SELECT COUNT(*) FROM sesion)  AS sesiones_restantes;

-- Si el resultado es el esperado:
--   COMMIT;
-- Si algo no cuadra:
--   ROLLBACK;


-- =====================================================================
--  PARTE 2-bis — SI EL BORRADO FALLO POR OPERACIONES ASOCIADAS
--
--  Solo tiene sentido en una base de desarrollo con datos de prueba.
--  Borra las ventas y los movimientos de existencias, que es lo unico
--  que la iteracion 1 puede haber generado.
--
--  OJO: esto deja producto.stock_actual desincronizado de
--  movimiento_stock. El UPDATE final lo vuelve a poner en cero, que es
--  el estado coherente con no tener ningun movimiento registrado.
-- =====================================================================

-- START TRANSACTION;
--
-- DELETE FROM movimiento_stock WHERE id_movimiento > 0;
-- DELETE FROM pago_venta       WHERE id_pago > 0;
-- DELETE FROM detalle_venta    WHERE id_detalle > 0;
-- DELETE FROM venta            WHERE id_venta > 0;
-- DELETE FROM bitacora         WHERE id_usuario > 0;
-- DELETE FROM usuario          WHERE id_usuario > 0;
--
-- -- Restablecer el invariante: sin movimientos, el saldo es cero.
-- UPDATE producto SET stock_actual = 0 WHERE id_producto > 0;
--
-- SELECT
--   (SELECT COUNT(*) FROM usuario)          AS usuarios,
--   (SELECT COUNT(*) FROM venta)            AS ventas,
--   (SELECT COUNT(*) FROM movimiento_stock) AS movimientos,
--   (SELECT SUM(stock_actual) FROM producto) AS stock_total;
--
-- COMMIT;   -- o ROLLBACK


-- =====================================================================
--  PARTE 3 — BORRAR LAS PERSONAS QUE QUEDARON SUELTAS   (opcional)
--
--  Dijiste que las personas te interesan menos, asi que esto es aparte.
--  Borra unicamente las que ya no cuelgan de ningun usuario, cliente ni
--  proveedor. Las que siguen en uso no se tocan.
-- =====================================================================

-- START TRANSACTION;
--
-- DELETE per FROM persona per
-- LEFT JOIN usuario   u  ON u.id_persona  = per.id_persona
-- LEFT JOIN cliente   c  ON c.id_persona  = per.id_persona
-- LEFT JOIN proveedor pr ON pr.id_persona = per.id_persona
-- WHERE u.id_usuario IS NULL
--   AND c.id_cliente IS NULL
--   AND pr.id_proveedor IS NULL;
--
-- SELECT COUNT(*) AS personas_restantes FROM persona;
--
-- COMMIT;   -- o ROLLBACK


-- =====================================================================
--  PARTE 4 — REINICIAR LOS CONTADORES               (opcional, cosmetico)
--
--  Sin esto, el proximo usuario no arranca en 1 sino donde habia quedado
--  el contador. No afecta el funcionamiento; sirve para que las capturas
--  de la carpeta salgan prolijas.
--  Solo corre si la tabla quedo vacia.
-- =====================================================================

-- ALTER TABLE usuario  AUTO_INCREMENT = 1;
-- ALTER TABLE persona  AUTO_INCREMENT = 1;
-- ALTER TABLE sesion   AUTO_INCREMENT = 1;
-- ALTER TABLE bitacora AUTO_INCREMENT = 1;


-- =====================================================================
--  Despues de limpiar, volver a crear el administrador desde el backend:
--    npm run crear-administrador
--  El script rechaza correr si ya existe algun Administrador dado de alta.
-- =====================================================================
