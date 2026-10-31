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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  let slug = "";
  try {
    const body = (await request.json()) as { slug?: unknown };
    slug = typeof body.slug === "string" ? body.slug : "";
  } catch {
    slug = "";
  }
  if (!/^[a-z0-9_]{1,80}$/.test(slug)) {
    return new Response(JSON.stringify({ error: "slug" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const response = await fetch(`https://api.warframe.market/v2/orders/item/${slug}/top`, {
    headers: {
      Accept: "application/json",
      Language: "en",
      Platform: "pc",
      "User-Agent": "warframe-planos/0.1 (personal collection tracker)",
    },
  });
  if (response.status === 404) {
    return new Response("null", { headers: { ...cors, "Content-Type": "application/json" } });
  }
  if (!response.ok) {
    return new Response(JSON.stringify({ error: "market" }), {
      status: 502,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const json = (await response.json()) as { data?: { sell?: Order[] } };
  const sells = (json.data?.sell ?? [])
    .filter((order) => order.visible !== false && typeof order.platinum === "number")
    .sort((a, b) => (a.platinum ?? 0) - (b.platinum ?? 0));
  const live = sells.find((order) => order.user?.status === "online" || order.user?.status === "ingame");
  const pick = live ?? sells[0];
  const quote = pick && typeof pick.platinum === "number"
    ? {
        platinum: pick.platinum,
        seller: pick.user?.ingameName ?? "un vendedor",
        live: pick === live,
        url: `https://warframe.market/items/${slug}`,
      }
    : null;

  return new Response(JSON.stringify(quote), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
