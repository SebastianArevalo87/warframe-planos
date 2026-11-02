const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const idPattern = /^[a-f0-9]{24}$/;

const keptSyndicates = new Set([
  "ArbitersSyndicate",
  "CephalonSudaSyndicate",
  "PerrinSyndicate",
  "RedVeilSyndicate",
  "NewLokaSyndicate",
  "SteelMeridianSyndicate",
  "ConclaveSyndicate",
  "LibrarySyndicate",
  "CetusSyndicate",
  "QuillsSyndicate",
  "VentKidsSyndicate",
  "SolarisSyndicate",
  "VoxSyndicate",
  "EntratiSyndicate",
  "NecraloidSyndicate",
  "ZarimanSyndicate",
  "KahlSyndicate",
  "EntratiLabSyndicate",
  "HexSyndicate",
]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.slice(0, max) : "";
}

function whole(value: unknown, max = 1_000_000_000) {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(max, Math.trunc(number)));
}

function skill(skills: Record<string, unknown>, key: string) {
  return whole(skills[key], 20);
}

function createdAt(value: unknown) {
  if (!value || typeof value !== "object") return "";
  const raw = (value as { $date?: unknown }).$date;
  if (typeof raw === "string") return raw.slice(0, 40);
  if (raw && typeof raw === "object" && "$numberLong" in raw) {
    const ms = Number((raw as { $numberLong: unknown }).$numberLong);
    if (Number.isFinite(ms)) return new Date(ms).toISOString();
  }
  return "";
}

function readProfile(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { Results?: unknown; Stats?: unknown };
  const result = Array.isArray(root.Results) ? root.Results[0] : null;
  if (!result || typeof result !== "object") return null;
  const row = result as Record<string, unknown>;
  const displayName = text(row.DisplayName, 40).replace(/[\uE000-\uF8FF]/g, "").trim();
  const account = row.AccountId;
  const accountId = account && typeof account === "object" ? text((account as { $oid?: unknown }).$oid, 24) : text(account, 24);
  if (!displayName || !idPattern.test(accountId)) return null;

  const inventory = row.LoadOutInventory && typeof row.LoadOutInventory === "object" ? (row.LoadOutInventory as { XPInfo?: unknown }) : {};
  const gear: { id: string; xp: number }[] = [];
  if (Array.isArray(inventory.XPInfo)) {
    for (const entry of inventory.XPInfo) {
      if (!entry || typeof entry !== "object") continue;
      const item = entry as { ItemType?: unknown; XP?: unknown };
      const id = text(item.ItemType, 180);
      if (!id.startsWith("/Lotus/")) continue;
      gear.push({ id, xp: whole(item.XP) });
      if (gear.length >= 4000) break;
    }
  }

  const missions = Array.isArray(row.Missions) ? row.Missions : [];
  let nodes = 0;
  let steel = 0;
  for (const mission of missions) {
    if (!mission || typeof mission !== "object") continue;
    const run = mission as { Completes?: unknown; Tier?: unknown };
    if (whole(run.Completes) <= 0) continue;
    if (whole(run.Tier, 20) > 0) steel += 1;
    else nodes += 1;
  }

  const skills = row.PlayerSkills && typeof row.PlayerSkills === "object" ? (row.PlayerSkills as Record<string, unknown>) : {};
  const syndicates: { tag: string; standing: number; title: number }[] = [];
  if (Array.isArray(row.Affiliations)) {
    for (const entry of row.Affiliations) {
      if (!entry || typeof entry !== "object") continue;
      const tag = text((entry as { Tag?: unknown }).Tag, 80);
      if (!keptSyndicates.has(tag)) continue;
      syndicates.push({
        tag,
        standing: Math.max(-1_000_000_000, Math.min(1_000_000_000, Math.trunc(Number((entry as { Standing?: unknown }).Standing) || 0))),
        title: Math.max(-10, Math.min(10, Math.trunc(Number((entry as { Title?: unknown }).Title) || 0))),
      });
    }
  }

  const marks: string[] = [];
  if (Array.isArray(row.DeathMarks)) {
    for (const entry of row.DeathMarks) {
      const name = typeof entry === "string" ? entry : entry && typeof entry === "object" ? text((entry as { Tag?: unknown }).Tag, 120) : "";
      if (!name) continue;
      marks.push(name.slice(0, 120));
      if (marks.length >= 8) break;
    }
  }

  const alignment = row.Alignment && typeof row.Alignment === "object" ? (row.Alignment as { Alignment?: unknown; Wisdom?: unknown }) : {};
  const stats = root.Stats && typeof root.Stats === "object" ? (root.Stats as Record<string, unknown>) : {};
  return {
    accountId,
    displayName,
    rank: whole(row.PlayerLevel, 40),
    clan: text(row.GuildName, 40),
    clanTier: row.GuildTier == null ? null : whole(row.GuildTier, 20),
    created: createdAt(row.Created),
    nodes,
    steel,
    intrinsics: {
      piloting: skill(skills, "LPS_PILOTING"),
      gunnery: skill(skills, "LPS_GUNNERY"),
      engineering: skill(skills, "LPS_ENGINEERING"),
      tactical: skill(skills, "LPS_TACTICAL"),
      command: skill(skills, "LPS_COMMAND"),
      riding: skill(skills, "LPS_DRIFT_RIDING"),
      combat: skill(skills, "LPS_DRIFT_COMBAT"),
      opportunity: skill(skills, "LPS_DRIFT_OPPORTUNITY"),
      endurance: skill(skills, "LPS_DRIFT_ENDURANCE"),
    },
    syndicates,
    alignment: {
      value: Math.max(-1, Math.min(1, Number(alignment.Alignment) || 0)),
      wisdom: whole(alignment.Wisdom, 40),
    },
    marks,
    founder: whole(row.Founder, 10) > 0,
    timePlayedSec: whole(stats.TimePlayedSec),
    missionsCompleted: whole(stats.MissionsCompleted),
    missionsFailed: whole(stats.MissionsFailed),
    gear,
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (request.method !== "POST") return json({ error: "missing" }, 405);

  let playerId = "";
  try {
    const body = (await request.json()) as { playerId?: unknown };
    playerId = typeof body.playerId === "string" ? body.playerId.trim().toLowerCase() : "";
  } catch {
    return json({ error: "missing" }, 400);
  }
  if (!idPattern.test(playerId)) return json({ error: "missing" }, 400);

  const response = await fetch(`https://api.warframe.com/cdn/getProfileViewingData.php?playerId=${playerId}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "warframe-planos/0.1 (personal collection tracker)",
    },
  });
  if (response.status === 429) return json({ error: "slow" });
  if (!response.ok) return json({ error: "missing" });

  let profile: ReturnType<typeof readProfile> = null;
  try {
    profile = readProfile(await response.json());
  } catch {
    return json({ error: "missing" });
  }
  if (!profile) return json({ error: "missing" });
  return json(profile);
});
