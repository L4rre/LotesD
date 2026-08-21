import { useMemo, useState } from 'react'
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import { BottomSheet } from '../../components/ui/BottomSheet'
import { Compass } from './components/Compass'
import { BlockGrid } from './components/BlockGrid'
import { LotDetailSheet } from './components/LotDetailSheet'
import { LOT_STATUS_META } from '../../domain/lotStatus'
import type { LotStatusRow } from '../../types/database.types'

const CELL_W = 120
const CELL_H = 85
const GAP = 15

// Cuatro manzanas alrededor de una carretera principal en cruz (spec §8):
// mapa CONCEPTUAL y estilizado, no reproduce ningún plano real. Pensado
// para el "Proyecto Demo" (4 manzanas de 12 lotes); un terreno con otra
// distribución tendría su propio componente de mapa más adelante (docs
// §8, §44) hasta que exista un importador de planos reales.
const QUADRANTS: Record<string, { originX: number; originY: number; labelX: number; labelY: number }> = {
  Y: { originX: 45, originY: 45, labelX: 240, labelY: 30 },
  Z: { originX: 565, originY: 45, labelX: 760, labelY: 30 },
  K: { originX: 45, originY: 565, labelX: 240, labelY: 550 },
  L: { originX: 565, originY: 565, labelX: 760, labelY: 550 },
}

interface DemoMapProps {
  lots: LotStatusRow[]
  onRefresh: () => void
}

export function DemoMap({ lots, onRefresh }: DemoMapProps) {
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null)

  // Derivado en cada render en vez de guardar el objeto en estado: sin
  // Realtime todavía (eso es la Fase 15), cuando `lots` se refresca a mano
  // tras una acción, el Bottom Sheet automáticamente muestra la fila
  // actualizada del mismo lote en vez de quedarse con los datos viejos.
  const selectedLot = selectedLotId ? (lots.find((l) => l.lot_id === selectedLotId) ?? null) : null

  const byBlock = useMemo(() => {
    const map = new Map<string, Map<number, LotStatusRow>>()
    for (const lot of lots) {
      if (!map.has(lot.block)) map.set(lot.block, new Map())
      map.get(lot.block)!.set(lot.lot_number, lot)
    }
    return map
  }, [lots])

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

      <TransformWrapper initialScale={1} minScale={0.5} maxScale={4} centerOnInit>
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
            viewBox="0 0 1000 1000"
            style={{ width: 'min(92vw, 80vh)', height: 'min(92vw, 80vh)', display: 'block', flexShrink: 0 }}
            role="img"
            aria-label="Mapa del terreno"
          >
            <rect x={0} y={0} width={1000} height={1000} fill="#eef1ee" />

            {/* Carretera principal en cruz */}
            <rect x={0} y={460} width={1000} height={80} fill="#d7dbd6" />
            <rect x={460} y={0} width={80} height={1000} fill="#d7dbd6" />
            <text x={500} y={452} textAnchor="middle" fontSize={13} fill="#5b6660">
              Carretera Principal
            </text>

            {Object.entries(QUADRANTS).map(([block, q]) => (
              <g key={block}>
                <text
                  x={q.labelX}
                  y={q.labelY}
                  textAnchor="middle"
                  fontSize={22}
                  fontWeight={700}
                  fill="#1c2320"
                >
                  Manzana {block}
                </text>
                <BlockGrid
                  block={block}
                  originX={q.originX}
                  originY={q.originY}
                  cols={3}
                  rows={4}
                  cellW={CELL_W}
                  cellH={CELL_H}
                  gap={GAP}
                  lotsByNumber={byBlock.get(block) ?? new Map()}
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
