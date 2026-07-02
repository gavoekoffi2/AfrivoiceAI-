import { AfricanTtsDemo } from "@/components/shared/african-tts-demo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AfricanVoicesPage() {
  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 flex flex-wrap gap-2">
            <Badge className="w-fit">Démo investisseurs</Badge>
            <Badge variant="outline" className="w-fit">Langues locales africaines</Badge>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Voix africaines</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Prototype pour prouver qu’AfrivoxAI peut générer des voix en langues locales comme l’Éwé. Cette page sert à écouter, comparer et préparer une démonstration avant intégration téléphonique complète.
          </p>
        </div>
      </div>

      <AfricanTtsDemo />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>1. Prototype gratuit</CardTitle>
            <CardDescription>Meta MMS-TTS Éwé</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Utilisé pour démontrer rapidement la capacité vocale en Éwé. Bon pour écouter et convaincre, mais licence non commerciale.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>2. Validation locale</CardTitle>
            <CardDescription>Yodi / Umbaji Togo</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Piste togolaise pour Éwé, Kabyè, Tem et Fon. À tester via leur API pour qualité, latence et usage commercial.
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>3. Production</CardTitle>
            <CardDescription>API commerciale ou licence dédiée</CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Pour les premiers clients payants, utiliser une API/licence commerciale et garder les prompts vocaux courts, naturels et validés par locuteurs natifs.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
