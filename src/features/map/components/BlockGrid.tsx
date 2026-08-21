import { LOT_STATUS_META } from '../../../domain/lotStatus'
import type { LotStatusRow } from '../../../types/database.types'

interface BlockGridProps {
  block: string
  originX: number
  originY: number
  cols: number
  rows: number
  cellW: number
  cellH: number
  gap: number
  lotsByNumber: Map<number, LotStatusRow>
  onSelect: (lot: LotStatusRow) => void
}

// Una manzana: `cols` x `rows` lotes numerados en orden de lectura
// (izquierda a derecha, arriba a abajo), coloreados según su estado
// comercial. La geometría (posición/tamaño) es puramente visual y no
// tiene nada que ver con los datos de negocio (spec §43).
export function BlockGrid({
  block,
  originX,
  originY,
  cols,
  rows,
  cellW,
  cellH,
  gap,
  lotsByNumber,
  onSelect,
}: BlockGridProps) {
  const cells = []
  for (let i = 0; i < cols * rows; i++) {
    const lotNumber = i + 1
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = originX + col * (cellW + gap)
    const y = originY + row * (cellH + gap)
    const lot = lotsByNumber.get(lotNumber)
    if (!lot) continue

    const meta = LOT_STATUS_META[lot.status]

    cells.push(
      <g
        key={lot.lot_code}
        id={lot.geometry_id}
        onClick={() => onSelect(lot)}
        style={{ cursor: 'pointer' }}
      >
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
          fontSize={16}
          fontWeight={700}
          fill="#20261f"
        >
          {block}-{String(lotNumber).padStart(2, '0')}
        </text>
      </g>,
    )
  }

  return <>{cells}</>
}
