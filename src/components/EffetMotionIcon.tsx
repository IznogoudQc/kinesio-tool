interface EffetMotionIconProps {
  size?: number
  className?: string
  /** Couleur de la traînée d'accent. Dorée par défaut ; à changer quand
   * l'icône elle-même est déjà dorée, sinon la traînée s'y fond. */
  accent?: string
}

/** Coureur et trois traînées de vent inspirés du logo Effet.
 * La silhouette hérite de la couleur du menu pour rester visible sur le marine.
 * L'accent chaud reprend la palette dorée de l'application. */
export function EffetMotionIcon({ size = 20, className, accent = 'var(--color-gold, #d4a574)' }: EffetMotionIconProps) {
  return (
    <svg
      viewBox="0 0 160 144"
      width={size}
      height={size}
      fill="currentColor"
      className={className}
      style={{ flexShrink: 0 }}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="119" cy="18" r="12" />
      <path d="M55 39C72 20 94 20 111 34L123 49C132 47 138 43 145 39C140 51 132 58 122 61C117 62 112 54 106 49L94 66C91 71 94 74 100 77L111 83C120 88 121 94 117 104L105 132C102 138 100 139 100 133L103 102C104 97 101 95 95 93L82 89C69 85 66 79 72 69L88 43C78 35 68 34 55 39Z" />
      <path d="M20 58C39 39 57 47 80 42C69 61 43 45 20 58Z" fill={accent} />
      <path d="M12 80C32 58 49 73 72 63C59 86 35 69 12 80Z" />
      <path d="M4 106C27 79 47 100 70 78L83 89C58 119 35 88 4 106Z" />
    </svg>
  )
}
