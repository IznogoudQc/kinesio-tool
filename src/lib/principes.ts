import { Apple, Dumbbell, Moon, Smile, Wind, type LucideIcon } from 'lucide-react'

/** Cinq piliers de bien-être affichés en clôture des documents client (contenu
 *  fixe). Source unique pour le document HTML et le rapport PDF. */
export interface Principe {
  icon: LucideIcon
  title: string
  line: string
}

export const PRINCIPES: Principe[] = [
  { icon: Apple, title: 'Bonne alimentation', line: 'Nourrir son corps, sans se priver.' },
  { icon: Dumbbell, title: 'De bons exercices', line: 'Bouger régulièrement, à votre rythme.' },
  { icon: Smile, title: 'Pensées positives', line: 'Un mental qui soutient l’effort.' },
  { icon: Wind, title: 'Bonne respiration', line: 'Le souffle, un outil de récupération.' },
  { icon: Moon, title: 'Bon sommeil', line: 'C’est la nuit que le corps se répare.' }
]
