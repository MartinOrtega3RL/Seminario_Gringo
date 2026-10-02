-- =====================================================================
--  SISTEMA DE GESTION INTEGRAL - "EL GRINGO CELULARES"
--  Modelo fisico de datos  |  Esquema: gestion_comercial
--
--  Seminario de Integracion - Universidad de la Cuenca del Plata
--  Facultad de Ingenieria, Tecnologia y Arquitectura
--  Lic. en Sistemas de Informacion - Comision U - Sede Formosa
--  Britez Joaquin Emiliano - Ortega Minardi Martin - Rivero Ruth Camila
--  Profesor: Mtr. Lic. Cristian Fernando Cerquand - Ano 2026
-- =====================================================================
--
--  Motor.......: MySQL 8.0.16 o superior (se emplean restricciones CHECK
--                y columnas generadas)
--  Codificacion: utf8mb4 / utf8mb4_0900_ai_ci
--  Motor tablas: InnoDB - integridad referencial y transacciones (RNF14)
--
--  ORIGEN DEL MODELO
--  Derivado de la Especificacion de Requerimientos del trabajo: 28
--  requerimientos funcionales, 18 no funcionales, 30 hallazgos de
--  relevamiento (H01-H30) y 11 supuestos de dimensionamiento (S01-S11).
--  Cada tabla y cada columna no evidente se comenta con el requerimiento,
--  hallazgo o supuesto que la origina. No se incorporaron estructuras sin
--  respaldo en la especificacion.
--
--  DENORMALIZACIONES CONTROLADAS (intencionales y documentadas)
--    producto.stock_actual ............. acumulado de movimiento_stock
--    producto.bajo_minimo .............. columna generada indexable
--    venta.monto_total ................. suma de detalle_venta
--    orden_servicio.monto_total ........ presupuesto + repuestos + recargo
--    orden_servicio.id_estado_actual ... ultimo estado del historial
--    orden_servicio.fecha_notificacion . ultima transicion a NOTIFICADO
--  Se sostienen por transaccion desde la capa de aplicacion (RF16.7).
--
--  IMPORTAR EN WORKBENCH (no requiere servidor en ejecucion)
--    File > Import > Reverse Engineer MySQL Create Script > este archivo
--    Tildar "Place imported objects on a diagram" para obtener el EER.
--    Database > Reverse Engineer es el asistente para servidor en vivo.
--  Este archivo contiene UNICAMENTE tablas, para que el diagrama EER
--  quede limpio. Las vistas de reportes y los datos iniciales estan en
--  gestion_comercial_datos.sql y se ejecutan despues.
-- =====================================================================

DROP DATABASE IF EXISTS gestion_comercial;
CREATE DATABASE gestion_comercial
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_0900_ai_ci;
USE gestion_comercial;


-- =====================================================================
--  NUCLEO COMUN
-- =====================================================================

-- ---------------------------------------------------------------------
-- persona : supertipo de usuario, cliente y proveedor.
-- Evita repetir los datos de contacto en los tres subtipos y permite que
-- una misma persona sea a la vez cliente y usuario del sistema.
-- ---------------------------------------------------------------------
CREATE TABLE persona (
  id_persona         INT           NOT NULL AUTO_INCREMENT,
  apellido_nombre    VARCHAR(150)  NOT NULL  COMMENT 'Apellido y nombre, o razon social',
  tipo_persona       ENUM('FISICA','JURIDICA') NOT NULL DEFAULT 'FISICA',
  tipo_documento     ENUM('DNI','CUIT','CUIL','PASAPORTE','OTRO') NULL,
  numero_documento   VARCHAR(20)   NULL,
  telefono_whatsapp  VARCHAR(30)   NULL  COMMENT 'RF13.6 / H11 - canal de contacto y seguimiento del comercio',
  correo             VARCHAR(120)  NULL,
  domicilio          VARCHAR(200)  NULL,
  creado_en          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_persona),
  UNIQUE KEY uk_persona_documento (tipo_documento, numero_documento),
  KEY ix_persona_apellido_nombre (apellido_nombre),
  KEY ix_persona_whatsapp (telefono_whatsapp)
) ENGINE=InnoDB
  COMMENT='Supertipo de usuarios, clientes y proveedores';


-- =====================================================================
--  MODULO 1 - ADMINISTRACION Y SEGURIDAD  (RF01 a RF05)
-- =====================================================================

-- ---------------------------------------------------------------------
-- perfil : RF03.1 - Administrador, Vendedor y Tecnico (H13)
-- ---------------------------------------------------------------------
CREATE TABLE perfil (
  id_perfil    INT          NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(50)  NOT NULL,
  descripcion  VARCHAR(200) NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id_perfil),
  UNIQUE KEY uk_perfil_nombre (nombre)
) ENGINE=InnoDB
  COMMENT='RF03.1 - Perfiles de acceso al sistema';

-- ---------------------------------------------------------------------
-- modulo : RF03.2 / S06 - unidades habilitables. Materializa en la base
-- la estructura modular que S06 establece como decision arquitectonica.
-- ---------------------------------------------------------------------
CREATE TABLE modulo (
  id_modulo    INT          NOT NULL AUTO_INCREMENT,
  codigo       VARCHAR(40)  NOT NULL  COMMENT 'Clave estable que el servidor usa al validar permisos (RNF18)',
  nombre       VARCHAR(80)  NOT NULL,
  descripcion  VARCHAR(200) NULL,
  PRIMARY KEY (id_modulo),
  UNIQUE KEY uk_modulo_codigo (codigo)
) ENGINE=InnoDB
  COMMENT='RF03.2 / S06 - Modulos del sistema susceptibles de habilitacion';

-- ---------------------------------------------------------------------
-- permiso : RF03.3 - asociativa perfil x modulo.
-- La matriz vigente que consulta RF03.4 es esta tabla.
-- ---------------------------------------------------------------------
CREATE TABLE permiso (
  id_perfil          INT        NOT NULL,
  id_modulo          INT        NOT NULL,
  permite_lectura    TINYINT(1) NOT NULL DEFAULT 0,
  permite_escritura  TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id_perfil, id_modulo),
  KEY fk_permiso_modulo (id_modulo),
  CONSTRAINT fk_permiso_perfil FOREIGN KEY (id_perfil)
    REFERENCES perfil (id_perfil) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_permiso_modulo FOREIGN KEY (id_modulo)
    REFERENCES modulo (id_modulo) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_permiso_coherente
    CHECK (permite_escritura = 0 OR permite_lectura = 1)
) ENGINE=InnoDB
  COMMENT='RF03.3 / RF03.4 - Permisos de lectura y escritura por perfil y modulo';

