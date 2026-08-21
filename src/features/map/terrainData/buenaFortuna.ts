import type { TerrainLayout } from '../TerrainMap'

// Layout del terreno "Buena Fortuna" (5 manzanas: X-10, Y-10, Y-11, Z-10,
// Z-11 -- ver plano de lotización). Es una APROXIMACIÓN TOPOLÓGICA, no un
// trazado exacto del plano real (no hay archivo vectorial/DXF todavía):
// respeta la agrupación y el orden relativo de las manzanas (X-10 y el
// parque a la izquierda, Y-10/Y-11 al centro, Z-10/Z-11 a la derecha),
// pero cada lote se dibuja como una celda rectangular en una grilla de 2
// columnas, no con su forma real.
//
// A propósito, este archivo NO repite área/perímetro/lot_code de cada
// lote (esos datos viven una sola vez, en `lots` de Supabase -- docs
// §15 "no duplicar datos"). Solo describe DÓNDE dibujar cada manzana; la
// cantidad de filas de cada una se calcula en tiempo de render a partir
// de cuántos lotes trae `lot_status_view` para ese `block`, no de una
// lista fija acá.
//
// Preparado para más terrenos (docs §16): un terreno nuevo es un archivo
// como este más adelante, no un cambio en el componente del mapa.
export const BUENA_FORTUNA_LAYOUT: TerrainLayout = {
  viewBox: { width: 1400, height: 1200 },
  cell: { width: 90, height: 68, gap: 8, cols: 2 },
  manzanas: [
    { block: 'X-10', originX: 40, originY: 130, labelX: 134, labelY: 110 },
    { block: 'Y-10', originX: 478, originY: 130, labelX: 572, labelY: 110 },
    { block: 'Y-11', originX: 706, originY: 130, labelX: 800, labelY: 110 },
    { block: 'Z-10', originX: 944, originY: 130, labelX: 1038, labelY: 110 },
    { block: 'Z-11', originX: 1172, originY: 130, labelX: 1266, labelY: 110 },
  ],
  streets: [
    { x: 0, y: 0, width: 1400, height: 70, label: 'Carretera asfaltada a Achaya' },
    { x: 228, y: 70, width: 50, height: 1130 },
    { x: 666, y: 70, width: 40, height: 1130 },
    { x: 894, y: 70, width: 50, height: 1130 },
    { x: 1132, y: 70, width: 40, height: 1130 },
  ],
  park: { x: 278, y: 130, width: 150, height: 616, label: 'PARQUE' },
}
