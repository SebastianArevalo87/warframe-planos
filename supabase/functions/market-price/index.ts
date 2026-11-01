const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Order = {
  platinum?: number;
  visible?: boolean;
  user?: { ingameName?: string; status?: string };
};

const slugPattern = /^[a-z0-9_]{1,80}$/;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function quoteFor(slug: string) {
  const response = await fetch(`https://api.warframe.market/v2/orders/item/${slug}/top`, {
    headers: {
      Accept: "application/json",
      Language: "en",
      Platform: "pc",
      "User-Agent": "warframe-planos/0.1 (personal collection tracker)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: { sell?: Order[] } };
  const sells = (payload.data?.sell ?? [])
    .filter((order) => order.visible !== false && typeof order.platinum === "number")
    .sort((a, b) => (a.platinum ?? 0) - (b.platinum ?? 0));
  const live = sells.find((order) => order.user?.status === "online" || order.user?.status === "ingame");
  const pick = live ?? sells[0];
  if (!pick || typeof pick.platinum !== "number") return null;
  return {
    platinum: pick.platinum,
    seller: pick.user?.ingameName ?? "un vendedor",
    live: pick === live,
    url: `https://warframe.market/items/${slug}`,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  let slug = "";
  let slugs: string[] = [];
  try {
    const body = (await request.json()) as { slug?: unknown; slugs?: unknown };
    slug = typeof body.slug === "string" ? body.slug : "";
    slugs = Array.isArray(body.slugs) ? body.slugs.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return json({ error: "slug" }, 400);
  }

  if (slugs.length > 0) {
    const unique = [...new Set(slugs.filter((item) => slugPattern.test(item)))].slice(0, 12);
    const quotes: Record<string, Awaited<ReturnType<typeof quoteFor>>> = {};
    await Promise.all(
      unique.map(async (item) => {
        quotes[item] = await quoteFor(item);
      }),
    );
    return json({ quotes });
  }

  if (!slugPattern.test(slug)) return json({ error: "slug" }, 400);
  return json(await quoteFor(slug));
});
