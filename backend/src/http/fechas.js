// Limites de un dia del calendario en hora local del comercio (UTC-3) y su
// conversion a texto UTC para consultas SQL crudas.

const desdeIso = (texto) => {
  const [anio, mes, dia] = String(texto).slice(0, 10).split('-').map(Number)
  return new Date(anio, mes - 1, dia)
}

/**
 * Limites de un dia del calendario, como instantes. La base guarda las fechas
 * en UTC y el comercio vive en Formosa (UTC-3): "el dia 23" son las 21:00 del
 * 23 UTC hasta las 21:00 del 24 UTC. Comparar "2026-10-23 00:00:00" como texto
 * contra esos valores deja una venta de las 22:00 en el dia siguiente. Armar
 * el instante en hora local y dejar que el controlador lo convierta lo evita.
 */
export const inicioDeDia = (iso) => desdeIso(iso)

export const finDeDia = (iso) => {
  const inicio = desdeIso(iso)
  return new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), 23, 59, 59, 999)
}

/**
 * Instante -> texto UTC para una consulta SQL cruda. La sesion de MySQL esta en
 * UTC, pero `sequelize.query` escribe un Date de las replacements en hora
 * local: el limite de "el dia 1" (03:00 UTC) llegaba como "00:00" y corria el
 * periodo tres horas hacia atras. Los modelos convierten solos; aca no.
 */
export const instanteUtc = (fecha) => fecha.toISOString().slice(0, 19).replace('T', ' ')

