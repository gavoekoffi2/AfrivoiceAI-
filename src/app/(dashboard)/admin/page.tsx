import { desc, sql } from "drizzle-orm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { requirePlatformAdmin, PLATFORM_ADMIN_PERMISSIONS, SUPER_ADMIN_EMAIL } from "@/lib/admin";
import { db } from "@/lib/db";
import { campaigns, calls, leadDatabasePurchases, leadDatabaseRecords, leadDatabases, organizations, users, wallets } from "@/lib/db/schema";
import { ensureFounderSuperAdminAction, grantSubscriptionAction, unlockDatabaseForUserAction, updateAdminPermissionsAction, updateUserStatusAction } from "@/app/actions/admin";

function fmt(value: number) {
  return value.toLocaleString("fr-FR");
}

function roleLabel(role: string) {
  if (role === "super_admin") return "Super admin";
  if (role === "admin") return "Sous-admin";
  if (role === "owner") return "Client owner";
  return "Membre";
}

async function grantSubscriptionFormAction(formData: FormData) {
  "use server";
  await grantSubscriptionAction(formData);
}

async function unlockDatabaseForUserFormAction(formData: FormData) {
  "use server";
  await unlockDatabaseForUserAction(formData);
}

async function ensureFounderSuperAdminFormAction(formData: FormData) {
  "use server";
  await ensureFounderSuperAdminAction(formData);
}

async function updateAdminPermissionsFormAction(formData: FormData) {
  "use server";
  await updateAdminPermissionsAction(formData);
}

async function updateUserStatusFormAction(formData: FormData) {
  "use server";
  await updateUserStatusAction(formData);
}

