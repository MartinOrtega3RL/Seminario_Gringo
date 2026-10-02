# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React 19 · Vite 8 · Tailwind CSS v4 en el frontend; Express · Sequelize · MySQL 8 en el backend. Decisión explícita del equipo. El backend ya está construido y verificado de punta a punta; el frontend se construye ahora, en `frontend/`, como carpeta hermana de `backend/`.

## Users

Tres perfiles, relevados en la entrevista al titular (H13):

- **Titular / Administrador.** Dueño del comercio. Decide precios y compras, y es el único habilitado para ver el precio de costo y la rentabilidad (RF04.2). Consulta el sistema tanto en el local como fuera de él.
- **Colaboradora / Vendedor.** Atiende el mostrador. Su trabajo dominante es cargar ventas con el cliente enfrente, esperando. Consulta el catálogo, no lo modifica.
- **Técnico.** Servicio técnico. Su módulo está diferido a una iteración posterior; en la iteración 1 solo consulta el catálogo y los clientes.

**Situación de uso confirmada:** local de telefonía en Formosa. Se opera desde una PC con teclado y mouse, en el mostrador, con el cliente presente. El celular es un dispositivo secundario de consulta, no el principal de carga.

## Product Purpose

Reemplazar el registro en papel y la consulta manual de listas de precios de proveedor por un sistema propio. El objetivo central, en palabras del titular, es el control de existencias en tiempo real atado a la venta: «el control de stock, el sistema de ventas en general es lo que más me preocupa en este momento» (H03).

Éxito significa que una venta se registre completa en menos de tres segundos, que las existencias nunca queden inconsistentes, y que una persona sin conocimientos técnicos pueda cargar una venta después de media hora de capacitación.

## Positioning

El titular evaluó paquetes existentes y los descartó por obsoletos: «algunos sistemas que se ofrecen son muy obsoletos... parecen un Excel» (H16). El sistema se construye sobre el circuito de trabajo relevado en el propio comercio —lista minorista y mayorista, códigos internos propios, envíos coordinados por WhatsApp— y no sobre un modelo genérico de comercio minorista.

## Operating Context

- **Volumen:** 15 a 20 ventas y 3 a 5 órdenes de servicio por día (H18). Tres usuarios simultáneos como máximo (S03).
- **Dispositivos:** computadora personal, dispositivo móvil e impresora (H21). **La impresora es común, tamaño A4** — confirmado con el equipo. El comprobante se imprime en hoja entera, no en rollo de ticket.
- **Cobro:** efectivo y Mercado Pago, con terminal Point Smart en el local que canaliza transferencias y tarjeta (H17). La terminal opera de forma autónoma y **no se integra** con el sistema (S11): el medio de pago y su importe se registran a mano.
- **Modalidades de pago:** contado, financiación propia del comercio, financiación con tarjeta y Go Cuotas (H27).
- **Entrega:** retiro en el local o envío a domicilio, estos últimos coordinados por WhatsApp e Instagram (H19).
- **Contacto con el cliente:** el WhatsApp es el dato de contacto que piden siempre (H11).
- **Catálogo:** teléfonos, accesorios, repuestos, fundas, vidrios templados, cargadores y auriculares. Especialistas en Apple y Android (H24). Se dimensiona en 3.000 artículos para pruebas (S01).

## Capabilities and Constraints

**Lo que hace la iteración 1** — 13 requerimientos, 54 operaciones, cuatro módulos: acceso y seguridad, catálogo y existencias, clientes, y ventas con emisión de comprobante.

**Restricciones confirmadas que el diseño no puede ignorar:**

- **No hay lector óptico de códigos de barras** y no se prevé incorporarlo (S07). El código interno se tipea a mano o se busca por texto. Esto es central: el punto de venta no puede diseñarse alrededor de un escáner.
- **El comprobante es interno y no fiscal** (S05). Lleva leyenda que lo aclara. La integración con controlador fiscal queda para más adelante.
- **El precio de costo es información restringida** (RF04.2). Solo el perfil Administrador puede verlo. No puede aparecer en una pantalla compartida ni deducirse por aproximación.
- **Los permisos se validan en el servidor** en cada operación (RNF18). Ocultar un control en la interfaz es comodidad, nunca control de acceso.
- **Tres perfiles fijos** en esta iteración: Administrador, Vendedor y Técnico, precargados. Hacerlos configurables (RF03) está diferido.

**Diferido a iteraciones posteriores:** servicio técnico, reportes, recepción de mercadería con OCR, gestión de proveedores, financiación propia y pedidos pendientes.

## Brand Commitments

- **Nombre:** El Gringo Celulares. Comercio de telefonía en Formosa, Argentina.
- **Idioma:** castellano rioplatense. El esquema de la base, la especificación y el equipo están en castellano; la interfaz también. Nada de vocabulario técnico en inglés a la vista del usuario.
- **Identidad visual:** no existe. Sin logo, sin paleta, sin tipografía definida. El equipo delegó su creación. No hay ninguna restricción visual heredada que preservar.

## Evidence on Hand

- Entrevista al titular con 27 hallazgos registrados, más consultas de seguimiento por mensaje. Es la fuente de toda afirmación sobre el negocio.
- Ficha de servicio técnico en papel que el comercio entrega hoy al recibir una reparación.
- Esquema de base de datos de 34 tablas con su diagrama entidad-relación, ya instalado y verificado.
- Backend de la iteración 1 funcionando, con la rebanada trazadora verificada de punta a punta.

**Lo que NO existe y no debe inventarse:** logo, fotos de producto, testimonios de clientes, cantidad exacta de artículos en catálogo, precios reales del comercio. Cualquier dato de muestra debe ser evidentemente de muestra.

## Product Principles

1. **La venta manda.** Es la operación que más se repite, con el cliente esperando enfrente. Cualquier decisión que la haga más lenta está mal, aunque mejore otra pantalla.
2. **Sin escáner, el buscador es el escáner.** Encontrar un producto por texto o por código tipeado es el gesto central del sistema, no una función accesoria.
3. **El costo no se filtra.** Ni en pantalla, ni en un listado, ni por aproximación a partir de otro número visible.
4. **Nada de planilla.** El titular descartó los sistemas que evaluó justamente por eso. Una grilla densa de celdas es el anti-referente explícito.
5. **Se aprende en media hora.** Si una pantalla necesita explicación, la pantalla está mal.

## Accessibility & Inclusion

- **RNF07:** un usuario sin conocimientos técnicos debe poder registrar una venta completa tras una capacitación no mayor a treinta minutos.
- **RNF08:** los mensajes de error deben ser comprensibles y no exponer información técnica interna.
- **RNF15:** debe funcionar sobre computadora personal, dispositivo móvil e impresora.
- **RNF06:** interfaz con navegación por menús e íconos, validada con el cliente sobre prototipo.

El uso es prolongado y en horario comercial completo, con luz de local. No se relevó ninguna necesidad de accesibilidad individual, pero el trabajo se sostiene sobre HTML semántico, navegación por teclado y contraste suficiente, porque la operación es de teclado y mouse y se repite todo el día.
