import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getUserSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { leadDatabaseRecords } from "@/lib/db/schema";

export async function GET() {
  try {
    const session = await getUserSession();
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const [countryLead] = await db
      .select({
        phone: leadDatabaseRecords.phone,
        name: leadDatabaseRecords.contactName,
        company: leadDatabaseRecords.companyName,
      })
      .from(leadDatabaseRecords)
      .where(sql`${leadDatabaseRecords.phone} is not null and ${leadDatabaseRecords.country} = 'CA'`)
      .limit(1);

    const [phoneLead] = countryLead?.phone
      ? [countryLead]
      : await db
          .select({
            phone: leadDatabaseRecords.phone,
            name: leadDatabaseRecords.contactName,
            company: leadDatabaseRecords.companyName,
          })
          .from(leadDatabaseRecords)
          .where(sql`${leadDatabaseRecords.phone} is not null and ${leadDatabaseRecords.phone} like '+1%'`)
          .limit(1);

    const lead = countryLead?.phone ? countryLead : phoneLead;
    if (!lead?.phone) {
      return NextResponse.json(
        { error: "Aucun numéro Canada trouvé dans la base." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      lead: {
        phone: lead.phone,
        name: lead.name,
        company: lead.company,
      },
    });
  } catch (error) {
    console.error("[campaigns/test-canada-lead] Erreur:", error);
    return NextResponse.json(
      { error: "Impossible de récupérer un numéro Canada depuis la base." },
      { status: 500 }
    );
  }
}
