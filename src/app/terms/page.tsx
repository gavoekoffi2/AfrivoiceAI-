import Link from "next/link";

export const metadata = { title: "Conditions Générales d'Utilisation" };

export default function TermsPage() {
  return (
    <div className="container max-w-3xl mx-auto px-4 py-12 prose prose-slate dark:prose-invert">
      <h1>Conditions Générales d&apos;Utilisation</h1>
      <p className="text-sm text-muted-foreground">
        Dernière mise à jour : {new Date().toLocaleDateString("fr-FR")}
      </p>

      <h2>1. Objet</h2>
      <p>
        Les présentes Conditions Générales d&apos;Utilisation régissent l&apos;accès et
        l&apos;utilisation de la plateforme AfrivoiceAI, service de Voice AI permettant
        l&apos;automatisation d&apos;appels téléphoniques sortants pour la confirmation de
        commandes e-commerce et la prospection commerciale.
      </p>

      <h2>2. Inscription</h2>
      <p>
        L&apos;inscription nécessite une adresse email valide et l&apos;acceptation
        des présentes CGU. L&apos;utilisateur s&apos;engage à fournir des
        informations exactes.
      </p>

      <h2>3. Service</h2>
      <p>
        AfrivoiceAI fournit un accès à des services de Voice AI tiers (Vapi.ai,
        ElevenLabs, Google Gemini). L&apos;utilisateur est responsable des
        appels qu&apos;il déclenche et doit s&apos;assurer du consentement de
        ses destinataires conformément aux lois applicables (RGPD, lois locales
        sur le démarchage téléphonique).
      </p>

      <h2>4. Facturation</h2>
      <p>
        Le service est facturé à l&apos;usage via un système de wallet prépayé
        en FCFA. Les coûts incluent une marge de service appliquée sur le coût
        brut des appels. Les recharges sont non remboursables sauf cas prévus
        par la loi.
      </p>

      <h2>5. Usages interdits</h2>
      <ul>
        <li>Démarchage non sollicité hors cadre légal</li>
        <li>Appels frauduleux, harcèlement, escroquerie</li>
        <li>Contenu illégal, diffamatoire ou contrevenant à l&apos;ordre public</li>
        <li>Contournement des mesures de sécurité du service</li>
      </ul>

      <h2>6. Responsabilité</h2>
      <p>
        AfrivoiceAI est fournie « en l&apos;état ». L&apos;éditeur ne peut être
        tenu responsable des conséquences d&apos;appels effectués via le service
        ni des indisponibilités liées à des prestataires tiers.
      </p>

      <h2>7. Résiliation</h2>
      <p>
        L&apos;utilisateur peut supprimer son compte à tout moment. AfrivoiceAI
        se réserve le droit de suspendre tout compte en cas de violation des
        présentes.
      </p>

      <h2>8. Loi applicable</h2>
      <p>Les présentes sont régies par le droit togolais.</p>

      <p>
        <Link href="/">Retour à l&apos;accueil</Link>
      </p>
    </div>
  );
}
