/**
 * Convierte resultados de Drizzle ORM a objetos planos serializables por SuperJSON
 * 
 * Problema: Drizzle devuelve objetos Proxy que SuperJSON no puede serializar
 * Solución: Convertir a JSON y parsear de vuelta para obtener objetos planos
 */
export function toPlainObject<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(toPlainObject) as unknown as T;
  if (typeof obj === 'object' && obj !== null) {
    // Usar JSON.parse(JSON.stringify()) es la forma más confiable
    // de eliminar todos los Proxies y getters de Drizzle
    return JSON.parse(JSON.stringify(obj));
  }
  return obj;
}

/**
 * Wrapper para resultados de select que garantiza serialización
 */
export function serializeSelectResult<T>(result: T | T[]): T | T[] {
  return toPlainObject(result);
}