export default async function AdminPage() {
  const session = await requirePlatformAdmin();

  const [statsRows, recentUsers, databases, revenueRows] = await Promise.all([
    db.select({
      users: sql<number>`count(distinct ${users.id})`,
      organizations: sql<number>`count(distinct ${organizations.id})`,
      databases: sql<number>`(select count(*) from ${leadDatabases})`,
      records: sql<number>`(select count(*) from ${leadDatabaseRecords})`,
      purchases: sql<number>`(select count(*) from ${leadDatabasePurchases})`,
      calls: sql<number>`(select count(*) from ${calls})`,
      campaigns: sql<number>`(select count(*) from ${campaigns})`,
    }).from(users).leftJoin(organizations, sql`${users.organizationId} = ${organizations.id}`),
    db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        subscriptionPlan: users.subscriptionPlan,
        subscriptionExpiresAt: users.subscriptionExpiresAt,
        isActive: users.isActive,
        adminPermissions: users.adminPermissions,
        organizationName: organizations.name,
        walletBalance: wallets.balanceFcfa,
      })
      .from(users)
      .innerJoin(organizations, sql`${users.organizationId} = ${organizations.id}`)
      .leftJoin(wallets, sql`${wallets.organizationId} = ${organizations.id}`)
      .orderBy(desc(users.createdAt))
      .limit(30),
    db
      .select({ id: leadDatabases.id, name: leadDatabases.name, country: leadDatabases.country, sector: leadDatabases.sector, recordCount: leadDatabases.recordCount, priceFcfa: leadDatabases.priceFcfa })
      .from(leadDatabases)
      .orderBy(desc(leadDatabases.recordCount))
      .limit(200),
    db.select({ total: sql<number>`coalesce(sum(${leadDatabasePurchases.amountFcfa}), 0)` }).from(leadDatabasePurchases),
  ]);

  const stats = statsRows[0];
  const revenue = Number(revenueRows[0]?.total ?? 0);

  return (
    <div className="min-h-full bg-[#07080a] text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-96 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_top_right,rgba(113,112,255,0.28),transparent_32%)]" />
      <div className="relative mx-auto max-w-7xl space-y-6 px-4 py-6 md:px-8">
        <section className="rounded-[32px] border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-black/40 backdrop-blur md:p-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <Badge className="mb-4 border-emerald-300/20 bg-emerald-400/10 text-emerald-100 hover:bg-emerald-400/10">
                Console fondateur · {roleLabel(session.role)}
              </Badge>
              <h1 className="text-4xl font-semibold tracking-[-0.05em] md:text-6xl">
                Super administration AfrivoiceAI
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/60 md:text-base">
                Gère les abonnements, les sous-administrateurs, les droits, les bases de données, les déblocages clients et la vue globale de la plateforme.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/25 p-4 text-sm text-white/70">
              <p className="text-xs uppercase tracking-[0.2em] text-white/40">Compte illimité</p>
              <p className="mt-1 font-mono text-white">{session.email}</p>
              <p className="mt-1 text-emerald-200">Accès total aux bases et opérations.</p>
            </div>
          </div>
        </section>

        <section className="grid gap-3 md:grid-cols-4">
          <Kpi title="Utilisateurs" value={fmt(Number(stats?.users ?? 0))} />
          <Kpi title="Organisations" value={fmt(Number(stats?.organizations ?? 0))} />
          <Kpi title="Bases prospects" value={fmt(Number(stats?.databases ?? 0))} />
          <Kpi title="Prospects importés" value={fmt(Number(stats?.records ?? 0))} />
          <Kpi title="Achats / déblocages" value={fmt(Number(stats?.purchases ?? 0))} />
          <Kpi title="Campagnes" value={fmt(Number(stats?.campaigns ?? 0))} />
          <Kpi title="Appels" value={fmt(Number(stats?.calls ?? 0))} />
          <Kpi title="Revenu bases" value={`${fmt(revenue)} FCFA`} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <Card className="border-white/10 bg-[#101114] text-white">
            <CardHeader>
              <CardTitle>Créer / offrir un abonnement</CardTitle>
              <CardDescription>Crée le compte si l’email n’existe pas, puis active le plan et la durée.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={grantSubscriptionFormAction} className="grid gap-4 md:grid-cols-2">
                <Field label="Email client"><Input name="email" type="email" placeholder="client@email.com" required /></Field>
                <Field label="Nom organisation"><Input name="organizationName" placeholder="Nom entreprise" /></Field>
                <Field label="Plan">
                  <Select name="plan" defaultValue="enterprise"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="free">Free</SelectItem><SelectItem value="pro">Pro</SelectItem><SelectItem value="enterprise">Enterprise illimité</SelectItem></SelectContent></Select>
                </Field>
                <Field label="Durée">
                  <Select name="duration" defaultValue="permanent"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="permanent">Permanent / illimité</SelectItem><SelectItem value="7">7 jours</SelectItem><SelectItem value="30">30 jours</SelectItem><SelectItem value="90">90 jours</SelectItem><SelectItem value="365">1 an</SelectItem></SelectContent></Select>
                </Field>
                <Field label="Rôle">
                  <Select name="role" defaultValue="owner"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="owner">Client owner</SelectItem><SelectItem value="member">Membre</SelectItem><SelectItem value="admin">Sous-admin</SelectItem><SelectItem value="super_admin">Super admin</SelectItem></SelectContent></Select>
                </Field>
                <Field label="Mot de passe initial (optionnel)"><Input name="initialPassword" type="password" placeholder="Seulement pour création" /></Field>
                <Button className="md:col-span-2 bg-emerald-500 text-black hover:bg-emerald-400">Activer / offrir l’accès</Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#101114] text-white">
            <CardHeader>
              <CardTitle>Débloquer une base de données</CardTitle>
              <CardDescription>Débloque une base ou tout le catalogue pour une organisation via email.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={unlockDatabaseForUserFormAction} className="grid gap-4">
                <Field label="Email client"><Input name="email" type="email" placeholder="client@email.com" required /></Field>
                <Field label="Base à débloquer">
                  <Select name="databaseId" defaultValue="all">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes les bases publiées</SelectItem>
                      {databases.map((database) => (
                        <SelectItem key={database.id} value={database.id}>{database.country} · {database.sector} · {database.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Button className="bg-violet-500 hover:bg-violet-400">Débloquer maintenant</Button>
              </form>

              <form action={ensureFounderSuperAdminFormAction} className="mt-6 rounded-2xl border border-white/10 bg-black/20 p-4">
                <p className="mb-3 text-sm font-medium">Compte fondateur illimité</p>
                <input type="hidden" name="email" value={SUPER_ADMIN_EMAIL} />
                <Field label="Email super admin"><Input value={SUPER_ADMIN_EMAIL} readOnly /></Field>
                <p className="mt-2 text-xs text-white/50">Le mot de passe n’est jamais affiché ici. Si tu veux le changer, utilise le formulaire abonnement avec le rôle super admin.</p>
                <Button variant="outline" className="mt-4 border-white/10 bg-white/5 text-white hover:bg-white/10">Reconfirmer super admin</Button>
              </form>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="border-white/10 bg-[#101114] text-white">
            <CardHeader>
              <CardTitle>Utilisateurs récents</CardTitle>
              <CardDescription>Bloquer, réactiver, promouvoir ou retirer un sous-admin.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentUsers.map((user) => (
                <div key={user.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="font-medium text-white">{user.email}</p>
                      <p className="text-xs text-white/50">{user.organizationName} · {roleLabel(user.role)} · {user.subscriptionPlan}{user.subscriptionExpiresAt ? ` jusqu’au ${new Date(user.subscriptionExpiresAt).toLocaleDateString("fr-FR")}` : user.subscriptionPlan !== "free" ? " permanent" : ""}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge active={user.isActive} />
                      <UserOperation userId={user.id} operation={user.isActive ? "deactivate" : "activate"} label={user.isActive ? "Bloquer" : "Réactiver"} />
                      <UserOperation userId={user.id} operation={user.role === "admin" ? "remove-admin" : "make-admin"} label={user.role === "admin" ? "Retirer admin" : "Sous-admin"} />
                    </div>
                  </div>
                  {user.role === "admin" && (
                    <form action={updateAdminPermissionsFormAction} className="mt-4 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3 sm:grid-cols-2">
                      <input type="hidden" name="userId" value={user.id} />
                      {PLATFORM_ADMIN_PERMISSIONS.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 text-xs text-white/70">
                          <input type="checkbox" name={permission} defaultChecked={Array.isArray(user.adminPermissions) ? user.adminPermissions.includes(permission) : true} />
                          {permission}
                        </label>
                      ))}
                      <Button size="sm" className="sm:col-span-2">Enregistrer les limites du sous-admin</Button>
                    </form>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#101114] text-white">
            <CardHeader>
              <CardTitle>Contrôles disponibles</CardTitle>
              <CardDescription>Ce que le super administrateur peut gérer.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-white/70">
              {[
                "Créer des comptes clients et sous-admins",
                "Offrir Pro/Enterprise avec durée ou illimité",
                "Bloquer ou réactiver un compte",
                "Débloquer une ou toutes les bases de données",
                "Limiter les sous-admins par permissions",
                "Voir statistiques plateforme, achats, campagnes et appels",
                "Accès fondateur illimité à toutes les bases",
              ].map((item) => <div key={item} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">✓ {item}</div>)}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"><p className="text-xs text-white/45">{title}</p><p className="mt-2 font-mono text-2xl font-semibold tracking-[-0.04em]">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label className="text-white/70">{label}</Label>{children}</div>;
}

function StatusBadge({ active }: { active: boolean }) {
  return <Badge className={active ? "bg-emerald-400/10 text-emerald-100" : "bg-red-400/10 text-red-100"}>{active ? "Actif" : "Bloqué"}</Badge>;
}

function UserOperation({ userId, operation, label }: { userId: string; operation: string; label: string }) {
  return <form action={updateUserStatusFormAction}><input type="hidden" name="userId" value={userId} /><input type="hidden" name="operation" value={operation} /><Button size="sm" variant="outline" className="border-white/10 bg-white/5 text-white hover:bg-white/10">{label}</Button></form>;
}
