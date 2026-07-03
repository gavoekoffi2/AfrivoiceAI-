# AfrivoxAI — déploiement Hostinger corrigé

## Problème corrigé

Sur `https://afrivoxai.com/register`, le formulaire d'inscription provoquait une erreur serveur Next.js après soumission. Cause probable : la version Hostinger n'a pas la même configuration backend que Netlify/Supabase (`SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, etc.), donc la Server Action d'inscription plante.

Cette version active un mode accès tableau de bord quand l'environnement Hostinger n'a pas encore la configuration Supabase/DB complète.

## Variables Hostinger à mettre dans hPanel > Node.js > Environment variables

```
NODE_ENV=production
NEXT_PUBLIC_SITE_URL=https://afrivoxai.com
NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder_anon_key
SUPABASE_SERVICE_ROLE_KEY=placeholder_service_key
DATABASE_URL=
AFRIVOXAI_DEMO_AUTH=true
AUTH_SECRET=afrivoxai-hostinger-temporary-secret-change-me
NEXTAUTH_SECRET=afrivoxai-hostinger-temporary-secret-change-me
```

## Déploiement recommandé avec Hostinger Node.js

1. Uploader le contenu de l'archive dans le dossier de l'application Node.js Hostinger.
2. Le fichier de démarrage doit être : `server.js`.
3. Installer/redémarrer l'application Node.js depuis hPanel.
4. Tester :
   - `https://afrivoxai.com/register`
   - remplir le formulaire
   - cliquer `Créer mon compte`
   - l'application doit ouvrir `/calls` / tableau de bord.

## Important

Ceci débloque l'accès dashboard. Pour une vraie inscription persistante avec comptes Supabase, il faudra ensuite remplacer les placeholders par les vraies variables Supabase + DATABASE_URL et vérifier les tables `organizations`, `users`, `wallets`.
