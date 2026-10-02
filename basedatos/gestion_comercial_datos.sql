-- =====================================================================
--  "EL GRINGO CELULARES" - Vistas de reportes y datos iniciales
--  Complemento de gestion_comercial_ddl.sql - ejecutar DESPUES de aquel
--
--  Se mantiene separado del DDL para que el diagrama EER importado en
--  Workbench contenga unicamente tablas y no aparezcan las vistas como
--  objetos sueltos sin relaciones.
-- =====================================================================

USE gestion_comercial;


-- =====================================================================
--  MODULO 6 - VISTAS DE REPORTES
--  Resuelven las consultas que la especificacion define de forma
--  explicita y que se repiten en la operacion diaria.
-- =====================================================================

-- RF12.3 / RF26.1 - productos que alcanzaron su nivel minimo
CREATE OR REPLACE VIEW v_stock_bajo_minimo AS
SELECT p.id_producto,
       p.codigo_interno,
       p.denominacion,
       c.nombre AS categoria,
       m.nombre AS marca,
       p.stock_actual,
       p.stock_minimo,
       (p.stock_minimo - p.stock_actual) AS faltante
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
JOIN marca     m ON m.id_marca     = p.id_marca
WHERE p.activo = 1
  AND p.bajo_minimo = 1;

-- RF26.2 - valorizacion del inventario por categoria
CREATE OR REPLACE VIEW v_valorizacion_inventario AS
SELECT c.nombre AS categoria,
       COUNT(*)                                 AS articulos,
       SUM(p.stock_actual)                      AS unidades,
       SUM(p.stock_actual * p.precio_costo)     AS valor_costo,
       SUM(p.stock_actual * p.precio_minorista) AS valor_venta
FROM producto p
JOIN categoria c ON c.id_categoria = p.id_categoria
WHERE p.activo = 1
GROUP BY c.nombre;

-- RF22.2 / RF22.3 / H08 - ordenes notificadas y no retiradas en plazo.
-- El plazo y el porcentaje se leen de parametro_sistema, de modo que un
-- cambio de politica comercial no obligue a modificar la vista.
CREATE OR REPLACE VIEW v_ordenes_no_retiradas AS
SELECT o.id_orden,
       o.numero_orden,
       pe.apellido_nombre   AS cliente,
       pe.telefono_whatsapp,
       o.fecha_notificacion,
       DATEDIFF(CURRENT_DATE, o.fecha_notificacion) AS dias_desde_notificacion,
       o.monto_total,
       ROUND(o.monto_total *
             (SELECT CAST(valor AS DECIMAL(6,2)) / 100
                FROM parametro_sistema WHERE codigo = 'RECARGO_DEMORA_PCT'), 2)
         AS recargo_sugerido
FROM orden_servicio o
JOIN cliente cl ON cl.id_cliente = o.id_cliente
JOIN persona pe ON pe.id_persona = cl.id_persona
WHERE o.fecha_notificacion IS NOT NULL
  AND o.fecha_entrega IS NULL
  AND DATEDIFF(CURRENT_DATE, o.fecha_notificacion) >
      (SELECT CAST(valor AS UNSIGNED)
         FROM parametro_sistema WHERE codigo = 'RETIRO_PLAZO_DIAS');

-- RF25.1 / RF25.2 - ventas por periodo con desglose por medio de pago
CREATE OR REPLACE VIEW v_ventas_por_medio_pago AS
SELECT DATE(v.fecha_hora) AS fecha,
       mp.nombre          AS medio_pago,
       COUNT(DISTINCT v.id_venta) AS operaciones,
       SUM(pv.importe)            AS importe
FROM venta v
JOIN pago_venta pv ON pv.id_venta = v.id_venta
JOIN medio_pago mp ON mp.id_medio_pago = pv.id_medio_pago
WHERE v.estado = 'CONFIRMADA'
GROUP BY DATE(v.fecha_hora), mp.nombre;

-- RF27 - ordenes de servicio por estado y periodo
CREATE OR REPLACE VIEW v_ordenes_por_estado AS
SELECT eo.nombre AS estado,
       COUNT(*)  AS cantidad,
       MIN(o.fecha_ingreso) AS ingreso_mas_antiguo,
       SUM(o.monto_total)   AS monto_acumulado
FROM orden_servicio o
JOIN estado_orden eo ON eo.id_estado = o.id_estado_actual
GROUP BY eo.nombre, eo.orden_secuencia
ORDER BY eo.orden_secuencia;


-- =====================================================================
--  DATOS INICIALES
--  Valores tomados del relevamiento. Sin ellos el sistema no puede
--  operar: no habria perfiles, modulos, permisos ni estados de orden.
-- =====================================================================

-- Perfiles relevados en H13 (titular, colaboradora y tecnico)
INSERT INTO perfil (nombre, descripcion) VALUES
  ('Administrador', 'Acceso total. Unico perfil habilitado para reportes y precios de costo (RF04.2)'),
  ('Vendedor',      'Ventas, clientes, consulta del catalogo y registro de ingresos de mercaderia (H28)'),
  ('Tecnico',       'Servicio tecnico, clientes y consulta del catalogo');

