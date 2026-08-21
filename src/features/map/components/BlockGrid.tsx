import { LOT_STATUS_META } from '../../../domain/lotStatus'
import type { LotStatusRow } from '../../../types/database.types'

interface BlockGridProps {
  block: string
  originX: number
  originY: number
  cols: number
  cellW: number
  cellH: number
  gap: number
  lotsByNumber: Map<number, LotStatusRow>
  onSelect: (lot: LotStatusRow) => void
}

// Una manzana: los lotes que existan en `lotsByNumber` (spec: los números
// de lote de un terreno real no son necesariamente correlativos -- Y-11,
// Z-10 y Z-11 tienen huecos, ver docs terrainData/buenaFortuna.ts) se
// ubican en orden ascendente en una grilla de `cols` columnas; el número
// de filas se calcula solo, no hace falta declararlo. La geometría
// (posición/tamaño) es puramente visual y no tiene nada que ver con los
// datos de negocio (spec §43).
export function BlockGrid({
  block,
  originX,
  originY,
  cols,
  cellW,
  cellH,
  gap,
  lotsByNumber,
  onSelect,
}: BlockGridProps) {
  const lots = [...lotsByNumber.entries()].sort(([a], [b]) => a - b).map(([, lot]) => lot)

  return (
    <>
      {lots.map((lot, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = originX + col * (cellW + gap)
        const y = originY + row * (cellH + gap)
        const meta = LOT_STATUS_META[lot.status]

        return (
          <g key={lot.lot_code} id={lot.geometry_id} onClick={() => onSelect(lot)} style={{ cursor: 'pointer' }}>
            <rect
              x={x}
              y={y}
              width={cellW}
              height={cellH}
              rx={4}
              fill={meta.fill}
              stroke={meta.stroke}
              strokeWidth={1.5}
            />
            <text
              x={x + cellW / 2}
              y={y + cellH / 2 + 5}
              textAnchor="middle"
              fontSize={13}
              fontWeight={700}
              fill="#20261f"
            >
              {block.replace('-', '')}-{String(lot.lot_number).padStart(2, '0')}
            </text>
          </g>
        )
      })}
    </>
  )
}
