import { Apple, Dumbbell, Heart, Moon, Smile, Wind, type LucideIcon } from 'lucide-react'

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

/** Clin d'œil privé : un 6e principe, uniquement pour le bilan de Nicholas Jean. */
const JOKE_PRINCIPE: Principe = {
  icon: Heart,
  title: 'Bon sexe',
  line: 'Faites l’amour souvent, c’est bon pour votre testostérone.'
}

/** Principes à afficher pour ce client (ajoute le clin d'œil pour Nicholas Jean). */
export function principesFor(clientName: string | null | undefined): Principe[] {
  const isNicholas = (clientName ?? '').trim().toLowerCase() === 'nicholas jean'
  return isNicholas ? [...PRINCIPES, JOKE_PRINCIPE] : PRINCIPES
}

/** Mot du nombre de principes (« Cinq » / « Six »). */
export function principesCountWord(clientName: string | null | undefined): string {
  return principesFor(clientName).length === 6 ? 'Six' : 'Cinq'
}
