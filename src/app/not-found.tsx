import Link from "next/link";
import { Button } from "@/components/ui/button";
import { PhoneCall } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center text-center p-4">
      <PhoneCall className="h-12 w-12 text-primary mb-4" />
      <h1 className="text-4xl font-bold mb-2">404</h1>
      <p className="text-xl text-muted-foreground mb-6">Page introuvable</p>
      <Button asChild>
        <Link href="/dashboard">Retour au tableau de bord</Link>
      </Button>
    </div>
  );
}
