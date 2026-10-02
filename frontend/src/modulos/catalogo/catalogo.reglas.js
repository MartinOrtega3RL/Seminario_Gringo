// RF04.2 — quién puede ver el precio de costo.
//
// Esto NO es el control de acceso: el control lo hace el servidor, que
// directamente no manda el campo a quien no corresponde (RNF18). Acá solo se
// decide si el formulario muestra el control y si lo incluye en el envío.
//
// Los tres perfiles vienen precargados (H13) porque RF03, que los haría
// configurables, está diferido. Cuando RF03 entre, esto se reemplaza por una
// bandera que venga en la sesión y este archivo no cambia más.
const PERFILES_CON_ACCESO_A_COSTOS = new Set(['Administrador'])

export const puedeVerCosto = (perfil) => PERFILES_CON_ACCESO_A_COSTOS.has(perfil)

/**
 * Si el servidor no mandó el costo, no hay que reenviarlo: un cuerpo sin el
 * campo deja el valor que ya estaba. Mandar cero porque el formulario lo vio
 * vacío borraría el costo del producto sin que nadie se entere.
 */
export const conservaCosto = (producto) => producto?.precioCosto === undefined
