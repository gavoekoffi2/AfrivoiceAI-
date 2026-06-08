import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { campaigns } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Megaphone,
  Plus,
  Users,
  CheckCircle,
  Clock,
  Play,
  Pause,
} from "lucide-react";
import { CreateCampaignDialog } from "@/components/shared/create-campaign-dialog";

const statusConfig = {
  draft: { label: "Brouillon", variant: "secondary" as const, icon: Clock },
  active: { label: "Active", variant: "success" as const, icon: Play },
  paused: { label: "En pause", variant: "warning" as const, icon: Pause },
  completed: {
    label: "Terminée",
    variant: "outline" as const,
    icon: CheckCircle,
  },
};

export default async function CampaignsPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");

  const allCampaigns = await db
    .select()
    .from(campaigns)
    .where(eq(campaigns.organizationId, session.organizationId))
    .orderBy(desc(campaigns.createdAt));

  return (
    <div className="space-y-6 p-4 md:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            Campagnes de prospection
          </h2>
          <p className="text-muted-foreground">
            Gérez vos campagnes d&apos;appels sortants automatisés
          </p>
        </div>
        <CreateCampaignDialog />
      </div>

      {allCampaigns.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              Aucune campagne pour l&apos;instant
            </h3>
            <p className="text-muted-foreground mb-6 max-w-sm">
              Créez votre première campagne de prospection pour automatiser
              vos appels sortants avec l&apos;IA.
            </p>
            <CreateCampaignDialog />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {allCampaigns.map((campaign) => {
            const config = statusConfig[
              campaign.status as keyof typeof statusConfig
            ] ?? statusConfig.draft;
            const StatusIcon = config.icon;

            const successRate =
              campaign.calledLeads > 0
                ? Math.round(
                    (campaign.qualifiedLeads / campaign.calledLeads) * 100
                  )
                : 0;

            return (
              <Card
                key={campaign.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base line-clamp-1">
                      {campaign.name}
                    </CardTitle>
                    <Badge variant={config.variant} className="shrink-0 gap-1">
                      <StatusIcon className="h-3 w-3" />
                      {config.label}
                    </Badge>
                  </div>
                  <CardDescription className="line-clamp-2">
                    {campaign.objective}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-2 text-center mb-4">
                    <div>
                      <p className="text-xl font-bold">
                        {campaign.totalLeads}
                      </p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold">
                        {campaign.calledLeads}
                      </p>
                      <p className="text-xs text-muted-foreground">Appelés</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-600">
                        {successRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Qualifiés</p>
                    </div>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="w-full"
                  >
                    <Link href={`/campaigns/${campaign.id}`}>
                      Voir les détails
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
