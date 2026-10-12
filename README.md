# Mon Matin

Tableau de bord du matin pour iPad (et tout navigateur) : météo de Dijon, trains directs Dijon ⇄ Le Creusot,
actualités, brief IA Gemini, listes, planning d'alternance et mémos écrits au doigt. Version 4.5.

## Mettre en ligne avec GitHub Pages

1. Crée un dépôt **public** nommé `monmatin`.
2. **Add file → Upload files** : dépose **tout le contenu de ce dossier** (les 9 fichiers : index.html, app.js, manifest.webmanifest, sw.js, les 4 icônes .png et README.md) — depuis l’iPad, sélectionne-les tous d’un coup dans Fichiers, puis **Commit changes**.
3. **Settings → Pages** → Source : *Deploy from a branch* → Branch : `main` / `(root)` → **Save**.
4. Après 1 à 2 minutes, l'app est en ligne sur `https://<ton-pseudo>.github.io/monmatin/`.

## Installer sur l'iPad

Ouvre l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**. L'app s'ouvre alors en plein écran.

## Réglages dans l'app (⚙️)

- **Clé API SNCF** : horaires réels, retards et suppressions (clé gratuite sur numerique.sncf.com).
- **Clé Gemini** : brief IA du matin (clé gratuite sur aistudio.google.com/apikey).
- Les clés restent enregistrées **dans le navigateur de l'iPad uniquement** : elles ne sont jamais dans ce dépôt.

## Écran mural (iPad)

- Réglages iPad → Luminosité et affichage → **Verrouillage auto : Jamais**.
- Dans l'app : ⚙️ → **Mode mural** avec tes heures (écran noir la nuit).
- App Raccourcis → Automatisation → **Heure de la journée** : « Régler la luminosité 0 % » le soir, « 70 % » le matin, *Exécuter immédiatement*.

## Mettre à jour

Remplace `index.html` et `app.js` par les nouvelles versions (Add file → Upload files). L'iPad récupère la mise à jour à la prochaine ouverture.
