import { redirect } from "next/navigation";
import { getUserSession } from "@/lib/auth";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export default async function OnboardingPage() {
  const session = await getUserSession();
  if (!session) redirect("/login");
  if (session.onboardingCompleted) redirect("/dashboard");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-10">
      <OnboardingWizard
        organizationName={session.organizationName}
        userEmail={session.email}
      />
    </div>
  );
}
