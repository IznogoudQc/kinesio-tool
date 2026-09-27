/**
 * Sommaire flottant des documents client.
 *
 * Une barre qui apparaît dès que l'ouverture est passée, liste les sections du
 * document, souligne celle qu'on est en train de lire et offre un bouton
 * Imprimer. À l'écran seulement : `editorial.css` la masque à l'impression.
 *
 * Construite en parcourant le DOM plutôt qu'en composant React, pour une
 * raison : les quatre documents (bilan, nutrition, journal, mesures) ont des
 * structures de sections différentes, mais tous posent un `<section>` avec un
 * `<h2>`. Un seul parcours les couvre donc tous, là où un composant aurait
 * demandé que chacun déclare sa table des matières.
 *
 * Aucune donnée n'est lue ni recalculée : on ne fait que référencer des
 * sections déjà rendues.
 */

/** Libellés courts pour les sections connues du bilan. Ailleurs, on retombe
 *  sur le sur-titre puis sur le titre de la section. */
const LIBELLES_CONNUS: Record<string, string> = {
  'vue-ensemble': "Vue d'ensemble",
  composition: 'Composition',
  cardio: 'Endurance',
  'force-mobilite': 'Force et mobilité',
  global: 'Score global',
  'nutrition-plan': 'Nutrition'
}

/** Le mot qui ouvre la barre, selon le document. */
const INTITULES: Record<string, string> = {
  report: 'Votre bilan',
  nutrition: 'Votre plan',
  foodlog: 'Votre journal',
  mesures: 'Vos mesures'
}

/** Hauteur sous laquelle une section est considérée « en cours de lecture ». */
const SEUIL_SECTION_COURANTE = 150
/** L'ouverture doit être presque sortie de l'écran avant que la barre paraisse. */
const SEUIL_APPARITION = 90

function construire(racine: HTMLElement, docType: string): boolean {
  // Déjà posée (remontage React en mode strict, par exemple).
  if (document.querySelector('.refined-nav')) return true

  const ouverture = racine.querySelector<HTMLElement>('.ed-hero')
  if (!ouverture) return false

  const sections = [...racine.querySelectorAll('section')].filter(s => s.querySelector('h2'))
  if (sections.length === 0) return false

  const nav = document.createElement('nav')
  nav.className = 'refined-nav'
  nav.hidden = true
  nav.setAttribute('aria-label', 'Sommaire du document')

  const intitule = document.createElement('span')
  intitule.textContent = INTITULES[docType] ?? INTITULES.report
  nav.append(intitule)

  const liens = document.createElement('div')
  liens.className = 'refined-links'
  nav.append(liens)

  if (!ouverture.id) ouverture.id = 'document-ouverture'
  const versHaut = document.createElement('a')
  versHaut.href = `#${ouverture.id}`
  versHaut.textContent = 'Accueil'
  liens.append(versHaut)

  const paires: [HTMLElement, HTMLAnchorElement][] = []
  sections.forEach((section, i) => {
    if (!section.id) section.id = `document-section-${i + 1}`
    const titre = section.querySelector('h2')
    const surTitre = section.querySelector('.ed-eyebrow')
    const lien = document.createElement('a')
    lien.href = `#${section.id}`
    lien.textContent =
      LIBELLES_CONNUS[section.id] ??
      surTitre?.textContent?.trim() ??
      titre?.textContent?.trim() ??
      `Section ${i + 1}`
    if (titre?.textContent) lien.title = titre.textContent
    liens.append(lien)
    paires.push([section, lien])
  })

  const imprimer = document.createElement('button')
  imprimer.type = 'button'
  imprimer.textContent = 'Imprimer'
  imprimer.addEventListener('click', () => window.print())
  nav.append(imprimer)

  document.body.append(nav)

  // Le défilement peut émettre des dizaines d'événements par seconde ; on ne
  // recalcule qu'une fois par trame.
  let planifie = false
  function rafraichir(): void {
    planifie = false
    nav.hidden = ouverture!.getBoundingClientRect().bottom > SEUIL_APPARITION
    let courante: HTMLAnchorElement | null = null
    for (const [section, lien] of paires) {
      if (section.getBoundingClientRect().top <= SEUIL_SECTION_COURANTE) courante = lien
    }
    for (const [, lien] of paires) {
      if (lien === courante) lien.setAttribute('aria-current', 'location')
      else lien.removeAttribute('aria-current')
    }
  }

  window.addEventListener(
    'scroll',
    () => {
      if (planifie) return
      planifie = true
      requestAnimationFrame(rafraichir)
    },
    { passive: true }
  )
  rafraichir()
  return true
}

/**
 * Pose le sommaire dès que React a rendu le document. Appelé juste après
 * `createRoot(...).render(...)`, donc avant que le DOM existe : on réessaie
 * à chaque mutation jusqu'à ce que les sections soient là.
 */
export function installerSommaireFlottant(docType: string): void {
  const racine = document.getElementById('root')
  if (!racine) return
  if (construire(racine, docType)) return

  const observateur = new MutationObserver(() => {
    if (construire(racine, docType)) observateur.disconnect()
  })
  observateur.observe(racine, { childList: true, subtree: true })
}
