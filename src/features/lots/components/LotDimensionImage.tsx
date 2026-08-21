import { useState } from 'react'
import { Alert } from '../../../components/ui/Alert'
import { dimensionImageUrl } from '../../../domain/lotStatus'

interface LotDimensionImageProps {
  lotCode: string
}

// Imagen de cotas (spec: un lote no muestra sus lados como texto, sino
// una imagen individual con la forma y las medidas). Si el archivo
// todavía no existe en public/lot-details/, no rompe la ficha -- solo
// avisa que falta, sin inventar dimensiones.
export function LotDimensionImage({ lotCode }: LotDimensionImageProps) {
  const [missing, setMissing] = useState(false)

  if (missing) {
    return <Alert variant="info">Imagen de dimensiones no disponible</Alert>
  }

  return (
    <img
      className="lot-sheet__dimension-image"
      src={dimensionImageUrl(lotCode)}
      alt={`Cotas del lote ${lotCode}`}
      onError={() => setMissing(true)}
    />
  )
}
