/** Onglet « Bilan complet » du Dashboard — vue d'ensemble des bilans :
 *  sélecteur de bilan, hero score donut + composites, stats XL, profil
 *  musculo, zones FC, forces / à travailler.
 *
 *  Le contenu vit dans `DashboardTab` (historique) pour minimiser le churn
 *  des imports / hooks. On re-exporte simplement ici. */
export { DashboardTab as BilanOverview } from '../tabs/DashboardTab'
