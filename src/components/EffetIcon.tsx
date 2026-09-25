interface EffetIconProps {
  /** Côté du carré, en pixels. Les icônes lucide voisines sont à 20 dans la barre. */
  size?: number
  className?: string
}

/**
 * Logo d'Effet — trois courbes de souffle qui montent vers la droite, et le
 * point où elles aboutissent.
 *
 * Tout est en `currentColor` pour se fondre parmi les icônes lucide de la barre
 * latérale : elles héritent déjà la couleur du texte, y compris au survol et à
 * l'état actif. Les opacités décroissantes donnent la profondeur sans imposer
 * une seconde teinte, qui jurerait partout sauf sur le marine.
 *
 * Épaisseurs calées sur lucide (stroke-width 2 pour un viewBox de 24, soit 10
 * pour 120) : en dessous, le trait disparaît à 20 px. Le viewBox est recadré sur
 * le dessin (104 au lieu de 120) et les opacités restent hautes (0,7 / 0,9) :
 * elles se multiplient avec le crème à 60 % des liens inactifs, et plus bas le
 * souffle pesait nettement moins que Clients et Paramètres.
 */
export function EffetIcon({ size = 20, className }: EffetIconProps) {
  return (
    <svg
      viewBox="4 5 104 104"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M 16 86 Q 48 76, 76 56"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.7"
      />
      <path
        d="M 14 68 Q 54 58, 96 30"
        fill="none"
        stroke="currentColor"
        strokeWidth="11"
        strokeLinecap="round"
      />
      <path
        d="M 22 50 Q 48 42, 70 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="10"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx="96" cy="30" r="6" fill="currentColor" />
    </svg>
  )
}
