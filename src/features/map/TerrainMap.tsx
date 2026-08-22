import { useMemo, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Compass } from './components/Compass'
import { LotDetailSheet } from './components/LotDetailSheet'
import { LOT_STATUS_META } from '../../domain/lotStatus'
import { resolverDimensiones } from '../../domain/lotGeometry'
import type { LotStatusRow } from '../../types/database.types'

export interface TerrainLayout {
  // Ángulo (grados) al que está rotado el terreno real respecto al norte;
  // rota tanto la geometría como la brújula, para que esta última siga
  // señalando el norte real.
  rotationDeg: number
  manzanas: Record<string, { cx: number; cy: number; halfW: number; halfH: number }>
  // Posición local (x, y) de cada lote dentro del marco de su manzana,
  // por block -> lote (2 dígitos, ej. "05") -> [x, y].
  lotPositions: Record<string, Record<string, [number, number]>>
  // Extrapolaciones para lotes que existen en Supabase pero no se pudo
  // localizar en el plano vectorial (ver docs §14).
  fallbackPositions?: Record<string, [number, number]>
  park?: { polygon: [number, number][]; label: string }
}

interface TerrainMapProps {
  layout: TerrainLayout
  lots: LotStatusRow[]
  onRefresh: () => void
}

function posDeLote(layout: TerrainLayout, block: string, loteNumero: number): { x: number; y: number } | null {
  const lote = String(loteNumero).padStart(2, '0')
  const p = layout.lotPositions[block]?.[lote] ?? layout.fallbackPositions?.[`${block}-${lote}`]
  return p ? { x: p[0], y: p[1] } : null
}