-- Modulos del sistema (RF03.2 / S06)
INSERT INTO modulo (codigo, nombre, descripcion) VALUES
  ('ADMIN_SEGURIDAD',  'Administracion y seguridad', 'Modulo 1 - exclusivo del Administrador'),
  ('CATALOGO_STOCK',   'Catalogo y existencias',     'Modulo 2 - compartido'),
  ('CLIENTES_PROV',    'Clientes y proveedores',     'Modulo 3 - compartido'),
  ('VENTAS',           'Ventas',                     'Modulo 4 - Administrador y Vendedor'),
  ('SERVICIO_TECNICO', 'Servicio tecnico',           'Modulo 5 - Administrador y Tecnico'),
  ('REPORTES',         'Reportes',                   'Modulo 6 - restringido al Administrador');

-- Matriz de permisos (RF03.3 / RF03.4), segun la tabla
-- "Organizacion modular del sistema" de la especificacion
INSERT INTO permiso (id_perfil, id_modulo, permite_lectura, permite_escritura)
SELECT pf.id_perfil, mo.id_modulo, x.lec, x.esc
FROM (
  SELECT 'Administrador' AS perfil, 'ADMIN_SEGURIDAD' AS modulo, 1 AS lec, 1 AS esc UNION ALL
  SELECT 'Administrador', 'CATALOGO_STOCK',   1, 1 UNION ALL
  SELECT 'Administrador', 'CLIENTES_PROV',    1, 1 UNION ALL
  SELECT 'Administrador', 'VENTAS',           1, 1 UNION ALL
  SELECT 'Administrador', 'SERVICIO_TECNICO', 1, 1 UNION ALL
  SELECT 'Administrador', 'REPORTES',         1, 1 UNION ALL
  SELECT 'Vendedor',      'CATALOGO_STOCK',   1, 1 UNION ALL  -- H28
  SELECT 'Vendedor',      'CLIENTES_PROV',    1, 1 UNION ALL
  SELECT 'Vendedor',      'VENTAS',           1, 1 UNION ALL
  SELECT 'Tecnico',       'CATALOGO_STOCK',   1, 0 UNION ALL
  SELECT 'Tecnico',       'CLIENTES_PROV',    1, 1 UNION ALL
  SELECT 'Tecnico',       'SERVICIO_TECNICO', 1, 1
) x
JOIN perfil pf ON pf.nombre  = x.perfil
JOIN modulo mo ON mo.codigo  = x.modulo;

-- Clasificacion de clientes (RF13.5 / H04)
INSERT INTO tipo_cliente (nombre, lista_precio_aplicable) VALUES
  ('Minorista', 'MINORISTA'),
  ('Mayorista', 'MAYORISTA');

-- Medios de pago relevados en H17: el comercio opera con efectivo y Mercado
-- Pago, plataforma que canaliza tambien transferencia y tarjeta mediante la
-- terminal Point Smart instalada en el local. Se desagrega el canal para que
-- RF25.2 pueda informar el desglose.
INSERT INTO medio_pago (nombre) VALUES
  ('Efectivo'),
  ('Mercado Pago - transferencia o QR'),
  ('Mercado Pago - tarjeta (Point Smart)');

-- Ciclo de vida de la orden de servicio (RF21.6)
INSERT INTO estado_orden (codigo, nombre, orden_secuencia, es_final) VALUES
  ('RECIBIDO',       'Recibido',              1, 0),
  ('EN_DIAGNOSTICO', 'En diagnostico',        2, 0),
  ('PRESUPUESTADO',  'Presupuestado',         3, 0),
  ('APROBADO',       'Presupuesto aprobado',  4, 0),
  ('RECHAZADO',      'Presupuesto rechazado', 5, 0),
  ('EN_REPARACION',  'En reparacion',         6, 0),
  ('REPARADO',       'Reparado',              7, 0),
  ('NO_REPARABLE',   'No reparable',          8, 0),
  ('NOTIFICADO',     'Notificado',            9, 0),
  ('ENTREGADO',      'Entregado',            10, 1),
  ('ANULADA',        'Anulada',              11, 1);

-- Parametros de negocio: los valores provienen de la ficha de servicio
-- tecnico vigente del comercio (H07 / H08)
INSERT INTO parametro_sistema (codigo, valor, descripcion) VALUES
  ('GARANTIA_DIAS',          '30',  'H07 - dias corridos de garantia desde la entrega (RF23.1)'),
  ('RETIRO_PLAZO_DIAS',      '10',  'H08 - dias para retirar el equipo desde la notificacion (RF22.2)'),
  ('RECARGO_DEMORA_PCT',     '15',  'H08 - porcentaje de recargo por demora en el retiro (RF22.3)'),
  ('SESION_INACTIVIDAD_MIN', '30',  'RNF11 - minutos de inactividad antes del cierre de sesion'),
  ('PREFIJO_CODIGO_INTERNO', 'EGC', 'RF09.1 / H02 - prefijo de los codigos de barras propios');

-- Categorias y marcas de arranque, derivadas del rubro relevado (H04, H14)
INSERT INTO categoria (nombre) VALUES
  ('Telefonos'), ('Accesorios'), ('Repuestos'), ('Fundas'), ('Vidrios templados'),
  ('Cargadores'), ('Auriculares');

INSERT INTO marca (nombre) VALUES
  ('Apple'), ('Samsung'), ('Xiaomi'), ('Motorola'), ('Generico');
