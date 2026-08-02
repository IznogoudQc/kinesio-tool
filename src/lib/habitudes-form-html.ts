/**
 * Formulaire d'habitudes de vie **autonome**, à envoyer au client par courriel.
 *
 * Un seul fichier porte les DEUX questionnaires — le FANTASTIC (25 énoncés) et
 * l'ÉAS (3 questions, Figure 4-6 du Guide du conseiller) — et le client renvoie
 * un seul code. Marie envoie un courriel, elle importe une fois.
 *
 * Produit un fichier HTML unique : ni feuille de style externe, ni police
 * distante, ni requête réseau d'aucune sorte. Le client l'ouvre depuis sa pièce
 * jointe, dans n'importe quel navigateur, en ligne ou non — et rien de ce qu'il
 * répond ne quitte son appareil tant qu'il ne renvoie pas lui-même son code.
 *
 * ── Pourquoi pas un PDF remplissable ────────────────────────────────────────
 * Marie avait demandé « un PDF interactif ». L'application produit ses PDF avec
 * le moteur d'impression d'Electron, qui rend du HTML en PDF **statique** : il
 * ne sait pas fabriquer de champs de formulaire. Et surtout, les lecteurs PDF
 * des téléphones gèrent mal les formulaires, alors que tous ont un navigateur.
 * Le client peut toujours imprimer cette page s'il préfère le papier.
 *
 * ── Pourquoi le client ne voit pas son score ────────────────────────────────
 * Ces questionnaires se lisent avec un professionnel. Un « 46 sur 100 — À améliorer »
 * reçu seul devant son écran décourage sans rien apprendre, ce que Marie veut
 * précisément éviter. Le client voit sa progression de remplissage ; le score et
 * son interprétation restent du côté de la kinésiologue.
 *
 * L'ÉAS ajoute une raison technique : sa cotation dépend du SEXE du client (voir
 * `eas.ts`). La page ne le connaît pas et n'a pas à le connaître — elle ne
 * transporte que les réponses, l'application cote avec le dossier.
 */

import { FANTASTIC_SECTIONS, FANTASTIC_KEYS, itemKey, selectableChoices } from './fantastic.ts'
import { CODE_PREFIX } from './habitudes-code.ts'
import { EAS_QUESTIONS } from './eas.ts'

/** Échappe le texte destiné au corps du document. */
function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Échappe une chaîne insérée dans le script inline.
 *
 * `JSON.stringify` seul ne suffit pas : la séquence `</script>` dans une valeur
 * refermerait la balise et casserait la page. Rarissime avec des noms de
 * clients, mais le coût de s'en prémunir est nul.
 */
function jsString(s: string): string {
  return JSON.stringify(s).replace(/</g, '\\u003c')
}

export interface HabitudesFormOptions {
  /** Nom du client, pré-rempli en tête du formulaire. */
  clientName?: string
  /** Nom de la kinésiologue, affiché dans le pied de page. */
  kineName?: string
  /** Adresse où renvoyer le code, si on veut la rappeler au client. */
  replyTo?: string
}

/**
 * Le calcul du code de retour, en JavaScript, pour la page autonome.
 *
 * ⚠️ Ce code **duplique** `encodeHabitudesCode` de `habitudes-code.ts` : la page
 * est un fichier isolé, elle ne peut rien importer. Une divergence entre les
 * deux produirait des codes que l'application refuserait — le client aurait tout
 * rempli pour rien.
 *
 * C'est pourquoi `habitudes-form-html.test.ts` extrait ce script de la page
 * générée, l'exécute, et vérifie qu'il produit exactement les mêmes codes que la
 * version TypeScript. Toute divergence casse les tests au lieu de casser un
 * client.
 */
const ENCODER_JS = `
const CTRL='23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
function checksum(body){
  let a=0,b=0;
  for(let i=0;i<body.length;i++){a=(a+body.charCodeAt(i)*(i+1))%1024;b=(b+a)%1024;}
  return CTRL[a%32]+CTRL[b%32];
}
function encode(answers,eas){
  let body='';
  for(const k of KEYS){
    const v=answers[k];
    body += (typeof v==='number'&&v>=0&&v<=4)?String(v):'-';
  }
  for(const k of EAS_KEYS){
    const v=eas[k];
    body += (typeof v==='number'&&v>=0&&v<=4)?String(v):'-';
  }
  return PREFIX+body+checksum(PREFIX+body);
}`

