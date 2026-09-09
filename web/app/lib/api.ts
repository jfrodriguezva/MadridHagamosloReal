// Único lugar donde vive la URL de la API. Antes cada archivo repetía esta
// misma línea con el fallback "http://localhost:5080" -- un puerto que el
// proyecto ya no usa (la API va en 10001, ver RECOVERY.md). El síntoma de ese
// fallback viejo no era un error sino un portal cargando VACÍO, que es mucho
// más difícil de diagnosticar; y al cambiar de puertos había 14 sitios que
// tocar en vez de los 3 que documenta RECOVERY.md.
export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:10001";
