import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { SocialProof } from "@/components/landing/social-proof";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { UseCases } from "@/components/landing/use-cases";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/final-cta";
import { LandingFooter } from "@/components/landing/footer";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Si déjà connecté → on file directement au dashboard
  const session = await getUserSession();
  if (session) redirect("/dashboard");

  return (
    <main className="dark bg-slate-950 text-white">
      <LandingNav />
      <Hero />
      <SocialProof />
      <Features />
      <HowItWorks />
      <UseCases />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <LandingFooter />
    </main>
  );
}
