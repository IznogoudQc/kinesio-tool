import logo from '../assets/logo-conseil.png'
// Filigrane dont le fondu est CUIT dans l'image : `foret.webp` fondue dans
// CREAM, effacée à 22 %, bords égaux au fond. À l'impression, Chromium sort un
// bord net aussi bien avec `mask-image` qu'avec des dégradés transparents. Elle
// s'affiche donc telle quelle (`100% 100%`, sans recadrage ni opacité), et ne
// pèse que 44 ko en base64 dans chaque document autonome.
import foret from '../assets/foret-filigrane.webp'
import { computeAge } from '../lib/norms'
import { formatBilanDate } from '../pages/client/bilanFields'
import './document-cover.css'

/**
 * Page de couverture commune aux documents remis au client.
 *
 * Partagée par le bilan (bundle de l'app, `pages/ReportPage`) et par les
 * documents autonomes (bundle `standalone/`). D'où deux partis pris :
 *
 *  - tout est en style en ligne, sans Tailwind : les deux bundles ne compilent
 *    pas les mêmes classes, et un utilitaire absent d'un côté passerait
 *    inaperçu jusqu'au PDF ;
 *  - les unités sont en `mm` et `pt`, comme le reste du rendu d'impression.
 *
 * Les assets sont importés ici plutôt que passés en props : le bundle autonome
 * les inline en base64 (`assetsInlineLimit` très haut dans
 * `vite.standalone.config.ts`), ce qui garde le document lisible hors ligne.
 *
 * Le bloc `vedette` et la grille `reperes` sont facultatifs : un plan nutrition
 * sans objectif chiffré n'a pas de grand nombre à montrer, et forcer un tiret
 * au milieu d'une carte marine ferait croire à une donnée manquante.
 */

const MARINE = '#001331'
const GOLD = '#b0894f'
const GOLD_SOFT = '#c9a77a'
const CREAM = '#f4efe6'
const INK_SOFT = '#6b6555'
// Posées en ligne : le bilan les tient de `.report-body` / `.report-display`,
// les documents autonomes n'ont pas ces classes (voir document-cover.css).
const SERIF = "'Fraunces', Georgia, serif"
const SANS = "'Inter', system-ui, sans-serif"

export interface CoverVedette {
  /** Petites capitales dorées au-dessus du nombre. */
  surtitre: string
  /** Le grand nombre, déjà formaté (l'appelant sait mieux l'arrondi voulu). */
  valeur: string
  /** Ce qui suit le nombre, en petit. Ex. « sur 4 », « lb ». */
  unite?: string
  /** Ligne blanche sous le nombre. Ex. « Excellent · Bilan nº 4 ». */
  mention?: string
}

export interface CoverRepere {
  label: string
  /** Déjà formatée, ou `null` pour afficher un tiret. */
  valeur: string | null
  unite?: string
}

export interface DocumentCoverProps {
  /** Petites capitales dorées. Ex. « Rapport d'évaluation ». */
  surtitre: string
  /** Titre en serif. Ex. « Votre bilan ». */
  titre: string
  clientName: string
  /** Ligne de repères déjà assemblée. Ex. « 25 juin 2026 · 49 ans · Homme ». */
  reperesTexte?: string
  coachName?: string
  avatarUrl?: string | null
  vedette?: CoverVedette | null
  reperes?: CoverRepere[]
  /** Petites capitales dorées du bas de page. */
  pieceSurtitre?: string
  /** Phrase sous le sur-titre de pied. */
  pieceTexte?: string
}

const SEXE: Record<string, string> = { F: 'Femme', M: 'Homme' }

/** `AAAA-MM-JJ` d'un horodatage, en heure LOCALE : `toISOString().slice(0, 10)`
 *  donnerait le lendemain passé 20 h au Québec. */
