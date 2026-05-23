import Link from "next/link";

export const metadata = { title: "Politique de Confidentialité" };

export default function PrivacyPage() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-12 prose prose-slate dark:prose-invert">
      <h1>Politique de Confidentialité</h1>
      <p className="text-sm text-muted-foreground">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
      </p>

      <h2>1. Données collectées</h2>
      <ul>
        <li>Données d&apos;identification : email, nom d&apos;organisation.</li>
        <li>
          Données métier : commandes synchronisées, leads importés, transcriptions
          d&apos;appels, enregistrements audio.
        </li>
        <li>Données techniques : adresse IP, logs d&apos;accès.</li>
      </ul>

      <h2>2. Finalités</h2>
      <ul>
        <li>Fourniture du service (passage et analyse des appels).</li>
        <li>Facturation et lutte contre la fraude.</li>
        <li>Amélioration produit (statistiques agrégées et anonymisées).</li>
      </ul>

      <h2>3. Partage des données</h2>
      <p>
        Vos données sont transmises uniquement aux prestataires techniques
        nécessaires à la fourniture du service : Vapi.ai (orchestration vocale),
        ElevenLabs (synthèse vocale), Google (modèle IA), Supabase (base de
        données et authentification), Stripe (paiements).
      </p>

      <h2>4. Hébergement</h2>
      <p>
        Les données sont hébergées sur l&apos;infrastructure Supabase et chez nos
        prestataires partenaires, avec chiffrement en transit (TLS) et au repos.
      </p>

      <h2>5. Durée de conservation</h2>
      <p>
        Les données sont conservées tant que votre compte est actif. Les
        enregistrements d&apos;appels sont conservés 12 mois maximum, sauf
        obligation légale contraire.
      </p>

      <h2>6. Vos droits</h2>
      <p>
        Conformément au RGPD et aux lois équivalentes : droit d&apos;accès, de
        rectification, d&apos;effacement, d&apos;opposition et de portabilité.
        Contactez{" "}
        <a href="mailto:contact@afrivoice.ai">contact@afrivoice.ai</a> pour
        exercer ces droits.
      </p>

      <h2>7. Cookies</h2>
      <p>
        Le service utilise uniquement des cookies fonctionnels (session
        d&apos;authentification, préférence de thème). Aucun cookie publicitaire.
      </p>

      <p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </div>
  );
}
