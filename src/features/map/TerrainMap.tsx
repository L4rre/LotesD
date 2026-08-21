import { useMemo, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Compass } from './components/Compass'
import { BlockGrid } from './components/BlockGrid'
import { LotDetailSheet } from './components/LotDetailSheet'
import { LOT_STATUS_META } from '../../domain/lotStatus'
import type { LotStatusRow } from '../../types/database.types'

export interface TerrainLayout {
  viewBox: { width: number; height: number }
  cell: { width: number; height: number; gap: number; cols: number }
  manzanas: { block: string; originX: number; originY: number; labelX: number; labelY: number }[]
  streets: { x: number; y: number; width: number; height: number; label?: string }[]
  park?: { x: number; y: number; width: number; height: number; label: string }
}

interface TerrainMapProps {
  layout: TerrainLayout
  lots: LotStatusRow[]
  onRefresh: () => void
}

// Mapa conceptual de un terreno (spec §8, §44): dibuja las manzanas según
// un `layout` (posiciones/calles/parque -- ver terrainData/), pero el
// color de cada lote se calcula siempre de `lots` (Supabase), nunca del
// layout ni del SVG -- así un terreno nuevo es solo un `layout` distinto
// (docs §16), no un componente de mapa nuevo.
export function TerrainMap({ layout, lots, onRefresh }: TerrainMapProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  // Derivado en cada render en vez de guardar el objeto en estado: cuando
  // `lots` se refresca (acción del usuario o Realtime), el Bottom Sheet
  // automáticamente muestra la fila actualizada del mismo lote en vez de
  // quedarse con los datos viejos.
  const selectedLot = selectedLotId ? (lots.find((l) => l.lot_id === selectedLotId) ?? null) : null

  const byBlock = useMemo(() => {
    const map = new Map<string, Map<number, LotStatusRow>>()
    for (const lot of lots) {
      if (!map.has(lot.block)) map.set(lot.block, new Map())
      map.get(lot.block)!.set(lot.lot_number, lot)
    }
    return map
  }, [lots])

  const { width, height } = layout.viewBox
  const { width: cellW, height: cellH, gap, cols } = layout.cell

  return (
    <div className="map-canvas-wrap">
      <Compass />
      <div className="map-legend">
        {(Object.keys(LOT_STATUS_META) as Array<keyof typeof LOT_STATUS_META>).map((key) => (
          <span key={key}>
            {LOT_STATUS_META[key].emoji} {LOT_STATUS_META[key].label}
          </span>
        ))}
      </div>

      <TransformWrapper initialScale={1} minScale={0.4} maxScale={4} centerOnInit>
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
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: 'min(94vw, 82vh)', height: 'min(94vw, 82vh)', display: 'block', flexShrink: 0 }}
            role="img"
            aria-label="Mapa del terreno"
          >
            <rect x={0} y={0} width={width} height={height} fill="#eef1ee" />

            {layout.streets.map((s, i) => (
              <g key={i}>
                <rect x={s.x} y={s.y} width={s.width} height={s.height} fill="#d7dbd6" />
                {s.label && (
                  <text
                    x={s.x + s.width / 2}
                    y={s.y + s.height / 2 + 5}
                    textAnchor="middle"
                    fontSize={13}
                    fill="#5b6660"
                  >
                    {s.label}
                  </text>
                )}
              </g>
            ))}

            {layout.park && (
              <g>
                <rect
                  x={layout.park.x}
                  y={layout.park.y}
                  width={layout.park.width}
                  height={layout.park.height}
                  fill="#d7ecd9"
                  stroke="#9fcaa8"
                  strokeWidth={1.5}
                  rx={6}
                />
                <text
                  x={layout.park.x + layout.park.width / 2}
                  y={layout.park.y + layout.park.height / 2}
                  textAnchor="middle"
                  fontSize={16}
                  fontWeight={700}
                  fill="#3d7a4a"
                >
                  {layout.park.label}
                </text>
              </g>
            )}

            {layout.manzanas.map((m) => (
              <g key={m.block}>
                <text x={m.labelX} y={m.labelY} textAnchor="middle" fontSize={18} fontWeight={700} fill="#1c2320">
                  Manzana {m.block}
                </text>
                <BlockGrid
                  block={m.block}
                  originX={m.originX}
                  originY={m.originY}
                  cols={cols}
                  cellW={cellW}
                  cellH={cellH}
                  gap={gap}
                  lotsByNumber={byBlock.get(m.block) ?? new Map()}
                  onSelect={(lot) => setSelectedLotId(lot.lot_id)}
                />
              </g>
            ))}
          </svg>
        </TransformComponent>
      </TransformWrapper>

      <BottomSheet open={selectedLot !== null} onClose={() => setSelectedLotId(null)}>
        {selectedLot && <LotDetailSheet lot={selectedLot} onActionSuccess={onRefresh} />}
      </BottomSheet>
    </div>
  )
}
