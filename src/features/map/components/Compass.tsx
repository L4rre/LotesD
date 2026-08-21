// Brújula fija respecto a la pantalla (spec §12), con el norte hacia
// arriba. Vive fuera del contenido con pan/zoom del mapa a propósito.
export function Compass() {
  return (
    <svg className="map-compass" viewBox="0 0 100 100" role="img" aria-label="Norte hacia arriba">
      <circle cx="50" cy="50" r="46" fill="#ffffff" stroke="#c7cdc8" strokeWidth="2" />
      <line x1="50" y1="12" x2="50" y2="88" stroke="#8a938c" strokeWidth="1.5" />
      <line x1="12" y1="50" x2="88" y2="50" stroke="#8a938c" strokeWidth="1.5" />
      <polygon points="50,10 43,32 57,32" fill="#1f7a4d" />
      <text x="50" y="27" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1f7a4d">
        N
      </text>
      <text x="50" y="82" textAnchor="middle" fontSize="12" fill="#5b6660">
        S
      </text>
      <text x="16" y="54" textAnchor="middle" fontSize="12" fill="#5b6660">
        O
      </text>
      <text x="84" y="54" textAnchor="middle" fontSize="12" fill="#5b6660">
        E
      </text>
    </svg>
  )
}
