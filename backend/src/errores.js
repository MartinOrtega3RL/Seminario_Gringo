// Errores del dominio. El middleware manejar-errores.js los traduce a una
// respuesta HTTP; ningun servicio conoce codigos de estado.
//
// RNF08 exige mensajes comprensibles y sin detalle tecnico interno: el mensaje
// de estas clases es el que ve el usuario, asi que se escribe pensando en el.

export class ErrorDeDominio extends Error {
  constructor(mensaje, estado, codigo) {
    super(mensaje)
    this.name = new.target.name
    this.estado = estado
    this.codigo = codigo
  }
}

export class NoAutenticado extends ErrorDeDominio {
  constructor(mensaje = 'La sesion no es valida o expiro. Volve a iniciar sesion.') {
    super(mensaje, 401, 'NO_AUTENTICADO')
  }
}

export class SinPermiso extends ErrorDeDominio {
  constructor(mensaje = 'Tu perfil no tiene permiso para realizar esta accion.') {
    super(mensaje, 403, 'SIN_PERMISO')
  }
}

export class NoEncontrado extends ErrorDeDominio {
  constructor(que = 'El registro') {
    super(`${que} no existe o fue dado de baja.`, 404, 'NO_ENCONTRADO')
  }
}

export class DatosInvalidos extends ErrorDeDominio {
  constructor(mensaje, detalles = []) {
    super(mensaje, 422, 'DATOS_INVALIDOS')
    this.detalles = detalles
  }
}

export class ConflictoDeConcurrencia extends ErrorDeDominio {
  constructor(mensaje = 'Otra persona modifico este registro mientras lo editabas. Volve a cargarlo.') {
    super(mensaje, 409, 'CONFLICTO_CONCURRENCIA')
  }
}

// RF16.7 / RNF14. Se lanza cuando el UPDATE con guarda no afecta ninguna fila:
// no habia existencias suficientes y la venta no se registra.
export class StockInsuficiente extends ErrorDeDominio {
  constructor(denominacion, disponible) {
    super(
      `No hay existencias suficientes de "${denominacion}". Disponible: ${disponible}.`,
      409,
      'STOCK_INSUFICIENTE',
    )
    this.disponible = disponible
  }
}
