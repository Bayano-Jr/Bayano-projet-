# Déploiement sur Google Cloud Run

Cette application est prête à être déployée sur Google Cloud Run.

## Prérequis

- Un projet Google Cloud avec la facturation activée
- L'API Cloud Run activée
- L'API Cloud Build activée
- Google Cloud CLI (`gcloud`) installé et configuré

## Variables d'environnement requises

Lors du déploiement, vous devrez configurer les variables d'environnement suivantes dans Cloud Run :

- `GEMINI_API_KEY` : Votre clé API Google Gemini
- `APP_URL` : L'URL publique de votre application Cloud Run (ex: `https://votre-app-xyz.a.run.app`)
- `GOOGLE_CLIENT_ID` (Optionnel) : Pour la connexion Google
- `GOOGLE_CLIENT_SECRET` (Optionnel) : Pour la connexion Google
- `SESSION_SECRET` : Une chaîne de caractères aléatoire pour sécuriser les sessions
- `DB_PATH` (Optionnel) : Chemin vers le fichier SQLite (par défaut `database.sqlite`)

## Déploiement

### Option 1 : Déploiement direct avec gcloud

Exécutez la commande suivante à la racine du projet :

```bash
gcloud run deploy react-example \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars="GEMINI_API_KEY=votre_cle,SESSION_SECRET=votre_secret"
```

### Option 2 : Utilisation de Cloud Build (CI/CD)

Le fichier `cloudbuild.yaml` est inclus pour automatiser le déploiement. Vous pouvez l'utiliser avec des déclencheurs Cloud Build liés à votre dépôt GitHub.

**Important** : Le fichier `cloudbuild.yaml` a été mis à jour pour **ne plus écraser** vos variables d'environnement. Vous devez simplement aller dans la console Google Cloud Run, onglet "Variables et secrets", et configurer vos variables (`GEMINI_API_KEY`, `SESSION_SECRET`, `GOOGLE_CLIENT_ID`, etc.). À chaque nouveau "push" sur GitHub, Cloud Build déploiera la nouvelle version du code tout en conservant vos variables intactes.

## Base de données

L'application utilise SQLite. Sur Cloud Run (qui est sans état), la base de données sera réinitialisée à chaque redémarrage du conteneur. 
Pour une utilisation en production persistante, il est recommandé de :
1. Soit monter un volume Cloud Storage (Cloud Run Volume Mounts)
2. Soit migrer vers une base de données managée comme Cloud SQL (PostgreSQL/MySQL) en modifiant la connexion dans `server.ts`.
