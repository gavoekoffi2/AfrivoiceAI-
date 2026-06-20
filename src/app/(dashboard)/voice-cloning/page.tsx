import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { voiceCloneProfiles } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VoiceCloneProfileForm } from "@/components/shared/voice-clone-profile-form";
import { GenerateOpenVoiceCloneButton } from "@/components/shared/generate-openvoice-clone-button";
import { checkOpenVoiceService } from "@/lib/voice-cloning/openvoice";
import { Mic2, ShieldCheck, Cpu, ExternalLink, ServerCog } from "lucide-react";

const engines = [
  {
    name: "OpenVoice V2",
    repo: "myshell-ai/OpenVoice",
    license: "MIT",
    fit: "Choix principal AfrivoiceAI : licence commerciale claire, français, intégration API simple.",
    status: "Sélectionné",
  },
  {
    name: "Chatterbox",
    repo: "resemble-ai/chatterbox",
    license: "MIT",
    fit: "Moteur secondaire à tester pour comparer la qualité française.",
    status: "Option B",
  },
  {
    name: "CosyVoice",
    repo: "FunAudioLLM/CosyVoice",
    license: "Apache-2.0",
    fit: "Très bon candidat avancé, mais plus lourd à opérer pour un MVP.",
    status: "Plus tard",
  },
  {
    name: "GPT-SoVITS",
    repo: "RVC-Boss/GPT-SoVITS",
    license: "MIT",
    fit: "Puissant pour few-shot, utile pour studio voix premium après validation GPU.",
    status: "Studio",
  },
];

const statusLabels: Record<string, string> = {
  draft: "Brouillon",
  queued: "En attente",
  training: "En génération",
  ready: "Prêt",
  failed: "Échec",
  disabled: "Désactivé",
};

function metadataValue(metadata: unknown, key: string) {
  if (!metadata || typeof metadata !== "object" || !(key in metadata)) return null;
  const value = (metadata as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export default async function VoiceCloningPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const [profiles, openVoiceHealth] = await Promise.all([
    db
      .select()
      .from(voiceCloneProfiles)
      .where(eq(voiceCloneProfiles.organizationId, session.organizationId))
      .orderBy(desc(voiceCloneProfiles.createdAt)),
    checkOpenVoiceService(),
  ]);

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Badge variant="outline" className="gap-1">
              <ShieldCheck className="h-3 w-3" />
              Consentement obligatoire
            </Badge>
            <Badge variant="success">OpenVoice V2 choisi</Badge>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">Clonage de voix</h2>
          <p className="max-w-2xl text-muted-foreground">
            Le module est maintenant préparé pour OpenVoice V2 : création du profil, consentement,
            envoi au service GPU, suivi du statut et sauvegarde de l’aperçu vocal.
          </p>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ServerCog className="h-4 w-4" />
              Service OpenVoice
            </CardTitle>
            <CardDescription>{openVoiceHealth.message}</CardDescription>
          </CardHeader>
          <CardContent>
            <Badge variant={openVoiceHealth.ok ? "success" : openVoiceHealth.configured ? "warning" : "outline"}>
              {openVoiceHealth.status === "online"
                ? "Connecté"
                : openVoiceHealth.status === "offline"
                  ? "Configuré mais hors ligne"
                  : "OPENVOICE_API_URL à configurer"}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic2 className="h-5 w-5 text-primary" />
              Nouveau profil vocal
            </CardTitle>
            <CardDescription>
              Enregistrez une voix avec consentement explicite, puis lancez la génération OpenVoice.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <VoiceCloneProfileForm />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profils vocaux</CardTitle>
            <CardDescription>
              Les clones prêts seront ensuite proposés dans les campagnes comme voix personnalisées.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {profiles.length === 0 ? (
              <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                Aucun profil vocal créé pour l’instant.
              </div>
            ) : (
              <div className="space-y-3">
                {profiles.map((profile) => {
                  const lastError = metadataValue(profile.metadata, "lastError");
                  const previewAudioUrl = metadataValue(profile.metadata, "previewAudioUrl");
                  return (
                    <div key={profile.id} className="rounded-lg border p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{profile.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {profile.model} · {profile.provider}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Badge variant={profile.status === "ready" ? "success" : profile.status === "failed" ? "destructive" : "outline"}>
                            {statusLabels[profile.status] ?? profile.status}
                          </Badge>
                          {profile.consentConfirmed && <Badge variant="secondary">Consentement OK</Badge>}
                        </div>
                      </div>

                      {profile.sampleAudioUrl && (
                        <p className="mt-2 text-xs text-muted-foreground break-all">
                          Audio référence : {profile.sampleAudioUrl}
                        </p>
                      )}
                      {profile.externalVoiceId && (
                        <p className="mt-2 text-xs text-muted-foreground break-all">
                          ID voix externe : {profile.externalVoiceId}
                        </p>
                      )}
                      {lastError && (
                        <p className="mt-2 rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-700 dark:text-yellow-200">
                          OpenVoice : {lastError}
                        </p>
                      )}
                      {previewAudioUrl && (
                        <div className="mt-3 rounded-md bg-muted p-3">
                          <p className="mb-2 text-xs font-medium">Aperçu généré</p>
                          <audio controls src={previewAudioUrl} className="w-full" />
                        </div>
                      )}

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <GenerateOpenVoiceCloneButton
                          profileId={profile.id}
                          disabled={
                            profile.provider !== "openvoice" ||
                            !profile.sampleAudioUrl ||
                            profile.status === "training"
                          }
                        />
                        {profile.provider !== "openvoice" && (
                          <span className="text-xs text-muted-foreground">Génération directe réservée à OpenVoice.</span>
                        )}
                        {!profile.sampleAudioUrl && (
                          <span className="text-xs text-muted-foreground">Ajoutez une URL audio avant génération.</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5 text-primary" />
            Moteurs open source étudiés
          </CardTitle>
          <CardDescription>
            OpenVoice V2 est sélectionné comme moteur principal ; Chatterbox reste l’alternative de qualité à tester.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {engines.map((engine) => (
            <div key={engine.repo} className="rounded-lg border p-4">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-semibold">{engine.name}</h3>
                <Badge variant="outline">{engine.license}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{engine.fit}</p>
              <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                <Badge variant={engine.status === "Sélectionné" ? "success" : "secondary"}>{engine.status}</Badge>
                <a
                  href={`https://github.com/${engine.repo}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-primary hover:underline"
                >
                  GitHub <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
