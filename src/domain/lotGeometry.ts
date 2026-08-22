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