export function jourLocal(horodatage: string): string {
  const d = new Date(horodatage)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** « 25 juin 2026  ·  49 ans  ·  Homme » — ce qu'on sait, dans cet ordre. */
export function ligneReperes(dateIso: string | null, birthdate: string | null, sex: string | null): string | undefined {
  const age = computeAge(birthdate)
  const ligne = [dateIso ? formatBilanDate(dateIso) : null, age !== null ? `${age} ans` : null, sex ? SEXE[sex] ?? null : null]
    .filter(Boolean)
    .join('  ·  ')
  return ligne || undefined
}

export function DocumentCover({
  surtitre,
  titre,
  clientName,
  reperesTexte,
  coachName,
  avatarUrl,
  vedette,
  reperes,
  pieceSurtitre = 'Vos résultats, vos progrès, vos repères',
  pieceTexte = 'Un document personnalisé pour accompagner votre suivi.'
}: DocumentCoverProps) {
  return (
    // `height: 100%` et non `flex: 1` : le parent (section du bilan, page de
    // couverture des documents autonomes) n'est pas un conteneur flex, et le
    // fond crème s'arrêtait avec le contenu en laissant une bande blanche.
    <div
      className="document-cover"
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: CREAM, position: 'relative', overflow: 'hidden', fontFamily: SANS }}
    >
      {/* La forêt n'habille que le bas de page, sous les chiffres, et s'efface
          vers le haut et vers la gauche (fondu cuit dans l'image, voir l'import). */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: '65%',
          height: '27%',
          backgroundImage: `url(${foret})`,
          backgroundSize: '100% 100%'
        }}
      />

      <div style={{ background: MARINE, padding: '11mm 20mm', display: 'flex', alignItems: 'center', gap: '5mm', position: 'relative' }}>
        <img src={logo} alt="" style={{ height: '13mm', width: 'auto' }} />
        <span style={{ color: '#fff', fontSize: '15pt', fontWeight: 700, letterSpacing: '0.01em' }}>Kinésio Conseil</span>
      </div>

      <div style={{ padding: '14mm 20mm 12mm', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>
        <p style={{ fontSize: '8.5pt', letterSpacing: '0.16em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
          {surtitre}
        </p>
        <h1 className="report-display" style={{ fontFamily: SERIF, fontWeight: 400, fontSize: '40pt', color: MARINE, marginTop: '4mm', lineHeight: 1.05 }}>
          {titre}
        </h1>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10mm', marginTop: '5mm' }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: '17pt', fontWeight: 700, color: MARINE }}>{clientName}</p>
            {reperesTexte && <p style={{ fontSize: '10.5pt', color: INK_SOFT, marginTop: '3mm' }}>{reperesTexte}</p>}
            {coachName && (
              <p style={{ fontSize: '10.5pt', color: INK_SOFT, marginTop: '1.5mm' }}>Préparé par {coachName}</p>
            )}
          </div>
          {avatarUrl && (
            <div
              style={{
                width: '30mm',
                height: '30mm',
                borderRadius: '50%',
                flexShrink: 0,
                background: '#fff',
                border: `1.2pt solid ${GOLD_SOFT}`,
                overflow: 'hidden'
              }}
            >
              <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )}
        </div>

        {vedette && (
          <div style={{ background: MARINE, borderRadius: '7mm', padding: '10mm 12mm', marginTop: '11mm' }}>
            <p style={{ fontSize: '8.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD_SOFT, fontWeight: 700 }}>
              {vedette.surtitre}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '5mm', marginTop: '5mm' }}>
              <span className="report-display" style={{ fontFamily: SERIF, fontSize: '54pt', lineHeight: 1, color: '#fff', fontWeight: 400 }}>
                {vedette.valeur}
              </span>
              {vedette.unite && <span style={{ fontSize: '12pt', color: '#ffffffb0' }}>{vedette.unite}</span>}
            </div>
            {vedette.mention && (
              <p style={{ fontSize: '11pt', color: '#fff', fontWeight: 700, marginTop: '5mm' }}>{vedette.mention}</p>
            )}
          </div>
        )}

        {reperes && reperes.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: '16mm', rowGap: '8mm', marginTop: '11mm' }}>
            {reperes.map(r => (
              <div key={r.label}>
                <p style={{ fontSize: '10pt', color: INK_SOFT }}>{r.label}</p>
                <p style={{ fontSize: '16pt', fontWeight: 700, color: MARINE, marginTop: '1.5mm' }}>
                  {r.valeur ?? '—'}
                  {r.valeur !== null && r.unite && (
                    <span style={{ fontSize: '11pt', fontWeight: 500, color: INK_SOFT }}>&nbsp;{r.unite}</span>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* `marginTop: auto` pousse la phrase en bas de page ; le `paddingTop`
            garde un vrai blanc quand la grille remplit la page. */}
        <div style={{ marginTop: 'auto', paddingTop: '10mm' }}>
          <p style={{ fontSize: '8.5pt', letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
            {pieceSurtitre}
          </p>
          <p style={{ fontSize: '10.5pt', color: INK_SOFT, marginTop: '3mm' }}>{pieceTexte}</p>
        </div>
      </div>
    </div>
  )
}
