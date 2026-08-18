/**
 * Les sections sous lesquelles Marie classe ses notes de séance.
 *
 * Ces notes sont PRIVÉES : elles vivent dans le tableau de bord et n'entrent
 * ni dans le PDF ni dans le document HTML remis au client. Elles sont stockées
 * dans `client_notes`, la table du journal clinique, qui n'a jamais été lue par
 * un rendu de rapport.
 *
 * Les clés sont écrites en base — les renommer casserait les notes existantes.
 * Les libellés, eux, peuvent changer librement.
 */
export const NOTE_SECTIONS = [
  { key: 'composition', label: 'Composition corporelle' },
  { key: 'aerobie', label: 'Aptitude aérobie' },
  { key: 'musculo', label: 'Aptitude musculosquelettique globale' },
  { key: 'objectif', label: 'Objectif du client' },
  { key: 'general', label: 'Général' }
] as const

export type NoteSectionKey = (typeof NOTE_SECTIONS)[number]['key']

export const NOTE_SECTION_KEYS: NoteSectionKey[] = NOTE_SECTIONS.map(s => s.key)

/**
 * Libellé d'une section.
 *
 * `null` correspond aux notes écrites AVANT l'existence des sections, dans
 * l'onglet Notes : elles n'appartiennent à aucune section et gardent leur place
 * dans le journal complet plutôt que d'être rangées d'office quelque part.
 */
export function libelleSection(key: string | null | undefined): string | null {
  return NOTE_SECTIONS.find(s => s.key === key)?.label ?? null
}
