import type { TerrainLayout } from '../TerrainMap'

// Layout real del terreno "Buena Fortuna" (5 manzanas: X-10, Y-10, Y-11,
// Z-10, Z-11), extraído directamente del plano vectorial (AutoCAD): para
// cada número de lote impreso en el plano se localizó su coordenada
// exacta, se pasó al marco local de su manzana (eje x = a lo largo de la
// vía, eje y = profundidad) y se convirtió a metros. Captura formas
// reales no rectangulares (ej. MZ X-10 se abre en abanico hacia el
// parque) -- a diferencia del layout anterior (aproximación topológica
// en grilla), esto es geometría verificada, no una aproximación.
//
// A propósito, este archivo NO repite área/perímetro/lot_code de cada
// lote (esos datos viven una sola vez, en `lots` de Supabase -- docs
// §15 "no duplicar datos"): solo posición/rotación/forma. El frente y
// fondo de cada lote se derivan en TerrainMap con
// `resolverDimensiones(lot.area, lot.perimeter)` a partir de los datos
// reales de Supabase, no de un valor guardado acá.
//
// Preparado para más terrenos (docs §16): un terreno nuevo es un archivo
// como este más adelante, no un cambio en TerrainMap.

// Centros reales (m) y semi-tamaño de lienzo local por manzana.
const MANZANAS_META: Record<string, { cx: number; cy: number; halfW: number; halfH: number }> = {
  'X-10': { cx: 100.33, cy: 126.2, halfW: 30, halfH: 34 },
  'Y-10': { cx: 156.09, cy: 198.31, halfW: 55, halfH: 25 },
  'Y-11': { cx: 189.41, cy: 171.05, halfW: 55, halfH: 15 },
  'Z-10': { cx: 203.74, cy: 261.2, halfW: 26, halfH: 26 },
  'Z-11': { cx: 240.88, cy: 233.4, halfW: 26, halfH: 22 },
}

