import { db } from "@/lib/db";
import { getSession } from "@/lib/auth-session";

export type ConcentrationItem = {
  name: string;
  value: number;
  pct: number;
};

export type ConcentrationData = {
  bySector: ConcentrationItem[];
  byCountry: ConcentrationItem[];
  byIndustry: ConcentrationItem[];
  unclassified: number;
};

export async function getConcentrationData(): Promise<ConcentrationData | null> {
  const session = await getSession();
  const userId = session?.user.id;
  const snapshot = await db.portfolioSnapshot.findFirst({
    where: userId ? { userId } : {},
    orderBy: { snapshotDate: "desc" },
    include: {
      positions: {
        orderBy: { positionValue: "desc" },
      },
    },
  });

  if (!snapshot) return null;

  const assets = await db.asset.findMany({
    select: {
      ticker: true,
      sector: true,
      industry: true,
      country: true,
    },
  });

  const assetMap = new Map(assets.map((a) => [a.ticker, a]));
  const total = Number(snapshot.totalValueArs);

  const sectorMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const industryMap = new Map<string, number>();
  let unclassified = 0;

  for (const pos of snapshot.positions) {
    const asset = assetMap.get(pos.ticker);
    const val = Number(pos.positionValue);

    if (!asset || (!asset.sector && !asset.country && !asset.industry)) {
      unclassified += val;
    }

    const sector = asset?.sector ?? "Sin clasificar";
    const country = asset?.country ?? "Sin clasificar";
    const industry = asset?.industry ?? "Sin clasificar";

    sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + val);
    countryMap.set(country, (countryMap.get(country) ?? 0) + val);
    industryMap.set(industry, (industryMap.get(industry) ?? 0) + val);
  }

  const toItems = (map: Map<string, number>): ConcentrationItem[] =>
    Array.from(map.entries())
      .map(([name, value]) => ({ name, value, pct: total > 0 ? (value / total) * 100 : 0 }))
      .sort((a, b) => b.value - a.value);

  return {
    bySector: toItems(sectorMap),
    byCountry: toItems(countryMap),
    byIndustry: toItems(industryMap),
    unclassified,
  };
}
