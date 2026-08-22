// Deriva un frente/fondo aproximado (lote rectangular implícito) a partir
// de área + perímetro -- nunca se guardan front/back por separado (ver
// docs §14), se calculan al vuelo para poder dibujar un rectángulo del
// tamaño correcto en el mapa. Si el área/perímetro no corresponden a un
// rectángulo real (discriminante negativo) o el resultado se aleja mucho
// de un lote "estándar" (~8x20 en este terreno), se marca `irregular`
// para que el mapa lo distinga visualmente (no inventa la forma real,
// solo avisa que esta es una aproximación).
export interface LotDimensions {
  frente: number
  fondo: number
  irregular: boolean
}

export function resolverDimensiones(area: number, perimetro: number): LotDimensions {
  const s = perimetro / 2
  const disc = s * s - 4 * area
  if (disc < 0) {
    const fondo = 20
    return { frente: Math.max(area / fondo, 1.5), fondo, irregular: true }
  }
  const raiz = Math.sqrt(disc)
  const t1 = (s + raiz) / 2
  const t2 = (s - raiz) / 2
  const fondo = Math.max(t1, t2)
  const frente = Math.min(t1, t2)
  const irregular = Math.abs(fondo - 20) > 3 || frente < 2
  return { frente, fondo, irregular }
}

// El plano solo trae la posición (centro) de cada lote, no su rotación
// individual -- pero varias manzanas no son una sola fila recta: tienen
// una fila principal y uno o dos grupos de lotes que doblan la esquina
// hacia otra calle (ej. MZ Y-11). Dibujarlos todos con la misma
// orientación de la fila principal los deja visualmente descolocados.
//
// Heurística: para cada lote, se mira a su vecino más cercano dentro de
// la misma manzana. Si la distancia entre ambos es más vertical que
// horizontal, se asume que ese lote pertenece a una fila que dobla la
// esquina y hay que rotarlo 90° (intercambiar frente/fondo al dibujar).
// Es una aproximación -- funciona bien para el patrón "fila + remates en
// las puntas" que tiene este terreno, no una reconstrucción exacta del
// plano (eso requeriría la rotación real de cada lote, que no viene en
// los datos disponibles).
export function detectarLotesQueDoblanEsquina(
  posicionesPorLote: Record<string, [number, number]>,
): Set<string> {
  const entradas = Object.entries(posicionesPorLote)
  const resultado = new Set<string>()

  for (const [lote, [x, y]] of entradas) {
    let mejor: { dist: number; dx: number; dy: number } | null = null
    for (const [otroLote, [ox, oy]] of entradas) {
      if (otroLote === lote) continue
      const dx = ox - x
      const dy = oy - y
      const dist = Math.hypot(dx, dy)
      if (!mejor || dist < mejor.dist) mejor = { dist, dx, dy }
    }
    if (mejor && Math.abs(mejor.dy) > Math.abs(mejor.dx)) {
      resultado.add(lote)
    }
  }

  return resultado
}