export function renderHabitudesForm(options: HabitudesFormOptions = {}): string {
  const { clientName = '', kineName = '', replyTo = '' } = options

  const sections = FANTASTIC_SECTIONS.map((section, si) => {
    const rows = section.items
      .map(item => {
        const key = itemKey(section, item)
        // Seules les colonnes portant un libellé sont des réponses. Deux
        // énoncés (drogues, conduite après avoir bu) n'en ont que deux sur la
        // feuille papier : les cases vides du milieu alignent les colonnes, ce
        // ne sont pas des choix. Les rendre cliquables proposait au client trois
        // réponses qui n'existent pas.
        const choix = selectableChoices(item)
        const choices = choix
          .map(
            ({ value, label }) => `<label class="choix">
              <input type="radio" name="${esc(key)}" value="${value}">
              <span class="pastille"></span>
              <span class="txt">${esc(label)}</span>
            </label>`
          )
          .join('')
        return `<div class="enonce" data-key="${esc(key)}">
          <p class="question">${esc(item.label)}</p>
          <div class="choix-rangee" style="--cols:${choix.length}">${choices}</div>
        </div>`
      })
      .join('')
    return `<section class="bloc">
      <h2><span class="num">${si + 1}</span>${esc(section.title)}</h2>
      ${rows}
    </section>`
  }).join('')

  // ── Partie B : ÉAS ────────────────────────────────────────────────────────
  // Rendu volontairement différent — liste verticale plutôt qu'échelle à cinq
  // colonnes. Ce sont deux instruments distincts, et les présenter à l'identique
  // laisserait croire à une suite du premier questionnaire.
  const easBloc = EAS_QUESTIONS.map(q => {
    const choix = q.choices
      .map(
        (c, ci) => `<label class="ligne">
          <input type="radio" name="eas.${q.key}" value="${ci}">
          <span class="pastille"></span>
          <span>${esc(c.label)}</span>
        </label>`
      )
      .join('')
    return `<div class="enonce" data-key="eas.${esc(q.key)}">
      <p class="question"><span class="qnum">#${q.numero}</span> ${esc(q.titre)}</p>
      <p class="qtexte">${esc(q.question)}</p>
      <div class="liste">${choix}</div>
    </div>`
  }).join('')

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Questionnaire sur les habitudes de vie</title>
<style>
  :root{
    --encre:#16232e; --doux:#5b6b78; --ligne:#dfe5ea;
    --fond:#f7f8f9; --carte:#ffffff; --accent:#1f6f6b; --accent-clair:#e8f2f1;
  }
  *{box-sizing:border-box}
  body{
    margin:0; background:var(--fond); color:var(--encre);
    font:16px/1.55 "Segoe UI",system-ui,-apple-system,sans-serif;
    padding:0 0 7rem;
  }
  .page{max-width:60rem;margin:0 auto;padding:0 1rem}
  header{background:var(--carte);border-bottom:1px solid var(--ligne);padding:2rem 0 1.5rem;margin-bottom:1.5rem}
  h1{margin:0 0 .4rem;font-size:1.5rem;line-height:1.25;text-wrap:balance}
  .sous{color:var(--doux);margin:0 0 1.25rem}
  .identite{display:flex;flex-wrap:wrap;gap:1rem}
  .identite label{flex:1 1 14rem;font-size:.82rem;color:var(--doux)}
  .identite input{
    display:block;width:100%;margin-top:.25rem;padding:.55rem .7rem;
    border:1px solid var(--ligne);border-radius:6px;font:inherit;color:var(--encre);background:#fff;
  }
  .consigne{background:var(--accent-clair);border-left:3px solid var(--accent);padding:.85rem 1rem;border-radius:0 6px 6px 0;margin-bottom:1.5rem}
  .consigne p{margin:0;font-size:.92rem}
  .bloc{background:var(--carte);border:1px solid var(--ligne);border-radius:10px;padding:1.25rem;margin-bottom:1rem;break-inside:avoid}
  .bloc h2{display:flex;align-items:center;gap:.6rem;margin:0 0 1rem;font-size:1.05rem;letter-spacing:.01em}
  .num{
    display:grid;place-items:center;width:1.6rem;height:1.6rem;flex:none;
    background:var(--accent);color:#fff;border-radius:50%;font-size:.85rem;font-weight:600;
  }
  .enonce{padding:.9rem 0;border-top:1px solid var(--ligne)}
  .bloc .enonce:first-of-type{border-top:0;padding-top:0}
  .question{margin:0 0 .6rem;font-size:.95rem}
  /* Le nombre de colonnes vient de --cols, posé en ligne par item (deux énoncés
     n'ont que 2 choix). Surtout PAS grid-template-columns en ligne : un style en
     ligne bat la feuille de style, media query comprise, et la bascule mobile
     plus bas ne pourrait jamais s'appliquer. */
  .choix-rangee{display:grid;grid-template-columns:repeat(var(--cols,5),1fr);gap:.4rem}
  .choix{
    display:flex;flex-direction:column;align-items:center;gap:.35rem;text-align:center;
    padding:.5rem .3rem;border:1px solid var(--ligne);border-radius:8px;cursor:pointer;
    background:#fff;transition:border-color .12s,background .12s;
  }
  .choix:hover{border-color:var(--accent)}
  .choix input{position:absolute;opacity:0;width:0;height:0}
  .pastille{width:1.05rem;height:1.05rem;border:2px solid #b9c4cc;border-radius:50%;flex:none;transition:all .12s}
  .choix input:checked ~ .pastille{border-color:var(--accent);background:var(--accent);box-shadow:inset 0 0 0 3px #fff}
  .choix:has(input:checked){border-color:var(--accent);background:var(--accent-clair)}
  .choix input:focus-visible ~ .pastille{outline:2px solid var(--accent);outline-offset:2px}
  .txt{font-size:.76rem;line-height:1.3;color:var(--doux)}
  .choix:has(input:checked) .txt{color:var(--encre);font-weight:600}
  .partie{
    display:flex;align-items:baseline;gap:.6rem;flex-wrap:wrap;
    margin:2rem 0 .9rem;font-size:1.15rem;letter-spacing:.01em;
  }
  .partie span{
    background:var(--accent);color:#fff;border-radius:999px;
    padding:.15rem .7rem;font-size:.72rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;
  }
  .intro{margin:0 0 1rem;color:var(--doux);font-size:.92rem}
  .qnum{color:var(--accent);font-weight:700;margin-right:.15rem}
  .qtexte{margin:.15rem 0 .7rem;font-size:.9rem;color:var(--doux)}
  .liste{display:flex;flex-direction:column;gap:.4rem}
  .ligne{
    display:flex;align-items:center;gap:.6rem;padding:.6rem .8rem;cursor:pointer;
    border:1px solid var(--ligne);border-radius:8px;background:#fff;font-size:.92rem;
    transition:border-color .12s,background .12s;
  }
  .ligne:hover{border-color:var(--accent)}
  .ligne input{position:absolute;opacity:0;width:0;height:0}
  .ligne:has(input:checked){border-color:var(--accent);background:var(--accent-clair);font-weight:600}
  .ligne input:focus-visible ~ .pastille{outline:2px solid var(--accent);outline-offset:2px}
  .barre{
    position:fixed;left:0;right:0;bottom:0;background:var(--carte);
    border-top:1px solid var(--ligne);box-shadow:0 -2px 12px rgba(0,0,0,.06);padding:.75rem 1rem;z-index:10;
  }
  .barre-in{max-width:60rem;margin:0 auto;display:flex;align-items:center;gap:1rem;flex-wrap:wrap}
  .avancement{flex:1 1 12rem;min-width:0}
  .jauge{height:6px;background:var(--ligne);border-radius:3px;overflow:hidden;margin-top:.35rem}
  .jauge span{display:block;height:100%;width:0;background:var(--accent);transition:width .2s}
  #compteur{font-size:.85rem;color:var(--doux);font-variant-numeric:tabular-nums}
  button{
    font:inherit;font-weight:600;padding:.65rem 1.35rem;border-radius:8px;border:0;
    background:var(--accent);color:#fff;cursor:pointer;
  }
  button:disabled{background:#c3ccd3;cursor:not-allowed}
  button.secondaire{background:#fff;color:var(--accent);border:1px solid var(--accent)}
  dialog{
    border:0;border-radius:12px;padding:0;max-width:34rem;width:calc(100% - 2rem);
    box-shadow:0 12px 40px rgba(0,0,0,.2);
  }
  dialog::backdrop{background:rgba(12,22,30,.55)}
  .modale{padding:1.5rem}
  .modale h2{margin:0 0 .5rem;font-size:1.15rem}
  .modale p{margin:0 0 1rem;font-size:.92rem;color:var(--doux)}
  .code{
    font-family:"Cascadia Mono",Consolas,ui-monospace,monospace;font-size:1.05rem;letter-spacing:.04em;
    background:var(--accent-clair);border:1px dashed var(--accent);border-radius:8px;
    padding:1rem;text-align:center;word-break:break-all;user-select:all;margin-bottom:1rem;
  }
  .actions{display:flex;gap:.6rem;flex-wrap:wrap}
  footer{text-align:center;color:var(--doux);font-size:.82rem;padding:2rem 1rem 0}
  @media (max-width:640px){
    .choix-rangee{grid-template-columns:1fr;gap:.3rem}
    .choix{flex-direction:row;justify-content:flex-start;text-align:left;padding:.6rem .75rem}
    .txt{font-size:.88rem}
  }
  @media print{
    body{background:#fff;padding-bottom:0}
    .barre,dialog{display:none!important}
    .bloc{border-color:#999;box-shadow:none}
    .choix{border-color:#999}
  }
  @media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>

<header>
  <div class="page">
    <h1>Questionnaire sur la participation à des activités physiques favorables à la santé</h1>
    <p class="sous">Un portrait de vos habitudes de vie, à remplir avant votre rencontre.</p>
    <div class="identite">
      <label>Nom<input id="nom" type="text" value="${esc(clientName)}" autocomplete="name"></label>
      <label>Date<input id="date" type="date"></label>
    </div>
  </div>
</header>

<div class="page">
  <div class="consigne">
    <p><strong>Choisissez la réponse qui reflète ce que vous vivez présentement et depuis le dernier mois.</strong>
    Il n’y a pas de bonne ou de mauvaise réponse — répondez spontanément. Vos réponses restent sur votre appareil
    jusqu’à ce que vous nous renvoyiez vous-même votre code.</p>
  </div>

  <h2 class="partie"><span>Partie 1</span> Vos habitudes de vie</h2>
  ${sections}

  <h2 class="partie"><span>Partie 2</span> Votre participation à l’activité physique</h2>
  <section class="bloc">
    <p class="intro">Trois dernières questions, et c’est terminé.</p>
    ${easBloc}
  </section>

  <footer>
    ${kineName ? `<p>${esc(kineName)}, kinésiologue</p>` : ''}
    <p>Ce formulaire fonctionne sans connexion Internet. Vous pouvez aussi l’imprimer.</p>
  </footer>
</div>

<div class="barre">
  <div class="barre-in">
    <div class="avancement">
      <div id="compteur">0 réponse sur ${FANTASTIC_KEYS.length}</div>
      <div class="jauge"><span id="jauge"></span></div>
    </div>
    <button id="terminer" type="button" disabled>Terminer</button>
  </div>
</div>

<dialog id="fin">
  <div class="modale">
    <h2>Merci, c’est terminé</h2>
    <p id="fin-texte"></p>
    <div class="code" id="code-affiche"></div>
    <div class="actions">
      <button type="button" id="copier">Copier le code</button>
      <button type="button" class="secondaire" id="telecharger">Enregistrer un fichier</button>
      <button type="button" class="secondaire" id="fermer">Retour au questionnaire</button>
    </div>
  </div>
</dialog>

<script>
(function(){
  "use strict";
  var KEYS = ${JSON.stringify(FANTASTIC_KEYS)};
  var PREFIX = ${jsString(CODE_PREFIX)};
  var EAS_KEYS = ${JSON.stringify(EAS_QUESTIONS.map(q => q.key))};
  var REPLY = ${jsString(replyTo)};
${ENCODER_JS}

  var answers = {};
  KEYS.forEach(function(k){ answers[k] = null; });
  var eas = {};
  EAS_KEYS.forEach(function(k){ eas[k] = null; });
  var TOTAL = KEYS.length + EAS_KEYS.length;

  var compteur = document.getElementById('compteur');
  var jauge = document.getElementById('jauge');
  var terminer = document.getElementById('terminer');
  var dlg = document.getElementById('fin');

  function repondu(){
    var n = 0;
    KEYS.forEach(function(k){ if (answers[k] !== null) n++; });
    EAS_KEYS.forEach(function(k){ if (eas[k] !== null) n++; });
    return n;
  }

  function rafraichir(){
    var n = repondu();
    compteur.textContent = n === 0
      ? '0 réponse sur ' + TOTAL
      : n + ' réponse' + (n > 1 ? 's' : '') + ' sur ' + TOTAL;
    jauge.style.width = (n / TOTAL * 100) + '%';
    // On n'exige pas les 25 réponses : un questionnaire partiel vaut mieux
    // qu'un client bloqué sur un énoncé auquel il ne veut pas répondre.
    terminer.disabled = n === 0;
  }

  document.querySelectorAll('.choix input').forEach(function(input){
    input.addEventListener('change', function(){
      answers[input.name] = Number(input.value);
      rafraichir();
    });
  });

  document.querySelectorAll('.ligne input').forEach(function(input){
    input.addEventListener('change', function(){
      eas[input.name.replace('eas.', '')] = Number(input.value);
      rafraichir();
    });
  });

  function nomClient(){ return (document.getElementById('nom').value || '').trim(); }
  function dateChoisie(){ return document.getElementById('date').value || ''; }

  terminer.addEventListener('click', function(){
    var code = encode(answers, eas);
    var n = repondu();
    document.getElementById('code-affiche').textContent = code.replace(/(.{5})/g, '$1 ').trim();
    document.getElementById('fin-texte').textContent =
      (n < TOTAL
        ? 'Vous avez répondu à ' + n + ' questions sur ' + TOTAL + '. '
        : '') +
      'Renvoyez ce code' + (REPLY ? ' à ' + REPLY : ' à votre kinésiologue') +
      ', par courriel ou par message. Vous pouvez le copier, ou enregistrer un fichier à joindre.';
    dlg.showModal();
  });

  document.getElementById('fermer').addEventListener('click', function(){ dlg.close(); });

  document.getElementById('copier').addEventListener('click', function(){
    var btn = this;
    var code = encode(answers, eas);
    function fini(ok){
      btn.textContent = ok ? 'Code copié' : 'Copiez-le à la main';
      setTimeout(function(){ btn.textContent = 'Copier le code'; }, 2500);
    }
    // navigator.clipboard n'existe pas hors contexte sécurisé — et un fichier
    // ouvert depuis une pièce jointe (file://) en fait partie. D'où le repli.
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function(){ fini(true); }, function(){ fini(false); });
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = code;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        fini(document.execCommand('copy'));
        document.body.removeChild(ta);
      } catch (e) { fini(false); }
    }
  });

  document.getElementById('telecharger').addEventListener('click', function(){
    var contenu = {
      format: 'kinesio-fantastic',
      version: 1,
      code: encode(answers, eas),
      nom: nomClient(),
      date: dateChoisie()
    };
    var blob = new Blob([JSON.stringify(contenu, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    var suffixe = nomClient() ? '-' + nomClient().replace(/[^\\p{L}\\p{N}]+/gu, '-') : '';
    a.href = url;
    a.download = 'questionnaire' + suffixe + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  });

  // Date du jour par défaut, en heure locale — toISOString() bascule la veille
  // pour quiconque remplit le formulaire en soirée au Québec.
  var d = new Date();
  document.getElementById('date').value =
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

  rafraichir();
})();
</script>
</body>
</html>`
}
