-- =====================================================================
--  Verificación de la instalación
--  Ejecutar entero en MySQL Workbench (rayo con el ícono de varios rayos,
--  o Ctrl+Shift+Enter). Devuelve un informe: todo debe decir OK.
-- =====================================================================
USE gestion_comercial;

SELECT
  'Esquema y codificación' AS control,
  CONCAT(DEFAULT_CHARACTER_SET_NAME, ' / ', DEFAULT_COLLATION_NAME) AS encontrado,
  'utf8mb4 / utf8mb4_0900_ai_ci' AS esperado,
  IF(DEFAULT_CHARACTER_SET_NAME = 'utf8mb4', 'OK', 'REVISAR') AS estado
FROM information_schema.SCHEMATA
WHERE SCHEMA_NAME = 'gestion_comercial'

UNION ALL SELECT
  'Cantidad de tablas',
  CAST(COUNT(*) AS CHAR), '34',
  IF(COUNT(*) = 34, 'OK', 'REVISAR')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'gestion_comercial' AND TABLE_TYPE = 'BASE TABLE'

UNION ALL SELECT
  'Motor de almacenamiento',
  CONCAT(COUNT(*), ' tablas InnoDB'), '34',
  IF(COUNT(*) = 34, 'OK', 'REVISAR')
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = 'gestion_comercial' AND ENGINE = 'InnoDB'

UNION ALL SELECT
  'Vistas de reportes',
  CAST(COUNT(*) AS CHAR), '5',
  IF(COUNT(*) = 5, 'OK', 'FALTA EJECUTAR gestion_comercial_datos.sql')
FROM information_schema.VIEWS
WHERE TABLE_SCHEMA = 'gestion_comercial'

UNION ALL SELECT
  'Claves foráneas',
  CAST(COUNT(*) AS CHAR), '51 o más',
  IF(COUNT(*) >= 51, 'OK', 'REVISAR')
FROM information_schema.REFERENTIAL_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'gestion_comercial'

UNION ALL SELECT
  'Restricciones CHECK',
  CAST(COUNT(*) AS CHAR), '22 o más',
  IF(COUNT(*) >= 22, 'OK', 'REVISAR: la version de MySQL podria ser anterior a 8.0.16')
FROM information_schema.CHECK_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = 'gestion_comercial'

UNION ALL SELECT
  'Columna generada bajo_minimo',
  IFNULL(MAX(EXTRA), 'no existe'), 'STORED GENERATED',
  IF(MAX(EXTRA) LIKE '%GENERATED%', 'OK', 'REVISAR')
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = 'gestion_comercial'
  AND TABLE_NAME = 'producto' AND COLUMN_NAME = 'bajo_minimo'

UNION ALL SELECT
  'Índice FULLTEXT de búsqueda',
  CAST(COUNT(DISTINCT INDEX_NAME) AS CHAR), '1',
  IF(COUNT(DISTINCT INDEX_NAME) >= 1, 'OK', 'REVISAR')
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = 'gestion_comercial'
  AND TABLE_NAME = 'producto' AND INDEX_TYPE = 'FULLTEXT'

-- ---------- datos de referencia: sin esto el sistema no arranca ----------
UNION ALL SELECT 'Datos · perfiles',        CAST(COUNT(*) AS CHAR), '3',
  IF(COUNT(*) = 3, 'OK', 'REVISAR') FROM perfil
UNION ALL SELECT 'Datos · módulos',         CAST(COUNT(*) AS CHAR), '6',
  IF(COUNT(*) = 6, 'OK', 'REVISAR') FROM modulo
UNION ALL SELECT 'Datos · permisos',        CAST(COUNT(*) AS CHAR), '12 (solo las combinaciones habilitadas)',
  IF(COUNT(*) = 12, 'OK', 'REVISAR') FROM permiso
UNION ALL SELECT 'Datos · tipos de cliente', CAST(COUNT(*) AS CHAR), '2',
  IF(COUNT(*) = 2, 'OK', 'REVISAR') FROM tipo_cliente
UNION ALL SELECT 'Datos · medios de pago',  CAST(COUNT(*) AS CHAR), '3',
  IF(COUNT(*) = 3, 'OK', 'REVISAR') FROM medio_pago
UNION ALL SELECT 'Datos · estados de orden', CAST(COUNT(*) AS CHAR), '7 o mas',
  IF(COUNT(*) >= 7, 'OK', 'REVISAR') FROM estado_orden
UNION ALL SELECT 'Datos · parámetros',      CAST(COUNT(*) AS CHAR), '5',
  IF(COUNT(*) = 5, 'OK', 'REVISAR') FROM parametro_sistema
UNION ALL SELECT 'Datos · categorías',      CAST(COUNT(*) AS CHAR), '1 o mas',
  IF(COUNT(*) >= 1, 'OK', 'REVISAR') FROM categoria
UNION ALL SELECT 'Datos · marcas',          CAST(COUNT(*) AS CHAR), '1 o mas',
  IF(COUNT(*) >= 1, 'OK', 'REVISAR') FROM marca;


-- =====================================================================
--  Las 17 tablas que usa la primera iteración: deben estar todas
-- =====================================================================
SELECT t.nombre AS tabla_esperada,
       IF(i.TABLE_NAME IS NULL, '>>> FALTA <<<', 'OK') AS estado
FROM (
  SELECT 'persona' AS nombre UNION ALL SELECT 'perfil' UNION ALL SELECT 'modulo'
  UNION ALL SELECT 'permiso' UNION ALL SELECT 'usuario' UNION ALL SELECT 'sesion'
  UNION ALL SELECT 'parametro_sistema' UNION ALL SELECT 'categoria'
  UNION ALL SELECT 'marca' UNION ALL SELECT 'producto'
  UNION ALL SELECT 'movimiento_stock' UNION ALL SELECT 'tipo_cliente'
  UNION ALL SELECT 'cliente' UNION ALL SELECT 'medio_pago' UNION ALL SELECT 'venta'
  UNION ALL SELECT 'detalle_venta' UNION ALL SELECT 'pago_venta'
) t
LEFT JOIN information_schema.TABLES i
  ON i.TABLE_SCHEMA = 'gestion_comercial' AND i.TABLE_NAME = t.nombre
ORDER BY estado DESC, t.nombre;


-- =====================================================================
--  Matriz de permisos precargada — es lo que va a leer RF04
-- =====================================================================
SELECT p.nombre AS perfil, m.nombre AS modulo,
       IF(pe.permite_lectura, 'si', 'no')  AS lectura,
       IF(pe.permite_escritura, 'si', 'no') AS escritura
FROM permiso pe
JOIN perfil p ON p.id_perfil = pe.id_perfil
JOIN modulo m ON m.id_modulo = pe.id_modulo
ORDER BY p.id_perfil, m.id_modulo;


-- =====================================================================
--  Parámetros del negocio — los plazos y el recargo de la ficha
-- =====================================================================
SELECT codigo, valor, descripcion FROM parametro_sistema ORDER BY codigo;