-- ---------------------------------------------------------------------
-- usuario : RF02
-- ---------------------------------------------------------------------
CREATE TABLE usuario (
  id_usuario       INT          NOT NULL AUTO_INCREMENT,
  id_persona       INT          NOT NULL,
  id_perfil        INT          NOT NULL  COMMENT 'RF02.4 - asignacion de perfil',
  nombre_usuario   VARCHAR(50)  NOT NULL,
  contrasena_hash  VARCHAR(255) NOT NULL  COMMENT 'RNF09 - hash con sal (bcrypt / Argon2). Nunca texto plano',
  activo           TINYINT(1)   NOT NULL DEFAULT 1  COMMENT 'RF02.3 - baja logica: conserva el historial de operaciones',
  creado_en        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_usuario),
  UNIQUE KEY uk_usuario_persona (id_persona),
  UNIQUE KEY uk_usuario_nombre (nombre_usuario),
  KEY fk_usuario_perfil (id_perfil),
  CONSTRAINT fk_usuario_persona FOREIGN KEY (id_persona)
    REFERENCES persona (id_persona) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_usuario_perfil FOREIGN KEY (id_perfil)
    REFERENCES perfil (id_perfil) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF02 - Usuarios del sistema';

-- ---------------------------------------------------------------------
-- sesion : RF01.1 / RF01.2 / RNF11
-- La especificacion exige emitir e invalidar un token de sesion, y cerrarla
-- por inactividad. Sin persistir la sesion el servidor no puede invalidar un
-- token ya emitido. La renovacion de sesion se retiro de la especificacion.
-- ---------------------------------------------------------------------
CREATE TABLE sesion (
  id_sesion         BIGINT       NOT NULL AUTO_INCREMENT,
  id_usuario        INT          NOT NULL,
  token_hash        VARCHAR(255) NOT NULL  COMMENT 'RF01.1 - se almacena el hash del token, nunca el token',
  fecha_inicio      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_ultimo_uso  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP  COMMENT 'RNF11 - base del calculo de inactividad',
  fecha_expiracion  DATETIME     NOT NULL  COMMENT 'RF01.2 / RNF11 - vencimiento de la sesion',
  fecha_cierre      DATETIME     NULL      COMMENT 'RF01.2 - nulo mientras la sesion esta vigente',
  motivo_cierre     ENUM('LOGOUT','INACTIVIDAD','EXPIRACION','REVOCADA') NULL,
  direccion_ip      VARCHAR(45)  NULL      COMMENT 'IPv4 o IPv6',
  PRIMARY KEY (id_sesion),
  UNIQUE KEY uk_sesion_token (token_hash),
  KEY ix_sesion_usuario_vigente (id_usuario, fecha_cierre),
  KEY ix_sesion_expiracion (fecha_expiracion),
  CONSTRAINT fk_sesion_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF01 - Sesiones vigentes y cerradas';

-- ---------------------------------------------------------------------
-- bitacora : RF05 - operaciones criticas con usuario, fecha y accion.
-- Los snapshots JSON permiten reconstruir que cambio exactamente, que es
-- lo que da valor probatorio a la bitacora frente a H12.
-- ---------------------------------------------------------------------
CREATE TABLE bitacora (
  id_bitacora       BIGINT       NOT NULL AUTO_INCREMENT,
  id_usuario        INT          NOT NULL,
  fecha_hora        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  entidad_afectada  VARCHAR(60)  NOT NULL  COMMENT 'Nombre de la tabla afectada',
  id_registro       BIGINT       NULL      COMMENT 'Clave primaria del registro afectado',
  accion            ENUM('ALTA','MODIFICACION','BAJA','ANULACION','LOGIN','LOGOUT','AJUSTE') NOT NULL,
  datos_antes       JSON         NULL      COMMENT 'Estado previo del registro',
  datos_despues     JSON         NULL      COMMENT 'Estado posterior del registro',
  detalle           VARCHAR(300) NULL,
  direccion_ip      VARCHAR(45)  NULL,
  PRIMARY KEY (id_bitacora),
  KEY ix_bitacora_fecha (fecha_hora),
  KEY ix_bitacora_entidad (entidad_afectada, id_registro),
  KEY fk_bitacora_usuario (id_usuario),
  CONSTRAINT fk_bitacora_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF05 - Bitacora de operaciones criticas';

-- ---------------------------------------------------------------------
-- parametro_sistema : H07 / H08 / RNF16
-- Los plazos y el recargo provienen de la ficha de servicio tecnico que
-- el comercio ya tiene formalizada: 30 dias de garantia, 10 dias para
-- retirar, 15% de recargo. Se parametrizan para que un cambio de politica
-- comercial no exija modificar el codigo.
-- ---------------------------------------------------------------------
CREATE TABLE parametro_sistema (
  codigo          VARCHAR(50)  NOT NULL,
  valor           VARCHAR(100) NOT NULL,
  descripcion     VARCHAR(200) NULL,
  actualizado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (codigo)
) ENGINE=InnoDB
  COMMENT='H07 / H08 / RNF16 - Parametros de negocio configurables';


-- =====================================================================
--  MODULO 3 - CLIENTES Y PROVEEDORES  (RF13 a RF15)
--  Se define antes que catalogo y ventas por dependencias de clave foranea
-- =====================================================================

-- ---------------------------------------------------------------------
-- tipo_cliente : RF13.5 - determina la lista de precios aplicable (H04)
-- ---------------------------------------------------------------------
CREATE TABLE tipo_cliente (
  id_tipo_cliente        INT         NOT NULL AUTO_INCREMENT,
  nombre                 VARCHAR(30) NOT NULL,
  lista_precio_aplicable ENUM('MINORISTA','MAYORISTA') NOT NULL
                           COMMENT 'RF16.5 - precio que la venta aplica automaticamente',
  PRIMARY KEY (id_tipo_cliente),
  UNIQUE KEY uk_tipo_cliente_nombre (nombre)
) ENGINE=InnoDB
  COMMENT='RF13.5 - Clasificacion minorista / mayorista';

-- ---------------------------------------------------------------------
-- cliente : RF13 - padron unico, compartido por ventas y servicio tecnico
-- ---------------------------------------------------------------------
CREATE TABLE cliente (
  id_cliente       INT          NOT NULL AUTO_INCREMENT,
  id_persona       INT          NOT NULL,
  id_tipo_cliente  INT          NOT NULL,
  fecha_alta       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observaciones    VARCHAR(300) NULL,
  activo           TINYINT(1)   NOT NULL DEFAULT 1  COMMENT 'RF13.3 - baja logica',
  PRIMARY KEY (id_cliente),
  UNIQUE KEY uk_cliente_persona (id_persona),
  KEY fk_cliente_tipo (id_tipo_cliente),
  CONSTRAINT fk_cliente_persona FOREIGN KEY (id_persona)
    REFERENCES persona (id_persona) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_cliente_tipo FOREIGN KEY (id_tipo_cliente)
    REFERENCES tipo_cliente (id_tipo_cliente) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF13 - Padron unico de clientes del comercio';

-- ---------------------------------------------------------------------
-- proveedor : RF15 (H14 - Tecnomovil, Benjasel, Blanca, entre otros)
-- ---------------------------------------------------------------------
CREATE TABLE proveedor (
  id_proveedor   INT          NOT NULL AUTO_INCREMENT,
  id_persona     INT          NOT NULL,
  sitio_web      VARCHAR(200) NULL  COMMENT 'H14 - algunos pedidos se cursan por la web del proveedor',
  observaciones  VARCHAR(300) NULL,
  fecha_alta     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  activo         TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (id_proveedor),
  UNIQUE KEY uk_proveedor_persona (id_persona),
  CONSTRAINT fk_proveedor_persona FOREIGN KEY (id_persona)
    REFERENCES persona (id_persona) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF15 - Proveedores del comercio';


-- =====================================================================
--  MODULO 2 - CATALOGO Y EXISTENCIAS  (RF06 a RF12)
-- =====================================================================

-- ---------------------------------------------------------------------
-- categoria : RF07.1
-- ---------------------------------------------------------------------
CREATE TABLE categoria (
  id_categoria INT         NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(60) NOT NULL,
  activo       TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uk_categoria_nombre (nombre)
) ENGINE=InnoDB
  COMMENT='RF07.1 - Categorias de productos';

-- ---------------------------------------------------------------------
-- marca : RF07.2 - compartida por productos y modelos de dispositivo
-- ---------------------------------------------------------------------
CREATE TABLE marca (
  id_marca INT         NOT NULL AUTO_INCREMENT,
  nombre   VARCHAR(60) NOT NULL,
  activo   TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id_marca),
  UNIQUE KEY uk_marca_nombre (nombre)
) ENGINE=InnoDB
  COMMENT='RF07.2 - Marcas de productos y dispositivos';

-- ---------------------------------------------------------------------
-- modelo_dispositivo : sirve a RF06.8 (compatibilidad de repuestos) y a
-- RF20.3 (equipo que ingresa a servicio tecnico). La marca llega por
-- transitividad desde el modelo.
-- ---------------------------------------------------------------------
CREATE TABLE modelo_dispositivo (
  id_modelo          INT         NOT NULL AUTO_INCREMENT,
  id_marca           INT         NOT NULL,
  denominacion       VARCHAR(80) NOT NULL,
  sistema_operativo  ENUM('ANDROID','IOS','OTRO') NULL,
  PRIMARY KEY (id_modelo),
  UNIQUE KEY uk_modelo_marca_denom (id_marca, denominacion),
  CONSTRAINT fk_modelo_marca FOREIGN KEY (id_marca)
    REFERENCES marca (id_marca) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='Modelos de dispositivo (el comercio trabaja Apple y Android)';

-- ---------------------------------------------------------------------
-- producto : RF06
-- Las tres columnas de precio responden a las dos listas relevadas (H04)
-- mas el costo. No se modela una tabla de listas de precios porque el
-- relevamiento no evidencio mas de dos.
-- El indice FULLTEXT y los indices compuestos estan dimensionados para el
-- volumen del supuesto S01 (3.000 articulos) y el limite de RNF02 (2 s).
-- ---------------------------------------------------------------------
CREATE TABLE producto (
  id_producto        INT           NOT NULL AUTO_INCREMENT,
  id_categoria       INT           NOT NULL,
  id_marca           INT           NOT NULL,
  codigo_interno     VARCHAR(30)   NOT NULL  COMMENT 'RF09.1 / H02 - codigo de barras propio, generado por el sistema',
  denominacion       VARCHAR(150)  NOT NULL,
  descripcion        TEXT          NULL,
  imagen_ruta        VARCHAR(255)  NULL      COMMENT 'RF06.6 / H15 - imagen del producto',
  precio_costo       DECIMAL(12,2) NOT NULL DEFAULT 0.00
                       COMMENT 'RF08.1 / RF04.2 - visible solo para perfiles habilitados',
  precio_minorista   DECIMAL(12,2) NOT NULL DEFAULT 0.00  COMMENT 'RF08.2',
  precio_mayorista   DECIMAL(12,2) NOT NULL DEFAULT 0.00  COMMENT 'RF08.3',
  stock_actual       INT           NOT NULL DEFAULT 0
                       COMMENT 'Derivado de movimiento_stock - denormalizacion controlada (RNF02)',
  stock_minimo       INT           NOT NULL DEFAULT 0     COMMENT 'RF12.2 - umbral de alerta',
  bajo_minimo        TINYINT(1) GENERATED ALWAYS AS (stock_actual <= stock_minimo) STORED
                       COMMENT 'RF12.3 - columna generada. La condicion compara dos columnas, que MySQL no resuelve por indice; materializarla la vuelve indexable',
  version_registro   INT           NOT NULL DEFAULT 1
                       COMMENT 'S03 / RNF05 / RNF14 - bloqueo optimista: impide que dos operaciones simultaneas pisen el stock',
  activo             TINYINT(1)    NOT NULL DEFAULT 1     COMMENT 'RF06.3 - baja logica',
  creado_en          DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto),
  UNIQUE KEY uk_producto_codigo_interno (codigo_interno),
  KEY ix_producto_categoria_activo (id_categoria, activo),
  KEY ix_producto_marca_activo (id_marca, activo),
  KEY ix_producto_bajo_minimo (activo, bajo_minimo)
    COMMENT 'RF12.3 / RF26.1 - productos que alcanzaron el nivel minimo',
  FULLTEXT KEY ft_producto_busqueda (denominacion, descripcion)
    COMMENT 'RF06.5 / RNF02 / S01 - busqueda por texto bajo 2 s sobre 3.000 articulos',
  CONSTRAINT fk_producto_categoria FOREIGN KEY (id_categoria)
    REFERENCES categoria (id_categoria) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_producto_marca FOREIGN KEY (id_marca)
    REFERENCES marca (id_marca) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_producto_precios CHECK (
    precio_costo >= 0 AND precio_minorista >= 0 AND precio_mayorista >= 0
  ),
  CONSTRAINT ck_producto_stock_minimo CHECK (stock_minimo >= 0)
) ENGINE=InnoDB
  COMMENT='RF06 - Catalogo de productos';

-- ---------------------------------------------------------------------
-- producto_modelo_compatible : RF06.8
-- ---------------------------------------------------------------------
CREATE TABLE producto_modelo_compatible (
  id_producto INT NOT NULL,
  id_modelo   INT NOT NULL,
  PRIMARY KEY (id_producto, id_modelo),
  KEY fk_compat_modelo (id_modelo),
  CONSTRAINT fk_compat_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_compat_modelo FOREIGN KEY (id_modelo)
    REFERENCES modelo_dispositivo (id_modelo) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF06.8 - Modelos de dispositivo compatibles con cada producto';

-- ---------------------------------------------------------------------
-- producto_proveedor : RF06.7 / RF15.2
-- ---------------------------------------------------------------------
CREATE TABLE producto_proveedor (
  id_producto       INT           NOT NULL,
  id_proveedor      INT           NOT NULL,
  actualizado_en    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_producto, id_proveedor),
  KEY fk_prodprov_proveedor (id_proveedor),
  CONSTRAINT fk_prodprov_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_prodprov_proveedor FOREIGN KEY (id_proveedor)
    REFERENCES proveedor (id_proveedor) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF06.7 - Proveedores asociados a cada producto';

-- ---------------------------------------------------------------------
-- recepcion_mercaderia : RF10.1
-- Cabecera del comprobante de ingreso. El estado separa la carga (manual,
-- por OCR o por planilla) de la confirmacion que impacta las existencias,
-- que es lo que exige RF10.3.
-- ---------------------------------------------------------------------
CREATE TABLE recepcion_mercaderia (
  id_recepcion        INT           NOT NULL AUTO_INCREMENT,
  id_proveedor        INT           NOT NULL,
  id_usuario          INT           NOT NULL,
  tipo_comprobante    ENUM('FACTURA','REMITO','OTRO') NOT NULL DEFAULT 'FACTURA',
  numero_comprobante  VARCHAR(40)   NULL,
  fecha_comprobante   DATE          NULL,
  fecha_registro      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  origen_carga        ENUM('MANUAL','OCR') NOT NULL DEFAULT 'MANUAL'
                        COMMENT 'RF10.1 / RF10.2 - H20 exige carga masiva sin digitacion manual',
  imagen_comprobante  VARCHAR(255)  NULL  COMMENT 'RF10.2 - imagen o PDF digitalizado del comprobante',
  estado              ENUM('PENDIENTE_VALIDACION','CONFIRMADA','ANULADA')
                        NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
  monto_total         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  fecha_confirmacion  DATETIME      NULL  COMMENT 'RF10.3 - momento en que impacto existencias',
  PRIMARY KEY (id_recepcion),
  UNIQUE KEY uk_recepcion_comprobante (id_proveedor, tipo_comprobante, numero_comprobante),
  KEY ix_recepcion_estado (estado),
  KEY fk_recepcion_usuario (id_usuario),
  CONSTRAINT fk_recepcion_proveedor FOREIGN KEY (id_proveedor)
    REFERENCES proveedor (id_proveedor) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_recepcion_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF10 - Comprobantes de recepcion de mercaderia';

-- ---------------------------------------------------------------------
-- ocr_extraccion : RF10.2 / S04
-- S04 asume que las facturas de los proveedores mayoristas tienen formato
-- tabular legible; confianza_promedio permite medir si ese supuesto se
-- sostiene en la practica.
-- ---------------------------------------------------------------------
CREATE TABLE ocr_extraccion (
  id_extraccion        INT           NOT NULL AUTO_INCREMENT,
  id_recepcion         INT           NOT NULL,
  fecha_procesamiento  DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  motor_ocr            VARCHAR(60)   NULL,
  texto_extraido       LONGTEXT      NULL,
  confianza_promedio   DECIMAL(5,2)  NULL  COMMENT 'S04 - porcentaje informado por el motor; mide la validez del supuesto',
  estado               ENUM('PROCESADO','ERROR') NOT NULL DEFAULT 'PROCESADO',
  mensaje_error        VARCHAR(300)  NULL,
  PRIMARY KEY (id_extraccion),
  KEY fk_ocr_recepcion (id_recepcion),
  CONSTRAINT fk_ocr_recepcion FOREIGN KEY (id_recepcion)
    REFERENCES recepcion_mercaderia (id_recepcion) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT ck_ocr_confianza
    CHECK (confianza_promedio IS NULL OR (confianza_promedio BETWEEN 0 AND 100))
) ENGINE=InnoDB
  COMMENT='RF10.2 / S04 - Resultado del procesamiento OCR del comprobante';

-- ---------------------------------------------------------------------
-- detalle_recepcion : RF10.1 / RF10.2 / RF10.3
-- id_producto queda nulo mientras la linea extraida por OCR no fue
-- asociada a un articulo del catalogo; descripcion_original conserva el
-- texto crudo para que el usuario pueda resolver esa asociacion.
-- ---------------------------------------------------------------------
CREATE TABLE detalle_recepcion (
  id_detalle_recepcion  INT           NOT NULL AUTO_INCREMENT,
  id_recepcion          INT           NOT NULL,
  id_producto           INT           NULL  COMMENT 'Nulo hasta que la linea se asocia a un producto',
  descripcion_original  VARCHAR(200)  NULL  COMMENT 'RF10.2 - texto tal como fue extraido del comprobante',
  cantidad              INT           NOT NULL,
  precio_costo          DECIMAL(12,2) NOT NULL,
  validado              TINYINT(1)    NOT NULL DEFAULT 0  COMMENT 'RF10.3 - revisado y confirmado por el usuario',
  PRIMARY KEY (id_detalle_recepcion),
  KEY ix_detrecep_recepcion (id_recepcion),
  KEY fk_detrecep_producto (id_producto),
  CONSTRAINT fk_detrecep_recepcion FOREIGN KEY (id_recepcion)
    REFERENCES recepcion_mercaderia (id_recepcion) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detrecep_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_detrecep_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_detrecep_costo CHECK (precio_costo >= 0)
) ENGINE=InnoDB
  COMMENT='RF10.1 - Lineas de detalle del comprobante de recepcion';


-- =====================================================================
--  MODULO 4 - VENTAS  (RF16 a RF19)
-- =====================================================================

-- ---------------------------------------------------------------------
-- medio_pago : RF16.6 (H17 - efectivo, transferencia, tarjeta, Mercado Pago)
-- ---------------------------------------------------------------------
CREATE TABLE medio_pago (
  id_medio_pago INT         NOT NULL AUTO_INCREMENT,
  nombre        VARCHAR(40) NOT NULL,
  activo        TINYINT(1)  NOT NULL DEFAULT 1,
  PRIMARY KEY (id_medio_pago),
  UNIQUE KEY uk_medio_pago_nombre (nombre)
) ENGINE=InnoDB
  COMMENT='RF16.6 / H17 - Medios de pago aceptados';

-- ---------------------------------------------------------------------
-- venta : RF16
-- id_cliente admite NULL: el comercio registra entre 15 y 20 ventas
-- diarias (H18) y exigir la identificacion del comprador en cada una
-- detendria el mostrador. Sin cliente asociado se aplica la lista
-- minorista.
-- numero_comprobante es interno y no fiscal, conforme al supuesto S05.
-- ---------------------------------------------------------------------
CREATE TABLE venta (
  id_venta              INT           NOT NULL AUTO_INCREMENT,
  id_cliente            INT           NULL
                          COMMENT 'RF16.4 - nulo en venta a consumidor no identificado',
  id_usuario            INT           NOT NULL  COMMENT 'Vendedor responsable de la operacion',
  numero_comprobante    VARCHAR(20)   NOT NULL
                          COMMENT 'RF17.1 / S05 - comprobante interno no fiscal',
  fecha_hora            DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  lista_precio_aplicada ENUM('MINORISTA','MAYORISTA') NOT NULL DEFAULT 'MINORISTA'
                          COMMENT 'RF16.5 - se congela la lista usada, aunque el cliente cambie de tipo despues',
  monto_total           DECIMAL(12,2) NOT NULL DEFAULT 0.00
                          COMMENT 'Derivado de detalle_venta - denormalizacion controlada',
  modalidad_pago        ENUM('CONTADO','FINANCIACION_PROPIA','TARJETA_CUOTAS','GO_CUOTAS')
                          NOT NULL DEFAULT 'CONTADO'
                          COMMENT 'RF16.8 / H27 - con tarjeta y Go Cuotas financia un tercero y el comercio percibe el total; solo FINANCIACION_PROPIA deja saldo a cobrar',
  cantidad_cuotas       TINYINT UNSIGNED NULL
                          COMMENT 'RF16.8 - nulo cuando la modalidad es CONTADO',
  recargo_financiacion  DECIMAL(12,2) NOT NULL DEFAULT 0.00
                          COMMENT 'S10 - recargo sobre el precio de contado; queda en cero hasta confirmar si el comercio aplica interes',
  modalidad_entrega     ENUM('RETIRO_LOCAL','ENVIO_DOMICILIO') NOT NULL DEFAULT 'RETIRO_LOCAL'
                          COMMENT 'RF17.3 / H19 - el comercio trabaja envios a domicilio',
  domicilio_entrega     VARCHAR(200)  NULL
                          COMMENT 'RF17.3 - destino del envio; puede diferir del domicilio del cliente',
  estado                ENUM('CONFIRMADA','ANULADA') NOT NULL DEFAULT 'CONFIRMADA',
  id_usuario_anulacion  INT           NULL  COMMENT 'RF18.2 - responsable de la anulacion',
  fecha_anulacion       DATETIME      NULL  COMMENT 'RF18.2',
  motivo_anulacion      VARCHAR(300)  NULL,
  PRIMARY KEY (id_venta),
  UNIQUE KEY uk_venta_comprobante (numero_comprobante),
  KEY ix_venta_fecha_estado (fecha_hora, estado)
    COMMENT 'RF18.1 / RF25.1 - historial y reporte de ventas por periodo',
  KEY ix_venta_cliente (id_cliente)
    COMMENT 'RF14.1 - historial de compras del cliente',
  KEY fk_venta_usuario (id_usuario),
  KEY fk_venta_usuario_anulacion (id_usuario_anulacion),
  CONSTRAINT fk_venta_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_venta_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_venta_usuario_anulacion FOREIGN KEY (id_usuario_anulacion)
    REFERENCES usuario (id_usuario),
  CONSTRAINT ck_venta_monto CHECK (monto_total >= 0),
  CONSTRAINT ck_venta_anulacion CHECK (
    (estado = 'ANULADA'   AND id_usuario_anulacion IS NOT NULL AND fecha_anulacion IS NOT NULL)
 OR (estado = 'CONFIRMADA' AND id_usuario_anulacion IS NULL     AND fecha_anulacion IS NULL)
  ),
  CONSTRAINT ck_venta_cuotas CHECK (
    (modalidad_pago = 'CONTADO' AND cantidad_cuotas IS NULL)
    OR (modalidad_pago <> 'CONTADO' AND cantidad_cuotas >= 1)
  ),
  CONSTRAINT ck_venta_envio CHECK (
    modalidad_entrega = 'RETIRO_LOCAL' OR domicilio_entrega IS NOT NULL
  )
) ENGINE=InnoDB
  COMMENT='RF16 - Operaciones de venta';

-- ---------------------------------------------------------------------
-- detalle_venta : RF16.2 / RF16.3
-- costo_unitario se congela junto al precio: sin el costo historico no se
-- puede calcular la rentabilidad cuya visualizacion RF04.2 restringe.
-- ---------------------------------------------------------------------
CREATE TABLE detalle_venta (
  id_detalle       INT           NOT NULL AUTO_INCREMENT,
  id_venta         INT           NOT NULL,
  id_producto      INT           NOT NULL,
  cantidad         INT           NOT NULL,
  precio_unitario  DECIMAL(12,2) NOT NULL  COMMENT 'Precio congelado al momento de la venta',
  costo_unitario   DECIMAL(12,2) NOT NULL DEFAULT 0.00
                     COMMENT 'RF04.2 - costo congelado, base del calculo de rentabilidad',
  PRIMARY KEY (id_detalle),
  KEY ix_detventa_venta (id_venta),
  KEY ix_detventa_producto (id_producto)
    COMMENT 'RF18.1 / RF25.1 - ventas por producto y por periodo',
  CONSTRAINT fk_detventa_venta FOREIGN KEY (id_venta)
    REFERENCES venta (id_venta) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_detventa_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_detventa_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_detventa_precio CHECK (precio_unitario >= 0 AND costo_unitario >= 0)
) ENGINE=InnoDB
  COMMENT='RF16 - Lineas de la venta';

-- ---------------------------------------------------------------------
-- pago_venta : RF16.6
-- La especificacion registra un unico medio de pago por operacion: el pago
-- combinado se retiro por falta de evidencia en el relevamiento. La clave
-- UNIQUE sobre id_venta hace que el modelo admita exactamente eso.
-- REVISAR si se confirma que el comercio financia el plan ahorro (S10): en
-- ese caso cada cuota cobrada seria una fila y la UNIQUE debe retirarse.
-- ---------------------------------------------------------------------
CREATE TABLE pago_venta (
  id_pago       INT           NOT NULL AUTO_INCREMENT,
  id_venta      INT           NOT NULL,
  id_medio_pago INT           NOT NULL,
  importe       DECIMAL(12,2) NOT NULL,
  referencia    VARCHAR(60)   NULL  COMMENT 'Numero de operacion de transferencia, tarjeta o Mercado Pago',
  PRIMARY KEY (id_pago),
  UNIQUE KEY uk_pagoventa_venta (id_venta)
    COMMENT 'RF16.6 - un unico medio de pago por operacion',
  KEY ix_pagoventa_medio (id_medio_pago)
    COMMENT 'RF25.2 - desglose de las ventas del periodo por medio de pago',
  CONSTRAINT fk_pagoventa_venta FOREIGN KEY (id_venta)
    REFERENCES venta (id_venta) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_pagoventa_medio FOREIGN KEY (id_medio_pago)
    REFERENCES medio_pago (id_medio_pago) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_pagoventa_importe CHECK (importe > 0)
) ENGINE=InnoDB
  COMMENT='RF16.6 - Pago aplicado a la venta';

-- ---------------------------------------------------------------------
-- cuota : RF29
-- Solo las ventas con modalidad_pago = 'FINANCIACION_PROPIA' generan
-- cuotas: con tarjeta y con Go Cuotas financia un tercero y el comercio
-- percibe el total en el momento de la operacion.
-- S10: cada cuota se salda en un unico cobro, de modo que el cobro se
-- registra en la propia fila y no hace falta una entidad adicional.
-- ---------------------------------------------------------------------
CREATE TABLE cuota (
  id_cuota          INT              NOT NULL AUTO_INCREMENT,
  id_venta          INT              NOT NULL,
  numero_cuota      TINYINT UNSIGNED NOT NULL
                      COMMENT 'RF29.1 - posicion dentro del plan, desde 1',
  fecha_vencimiento DATE             NOT NULL
                      COMMENT 'RF29.1 / RF29.3 - base para identificar las cuotas vencidas',
  importe           DECIMAL(12,2)    NOT NULL
                      COMMENT 'RF29.1 - monto de la venta mas recargo, dividido por la cantidad de cuotas',
  fecha_cobro       DATETIME         NULL
                      COMMENT 'RF29.2 - nulo mientras la cuota esta pendiente',
  id_medio_pago     INT              NULL  COMMENT 'RF29.2 - medio con el que se salda la cuota',
  id_usuario_cobro  INT              NULL  COMMENT 'RF29.2 - responsable del cobro',
  PRIMARY KEY (id_cuota),
  UNIQUE KEY uk_cuota_venta_numero (id_venta, numero_cuota),
  KEY ix_cuota_pendientes (fecha_cobro, fecha_vencimiento)
    COMMENT 'RF29.3 - cuotas pendientes y vencidas',
  KEY ix_cuota_medio (id_medio_pago),
  KEY ix_cuota_usuario (id_usuario_cobro),
  CONSTRAINT fk_cuota_venta FOREIGN KEY (id_venta)
    REFERENCES venta (id_venta) ON DELETE CASCADE ON UPDATE CASCADE,
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_cuota_medio FOREIGN KEY (id_medio_pago)
    REFERENCES medio_pago (id_medio_pago),
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_cuota_usuario FOREIGN KEY (id_usuario_cobro)
    REFERENCES usuario (id_usuario),
  CONSTRAINT ck_cuota_importe CHECK (importe > 0),
  CONSTRAINT ck_cuota_numero CHECK (numero_cuota >= 1),
  CONSTRAINT ck_cuota_cobro CHECK (
    (fecha_cobro IS NULL AND id_medio_pago IS NULL AND id_usuario_cobro IS NULL)
    OR (fecha_cobro IS NOT NULL AND id_medio_pago IS NOT NULL AND id_usuario_cobro IS NOT NULL)
  )
) ENGINE=InnoDB
  COMMENT='RF29 - Cuotas de las ventas financiadas por el propio comercio';

-- ---------------------------------------------------------------------
-- pedido_pendiente : RF19
-- H10: "si no tenemos stock fisico, nos contactamos con el proveedor...
-- se cierra para mas tarde".
-- ---------------------------------------------------------------------
CREATE TABLE pedido_pendiente (
  id_pedido           INT          NOT NULL AUTO_INCREMENT,
  id_cliente          INT          NOT NULL,
  id_producto         INT          NULL  COMMENT 'Nulo si el articulo pedido aun no existe en el catalogo',
  descripcion_pedido  VARCHAR(200) NULL  COMMENT 'Descripcion libre cuando no hay producto asociado',
  id_usuario          INT          NOT NULL,
  cantidad            INT          NOT NULL DEFAULT 1,
  fecha_solicitud     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion    DATETIME     NULL,
  estado              ENUM('PENDIENTE','DISPONIBLE','ENTREGADO','CANCELADO')
                        NOT NULL DEFAULT 'PENDIENTE'  COMMENT 'RF19.2',
  observacion         VARCHAR(300) NULL,
  PRIMARY KEY (id_pedido),
  KEY ix_pedido_estado (estado, fecha_solicitud)
    COMMENT 'RF19.3 - pedidos pendientes de resolucion',
  KEY fk_pedido_cliente (id_cliente),
  KEY fk_pedido_producto (id_producto),
  KEY fk_pedido_usuario (id_usuario),
  CONSTRAINT fk_pedido_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_pedido_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto),
  CONSTRAINT fk_pedido_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_pedido_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_pedido_identificacion CHECK (
    id_producto IS NOT NULL OR descripcion_pedido IS NOT NULL
  )
) ENGINE=InnoDB
  COMMENT='RF19 - Pedidos pendientes originados por falta de existencias';


-- =====================================================================
--  MODULO 5 - SERVICIO TECNICO  (RF20 a RF24)
-- =====================================================================

-- ---------------------------------------------------------------------
-- dispositivo : RF20.3
-- No se vincula al cliente: el titular del equipo puede cambiar y el
-- historial por IMEI que pide RF24.2 debe sobrevivir a ese cambio.
-- imei_serie admite NULL porque un equipo que no enciende puede ingresar
-- sin IMEI legible, y exigirlo impediria registrar la recepcion.
-- ---------------------------------------------------------------------
CREATE TABLE dispositivo (
  id_dispositivo INT          NOT NULL AUTO_INCREMENT,
  id_modelo      INT          NOT NULL,
  imei_serie     VARCHAR(30)  NULL  COMMENT 'RF20.3 / RF24.2 - nulo si no pudo leerse al ingresar',
  color          VARCHAR(30)  NULL,
  observaciones  VARCHAR(200) NULL,
  PRIMARY KEY (id_dispositivo),
  UNIQUE KEY uk_dispositivo_imei (imei_serie),
  KEY fk_dispositivo_modelo (id_modelo),
  CONSTRAINT fk_dispositivo_modelo FOREIGN KEY (id_modelo)
    REFERENCES modelo_dispositivo (id_modelo) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF20.3 - Dispositivos que ingresan a servicio tecnico';

-- ---------------------------------------------------------------------
-- estado_orden : RF21.6 - ciclo de vida de la orden
-- ---------------------------------------------------------------------
CREATE TABLE estado_orden (
  id_estado        INT         NOT NULL AUTO_INCREMENT,
  codigo           VARCHAR(30) NOT NULL,
  nombre           VARCHAR(40) NOT NULL,
  orden_secuencia  INT         NOT NULL,
  es_final         TINYINT(1)  NOT NULL DEFAULT 0,
  PRIMARY KEY (id_estado),
  UNIQUE KEY uk_estado_codigo (codigo),
  UNIQUE KEY uk_estado_nombre (nombre)
) ENGINE=InnoDB
  COMMENT='RF21.6 - Estados del ciclo de vida de la orden de servicio';

-- ---------------------------------------------------------------------
-- orden_servicio : RF20
-- Concentra las reglas de negocio que el comercio ya tiene formalizadas
-- en su ficha de papel: garantia de 30 dias corridos (H07), retiro dentro
-- de los 10 dias de notificado bajo recargo del 15% (H08) y exhibicion de
-- la orden como condicion para retirar el equipo (H09).
-- ---------------------------------------------------------------------
CREATE TABLE orden_servicio (
  id_orden                    INT           NOT NULL AUTO_INCREMENT,
  numero_orden                VARCHAR(20)   NOT NULL
    COMMENT 'RF20.1 / RF20.9 / H09 - identificador unico que el cliente exhibe para retirar',
  id_cliente                  INT           NOT NULL  COMMENT 'RF20.2 - mismo padron que ventas',
  id_dispositivo              INT           NOT NULL,
  id_usuario_recepcion        INT           NOT NULL  COMMENT 'Quien recibio el equipo',
  id_usuario_tecnico          INT           NULL
    COMMENT 'RF21 / RF27 - tecnico asignado; nulo hasta que se toma la orden',
  id_estado_actual            INT           NOT NULL
    COMMENT 'Denormalizacion controlada: el estado vigente tambien consta en el historial',
  id_orden_anterior           INT           NULL
    COMMENT 'RF23.3 - reingreso por garantia (relacion recursiva)',
  fecha_ingreso               DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  falla_declarada             TEXT          NOT NULL  COMMENT 'RF20.5 - lo que manifiesta el cliente',
  estado_ingreso              TEXT          NOT NULL
    COMMENT 'RF20.6 / H06 - estado fisico y funcional al recibir; respalda al comercio ante fallas no declaradas',
  accesorios_recibidos        VARCHAR(300)  NULL  COMMENT 'RF20.4',
  estado_sellos               ENUM('INTACTOS','VIOLADOS','SIN_SELLO') NOT NULL DEFAULT 'SIN_SELLO'
    COMMENT 'RF20.8 / H07 - la ficha anula la garantia cuando los precintos propios estan rasgados o cortados: lo que dispara la exclusion es el estado del sello, no el hecho de haberlo verificado',
  diagnostico_tecnico         TEXT          NULL  COMMENT 'RF21.1',
  monto_presupuestado         DECIMAL(12,2) NULL  COMMENT 'RF21.2',
  presupuesto_aprobado        TINYINT(1)    NULL  COMMENT 'RF21.3 - nulo mientras no hay respuesta del cliente',
  fecha_respuesta_presupuesto DATETIME      NULL  COMMENT 'RF21.3',
  fecha_notificacion          DATETIME      NULL
    COMMENT 'RF22.1 / RF22.2 / H08 - ultima notificacion; inicia el plazo de 10 dias',
  fecha_entrega               DATETIME      NULL  COMMENT 'RF22.4',
  conformidad_cliente         TINYINT(1)    NULL  COMMENT 'RF22.4 - conformidad registrada en la entrega',
  recargo_aplicado            DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'RF22.3 / H08 - 15% por demora en el retiro',
  monto_total                 DECIMAL(12,2) NOT NULL DEFAULT 0.00
    COMMENT 'Derivado: presupuesto + repuestos + recargo',
  fecha_venc_garantia         DATE          NULL
    COMMENT 'RF23.1 / H07 - 30 dias corridos desde la entrega',
  PRIMARY KEY (id_orden),
  UNIQUE KEY uk_orden_numero (numero_orden),
  KEY ix_orden_estado_fecha (id_estado_actual, fecha_ingreso)
    COMMENT 'RF24.1 / RF27 - filtro por estado y periodo',
  KEY ix_orden_notificacion (fecha_notificacion, fecha_entrega)
    COMMENT 'RF22.2 - ordenes que superaron los 10 dias sin ser retiradas',
  KEY ix_orden_garantia (fecha_venc_garantia)
    COMMENT 'RF23.2 - vigencia de garantia al reingresar un equipo',
  KEY fk_orden_cliente (id_cliente),
  KEY fk_orden_dispositivo (id_dispositivo),
  KEY fk_orden_usuario_recepcion (id_usuario_recepcion),
  KEY fk_orden_usuario_tecnico (id_usuario_tecnico),
  KEY fk_orden_anterior (id_orden_anterior),
  CONSTRAINT fk_orden_cliente FOREIGN KEY (id_cliente)
    REFERENCES cliente (id_cliente) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orden_dispositivo FOREIGN KEY (id_dispositivo)
    REFERENCES dispositivo (id_dispositivo) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orden_usuario_recepcion FOREIGN KEY (id_usuario_recepcion)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orden_usuario_tecnico FOREIGN KEY (id_usuario_tecnico)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orden_estado FOREIGN KEY (id_estado_actual)
    REFERENCES estado_orden (id_estado) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_orden_anterior FOREIGN KEY (id_orden_anterior)
    REFERENCES orden_servicio (id_orden) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_orden_montos CHECK (
    (monto_presupuestado IS NULL OR monto_presupuestado >= 0)
    AND recargo_aplicado >= 0 AND monto_total >= 0
  )
) ENGINE=InnoDB
  COMMENT='RF20 - Ordenes de servicio tecnico';

-- ---------------------------------------------------------------------
-- orden_estado_historial : RF21.6 / RF22.1
-- Trazabilidad completa de las transiciones y de quien las hizo. De la
-- transicion a NOTIFICADO surge la fecha que dispara el plazo de H08.
-- ---------------------------------------------------------------------
CREATE TABLE orden_estado_historial (
  id_historial        INT          NOT NULL AUTO_INCREMENT,
  id_orden            INT          NOT NULL,
  id_estado           INT          NOT NULL,
  id_usuario          INT          NOT NULL,
  fecha_hora          DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  medio_notificacion  ENUM('WHATSAPP','LLAMADA','PRESENCIAL','CORREO') NULL
    COMMENT 'RF22.1 / H11 - solo en la transicion a NOTIFICADO',
  observacion         VARCHAR(300) NULL,
  PRIMARY KEY (id_historial),
  KEY ix_histestado_orden_fecha (id_orden, fecha_hora),
  KEY fk_histestado_estado (id_estado),
  KEY fk_histestado_usuario (id_usuario),
  CONSTRAINT fk_histestado_orden FOREIGN KEY (id_orden)
    REFERENCES orden_servicio (id_orden) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_histestado_estado FOREIGN KEY (id_estado)
    REFERENCES estado_orden (id_estado) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_histestado_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF21.6 / RF22.1 - Historial de estados de la orden';

-- ---------------------------------------------------------------------
-- foto_orden : RF20.7 / H06
-- ---------------------------------------------------------------------
CREATE TABLE foto_orden (
  id_foto          INT          NOT NULL AUTO_INCREMENT,
  id_orden         INT          NOT NULL,
  imagen_ruta      VARCHAR(255) NOT NULL,
  momento_captura  ENUM('INGRESO','PROCESO','ENTREGA') NOT NULL DEFAULT 'INGRESO',
  fecha_hora       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descripcion      VARCHAR(200) NULL,
  PRIMARY KEY (id_foto),
  KEY ix_foto_orden (id_orden, momento_captura),
  CONSTRAINT fk_foto_orden FOREIGN KEY (id_orden)
    REFERENCES orden_servicio (id_orden) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF20.7 - Fotografias del dispositivo tomadas al recibirlo';

-- ---------------------------------------------------------------------
-- repuesto_utilizado : RF21.4 / RF11.3
-- El consumo del servicio tecnico afecta las existencias del catalogo:
-- es la razon por la cual el modulo 2 es compartido.
-- ---------------------------------------------------------------------
CREATE TABLE repuesto_utilizado (
  id_repuesto_utilizado INT           NOT NULL AUTO_INCREMENT,
  id_orden              INT           NOT NULL,
  id_producto           INT           NOT NULL,
  cantidad              INT           NOT NULL,
  precio_unitario       DECIMAL(12,2) NOT NULL,
  costo_unitario        DECIMAL(12,2) NOT NULL DEFAULT 0.00
                          COMMENT 'RF04.2 - costo congelado para el calculo de rentabilidad',
  PRIMARY KEY (id_repuesto_utilizado),
  KEY ix_repuesto_orden (id_orden),
  KEY fk_repuesto_producto (id_producto),
  CONSTRAINT fk_repuesto_orden FOREIGN KEY (id_orden)
    REFERENCES orden_servicio (id_orden) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_repuesto_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT ck_repuesto_cantidad CHECK (cantidad > 0),
  CONSTRAINT ck_repuesto_precio CHECK (precio_unitario >= 0 AND costo_unitario >= 0)
) ENGINE=InnoDB
  COMMENT='RF21.4 - Repuestos consumidos en la reparacion';

-- ---------------------------------------------------------------------
-- tarea_realizada : RF21.5
-- Delimita el alcance de la garantia: solo lo efectivamente reparado
-- queda cubierto (H07).
-- ---------------------------------------------------------------------
CREATE TABLE tarea_realizada (
  id_tarea    INT      NOT NULL AUTO_INCREMENT,
  id_orden    INT      NOT NULL,
  id_usuario  INT      NOT NULL  COMMENT 'RF27 - tecnico que ejecuto la tarea',
  descripcion TEXT     NOT NULL,
  fecha_hora  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_tarea),
  KEY ix_tarea_orden (id_orden),
  KEY fk_tarea_usuario (id_usuario),
  CONSTRAINT fk_tarea_orden FOREIGN KEY (id_orden)
    REFERENCES orden_servicio (id_orden) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_tarea_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB
  COMMENT='RF21.5 - Tareas efectivamente realizadas sobre el dispositivo';


-- =====================================================================
--  MOVIMIENTOS DE EXISTENCIAS  (transversal a los modulos 2, 4 y 5)
-- =====================================================================

-- ---------------------------------------------------------------------
-- movimiento_stock : RF11
-- Libro de movimientos (kardex): fuente de verdad de las existencias, de
-- la cual producto.stock_actual es el acumulado denormalizado.
-- Las tres claves foraneas de origen son mutuamente excluyentes y
-- documentan por que se movio el stock, dando trazabilidad completa.
-- ---------------------------------------------------------------------
CREATE TABLE movimiento_stock (
  id_movimiento     BIGINT       NOT NULL AUTO_INCREMENT,
  id_producto       INT          NOT NULL,
  id_usuario        INT          NOT NULL,
  fecha_hora        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  tipo_movimiento   ENUM('INGRESO','VENTA','REPARACION','AJUSTE','DEVOLUCION') NOT NULL,
  cantidad          INT          NOT NULL  COMMENT 'Positiva en ingresos, negativa en egresos',
  stock_resultante  INT          NOT NULL  COMMENT 'Saldo tras aplicar el movimiento; permite auditar el kardex',
  motivo            VARCHAR(200) NULL      COMMENT 'RF11.5 - obligatorio en ajustes manuales',
  id_recepcion      INT          NULL      COMMENT 'RF11.1 - origen: recepcion de mercaderia',
  id_venta          INT          NULL      COMMENT 'RF11.2 / RF11.4 - origen: venta o su anulacion',
  id_orden          INT          NULL      COMMENT 'RF11.3 - origen: consumo de repuesto en reparacion',
  PRIMARY KEY (id_movimiento),
  KEY ix_movstock_producto_fecha (id_producto, fecha_hora)
    COMMENT 'RF12.4 - historial de movimientos de un producto',
  KEY ix_movstock_fecha (fecha_hora),
  KEY fk_movstock_usuario (id_usuario),
  KEY fk_movstock_recepcion (id_recepcion),
  KEY fk_movstock_venta (id_venta),
  KEY fk_movstock_orden (id_orden),
  CONSTRAINT fk_movstock_producto FOREIGN KEY (id_producto)
    REFERENCES producto (id_producto) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT fk_movstock_usuario FOREIGN KEY (id_usuario)
    REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE CASCADE,
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_movstock_recepcion FOREIGN KEY (id_recepcion)
    REFERENCES recepcion_mercaderia (id_recepcion),
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_movstock_venta FOREIGN KEY (id_venta)
    REFERENCES venta (id_venta),
  -- Sin accion referencial a proposito: MySQL prohibe ON DELETE / ON UPDATE
  -- sobre una columna que participa de una restriccion CHECK. La clave
  -- referenciada es AUTO_INCREMENT y nunca cambia, asi que no se pierde nada.
  CONSTRAINT fk_movstock_orden FOREIGN KEY (id_orden)
    REFERENCES orden_servicio (id_orden),
  CONSTRAINT ck_movstock_cantidad CHECK (cantidad <> 0),
  CONSTRAINT ck_movstock_ajuste_motivo CHECK (
    tipo_movimiento <> 'AJUSTE' OR motivo IS NOT NULL
  ),
  CONSTRAINT ck_movstock_origen_unico CHECK (
    (CASE WHEN id_recepcion IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN id_venta     IS NOT NULL THEN 1 ELSE 0 END
   + CASE WHEN id_orden     IS NOT NULL THEN 1 ELSE 0 END) <= 1
  )
) ENGINE=InnoDB
  COMMENT='RF11 - Kardex de existencias; sostiene stock_actual y RNF14';


-- =====================================================================
--  MODULO 6 - REPORTES  (RF25 a RF27)
--  No requiere tablas propias: consulta las existentes. Las vistas que
--  resuelven los reportes especificados estan en gestion_comercial_datos.sql
-- =====================================================================
