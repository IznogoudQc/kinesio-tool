import { Apple, Dumbbell, Sparkles, Moon, Smile, Wind, type LucideIcon } from 'lucide-react'

/** Piliers de bien-être affichés en clôture des documents client (contenu
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

/** Principe personnalisé optionnel (6e pilier), éditable par Marie par client. */
export interface CustomPrincipe {
  title?: string | null
  line?: string | null
}

/** Principes à afficher pour ce client : les cinq de base, plus un 6e
 *  personnalisé si Marie a rempli un titre. */
export function principesFor(custom?: CustomPrincipe): Principe[] {
  const title = custom?.title?.trim()
  if (!title) return PRINCIPES
  return [...PRINCIPES, { icon: Sparkles, title, line: (custom?.line ?? '').trim() }]
}

/** Mot du nombre de principes (« Cinq » / « Six »). */
export function principesCountWord(custom?: CustomPrincipe): string {
  return principesFor(custom).length === 6 ? 'Six' : 'Cinq'
}