// Posición local (x, y) de cada lote dentro del marco de su manzana,
// antes de aplicar translate(cx, cy) + rotate(ROT_DEG).
const LOT_POSITIONS: Record<string, Record<string, [number, number]>> = {
  'X-10': {
    '18': [-23.78592415005848, -5.6006868107981225],
    '17': [-18.768737360205805, -9.788770082386424],
    '16': [-11.16696806363276, -9.791806042250549],
    '15': [-3.548511517758951, -9.77279861521213],
    '14': [4.03653960715852, -9.797872164036605],
    '08': [4.052513717059239, 9.217533151579184],
    '07': [-3.5492555795138023, 9.220569111443307],
    '06': [-11.151007868791186, 9.223627490014408],
    '05': [-18.75277716536423, 9.226663449878533],
    '04': [-24.048074230728982, 12.132699320408692],
    '09': [18.182220124055057, 15.164883981471935],
    '10': [18.179159619572008, 7.563128889856195],
    '11': [18.17614066700357, -0.03861798800986671],
    '12': [18.156386535483865, -7.662424873543274],
    '13': [18.170046328568347, -15.242139573860293],
  },
  'Y-10': {
    '09': [37.93502929622445, 13.401132246154226],
    '10': [37.92233836497267, 3.9017696573615948],
    '11': [37.9316905043957, -5.614292227309522],
    '12': [37.93692928987592, -15.122048389417039],
    '20': [-26.270659334776965, -10.698392738462223],
    '19': [-18.668895304800692, -10.696379967780134],
    '18': [-11.067148267239503, -10.694389627086007],
    '17': [-3.465384237263233, -10.692376856403918],
    '16': [4.136379792712997, -10.690364085721823],
    '15': [11.738126830274219, -10.688373745027718],
    '14': [19.33989086025046, -10.686360974345607],
    '08': [26.92827875315517, 8.309000913536671],
    '07': [19.32652610809696, 8.307014820946325],
    '06': [11.724767685617717, 8.304997802160473],
    '05': [4.123006544351982, 8.303000494576132],
    '04': [-3.4787433819197764, 8.300994690784279],
    '03': [-11.063809475410723, 8.32103484637772],
    '02': [-18.665550905474966, 8.319040257579847],
    '01': [-26.267320542948184, 8.317031735001507],
    '25': [-38.75873614375422, 14.275093423105858],
    '24': [-38.77344238015213, 6.651283603668354],
    '23': [-38.75473031359155, -0.9284373556331138],
    '22': [-38.76941955757443, -8.552224745082642],
    '21': [-38.76742437404197, -16.15398869009685],
    '13': [26.941646394019198, -10.684359418657527],
  },
  'Y-11': {
    '10': [39.53261871960907, 8.931593183595908],
    '11': [39.529422894370974, 0.7766027667504898],
    '12': [39.535826301989225, -8.739465812612728],
    '20': [-24.674502250428382, -4.287565366320946],
    '19': [-17.067289932471418, -4.299113677036913],
    '18': [-9.470990672781868, -4.288282306762811],
    '17': [-1.8692207780918413, -4.28863381447246],
    '16': [5.7325379042424105, -4.2889768224932245],
    '15': [13.33429079955466, -4.289350754914314],
    '14': [20.941382584883478, -4.328447642661249],
    '23': [-37.17226106753173, 5.464230333698724],
    '22': [-37.15465725349187, -2.1459247753031],
    '21': [-37.15500876120152, -9.747694669993102],
    '13': [28.53781087689005, -4.290056483000449],
  },
  'Z-11': {
    '25': [-13.75831075459084, 17.05197251924028],
    '24': [-14.222417792303244, 7.52516136049262],
    '23': [-14.672252526022659, -1.9414662079697131],
    '22': [-15.118613924080814, -11.447058391401809],
    '21': [-3.127339904024619, -7.625699713290851],
    '20': [4.479815002119416, -7.958020172543996],
    '19': [12.058924744317652, -8.349757758805081],
    '18': [18.18246602154654, -8.528960518022195],
    '04': [19.04537150491776, 9.497650272167098],
    '03': [12.972871027509932, 10.64368636603639],
    '02': [5.379726538066651, 11.005711804106655],
    '01': [-2.2171090250020313, 11.376232186794365],
  },
  'Z-10': {
    '25': [-14.351164102985425, 13.403041316735788],
    '24': [-14.36681539908327, 3.9036916254273164],
    '23': [-14.364522766631529, -5.604069954748907],
    '22': [-14.376063287562836, -15.111726645244392],
    '21': [-2.563455637642082, -10.702128431154073],
    '20': [5.038288848403338, -10.702495988808513],
    '19': [12.640050333826558, -10.702841121751483],
    '18': [19.2648980764317, -10.512843865056952],
    '04': [19.32163544650537, 8.322539374235085],
    '03': [12.654746251750954, 8.301376096069436],
    '02': [5.0475339337939875, 8.312924406785406],
    '01': [-2.5542077491624875, 8.313289839517614],
  },
}

// Lotes presentes en la tabla maestra pero sin posición extraída (la
// etiqueta cayó fuera del radio de búsqueda en el PDF) -- se extrapolan
// desde el vecino más cercano de la misma fila.
const FALLBACK_POS: Record<string, [number, number]> = {
  'Y-11-08': [46.9, 8.9], // extrapolado desde el lote 10 (misma fila, dirección +x)
}

const PARQUE_POLY: [number, number][] = [
  [119.92, 101.74],
  [140.75, 129.21],
  [148.05, 123.73],
  [123.73, 99.92],
]

// Ángulo real del terreno respecto al norte (extraído del plano): todo
// el mapa se rota este ángulo para que las manzanas se vean prolijas en
// pantalla (ejes alineados), así que la brújula debe rotar lo mismo para
// seguir señalando el norte real -- ver Compass.tsx.
const ROT_DEG = -37.17

export const BUENA_FORTUNA_LAYOUT: TerrainLayout = {
  rotationDeg: ROT_DEG,
  manzanas: MANZANAS_META,
  lotPositions: LOT_POSITIONS,
  fallbackPositions: FALLBACK_POS,
  park: { polygon: PARQUE_POLY, label: 'PARQUE' },
}