// Mapa con la geometría real del terreno (spec: posición/rotación/forma
// de cada lote extraídas del plano vectorial, no una grilla aproximada).
// El color de cada lote se calcula siempre de `lots` (Supabase), nunca
// del layout -- así un terreno nuevo es solo un `layout` distinto (docs
// §16), no un componente de mapa nuevo. Frente/fondo se derivan de
// área+perímetro (`resolverDimensiones`), nunca se guardan aparte.
export function TerrainMap({ layout, lots, onRefresh }: TerrainMapProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  // Derivado en cada render en vez de guardar el objeto en estado: cuando
  // `lots` se refresca (acción del usuario o Realtime), el Bottom Sheet
  // automáticamente muestra la fila actualizada del mismo lote en vez de
  // quedarse con los datos viejos.
  const selectedLot = selectedLotId ? (lots.find((l) => l.lot_id === selectedLotId) ?? null) : null

  const byBlock = useMemo(() => {
    const map = new Map<string, LotStatusRow[]>()
    for (const lot of lots) {
      const arr = map.get(lot.block)
      if (arr) arr.push(lot)
      else map.set(lot.block, [lot])
    }
    return map
  }, [lots])

  const bounds = useMemo(() => {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const meta of Object.values(layout.manzanas)) {
      const r = Math.max(meta.halfW, meta.halfH)
      minX = Math.min(minX, meta.cx - r)
      maxX = Math.max(maxX, meta.cx + r)
      minY = Math.min(minY, meta.cy - r)
      maxY = Math.max(maxY, meta.cy + r)
    }
    for (const [x, y] of layout.park?.polygon ?? []) {
      minX = Math.min(minX, x - 5)
      maxX = Math.max(maxX, x + 5)
      minY = Math.min(minY, y - 5)
      maxY = Math.max(maxY, y + 5)
    }
    return { minX, minY, maxX, maxY }
  }, [layout])

  const PAD = 8
  const vbW = bounds.maxX - bounds.minX + PAD * 2
  const vbH = bounds.maxY - bounds.minY + PAD * 2
  const parqueCenter = layout.park
    ? {
        x: layout.park.polygon.reduce((s, [x]) => s + x, 0) / layout.park.polygon.length,
        y: layout.park.polygon.reduce((s, [, y]) => s + y, 0) / layout.park.polygon.length,
      }
    : null

  return (
    <div className="map-canvas-wrap">
      <Compass rotationDeg={layout.rotationDeg} />
      <div className="map-legend">
        {(Object.keys(LOT_STATUS_META) as Array<keyof typeof LOT_STATUS_META>).map((key) => (
          <span key={key}>
            {LOT_STATUS_META[key].emoji} {LOT_STATUS_META[key].label}
          </span>
        ))}
      </div>

      <TransformWrapper initialScale={1} minScale={0.5} maxScale={8} centerOnInit>
        <TransformComponent
          wrapperStyle={{ width: '100%', height: '100%' }}
          contentStyle={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox={`0 0 ${vbW} ${vbH}`}
            style={{ width: 'min(94vw, 82vh)', height: 'min(94vw, 82vh)', display: 'block', flexShrink: 0 }}
            role="img"
            aria-label="Mapa del terreno"
          >
            <defs>
              <pattern id="terrain-grid" width="4" height="4" patternUnits="userSpaceOnUse">
                <path d="M 4 0 L 0 0 0 4" fill="none" stroke="#e2e6e2" strokeWidth="0.15" />
              </pattern>
            </defs>
            <rect x={0} y={0} width={vbW} height={vbH} fill="#eef1ee" />
            <rect x={0} y={0} width={vbW} height={vbH} fill="url(#terrain-grid)" />

            <g transform={`translate(${PAD - bounds.minX}, ${PAD - bounds.minY})`}>
              {layout.park && parqueCenter && (
                <g>
                  <polygon
                    points={layout.park.polygon.map(([x, y]) => `${x},${y}`).join(' ')}
                    fill="#d7ecd9"
                    stroke="#9fcaa8"
                    strokeWidth={0.4}
                  />
                  <text
                    x={parqueCenter.x}
                    y={parqueCenter.y}
                    textAnchor="middle"
                    fontSize={1.8}
                    fontWeight={700}
                    fill="#3d7a4a"
                    transform={`rotate(${layout.rotationDeg + 90} ${parqueCenter.x} ${parqueCenter.y})`}
                  >
                    {layout.park.label}
                  </text>
                </g>
              )}

              {Object.entries(layout.manzanas).map(([block, meta]) => (
                <g key={block} transform={`translate(${meta.cx}, ${meta.cy}) rotate(${layout.rotationDeg})`}>
                  <text x={0} y={-meta.halfH - 2} textAnchor="middle" fontSize={2.2} fontWeight={700} fill="#1c2320">
                    Manzana {block}
                  </text>

                  {(byBlock.get(block) ?? []).map((lot) => {
                    const pos = posDeLote(layout, block, lot.lot_number)
                    if (!pos || lot.area == null || lot.perimeter == null) return null
                    const { frente, fondo, irregular } = resolverDimensiones(lot.area, lot.perimeter)
                    const statusMeta = LOT_STATUS_META[lot.status]

                    return (
                      <g
                        key={lot.lot_code}
                        id={lot.geometry_id}
                        onClick={() => setSelectedLotId(lot.lot_id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          x={pos.x - frente / 2}
                          y={pos.y - fondo / 2}
                          width={frente}
                          height={fondo}
                          fill={statusMeta.fill}
                          stroke={irregular ? '#8a938c' : statusMeta.stroke}
                          strokeWidth={irregular ? 0.3 : 0.22}
                          strokeDasharray={irregular ? '0.8 0.5' : undefined}
                        />
                        {frente > 3 && (
                          <text
                            x={pos.x}
                            y={pos.y}
                            textAnchor="middle"
                            fontSize={1.3}
                            fontWeight={700}
                            fill="#20261f"
                            style={{ pointerEvents: 'none' }}
                            transform={`rotate(90 ${pos.x} ${pos.y})`}
                          >
                            {String(lot.lot_number).padStart(2, '0')}
                          </text>
                        )}
                      </g>
                    )
                  })}
                </g>
              ))}
            </g>
          </svg>
        </TransformComponent>
      </TransformWrapper>

      <BottomSheet open={selectedLot !== null} onClose={() => setSelectedLotId(null)}>
        {selectedLot && <LotDetailSheet lot={selectedLot} onActionSuccess={onRefresh} />}
      </BottomSheet>
    </div>
  )
}
