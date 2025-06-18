const body = await req.json();
console.log("=== Helius payload ===");
console.log(JSON.stringify(body, null, 2));

// Shadow tracker : détecte en live les transferts ≥ 0.5 SOL
// vers des wallets inconnus depuis ta watchlist
const WATCHLIST = new Set([
  "j1oeQoPeuEDmjvyMwBmCWexzCQup77kbKKxV59CnYbd",
  "j1oAbxxiDUWvoHxEDhWE7THLjEkDQW2cSHYn2vttxTF",
  "suqh5sHtr8HyJ7q8scBimULPkPpA557prMG47xCHQfK",
  "j1opmdubY84LUeidrPCsSGskTCYmeJVzds1UWm6nngb",
  "DfMxre4cKmvogbLrPigxmibVTTQDuzjdXojWzjCXXhzj",
  "73LnJ7G9ffBDjEBGgJDdgvLUhD5APLonKrNiHsKDCw5B",
  "HdxkiXqeN6qpK2YbG51W23QSWj3Yygc1eEk2zwmKJExp",
  "5Dqsy7HaAfBwCmc21cBZfdQEjt39kSnthb28BnfkEN8e",
  "ZG98FUCjb8mJ824Gbs6RsgVmr1FhXb2oNiJHa2dwmPd",
  "o7RY6P2vQMuGSu1TrLM81weuzgDjaCRTXYRaXJwWcvc",
  "qifZKL6UBTJgig5hAm5kUgX4c2ckD8r9Qkkf9xUeRBd",
  "9dgP6ciSqytSJrcJoqEk5RM2kzMRZeJNLkchhm1u7eaf",
  "6bN5ncxf4Qg3KGacRTTSKkWRu3Y9Uv2GbMu18GdwHajS",
  "ETR2nhTSnq5uBgn8u3LPfsXkUJcQddsJnUYvHSafEFMG"
]);

const SHADOW_WATCH = new Map();

export default {
  async fetch(req, env, ctx) {
    const body = await req.json();
    const from = body.account;
    if (!WATCHLIST.has(from)) return new Response("not watcher", {status:200});

    const instructions = body.transaction?.message?.instructions || [];

    for (const ix of instructions) {
      if (ix.program !== "system") continue;
      const info = ix.parsed?.info;
      if (!info || info.source !== from) continue;

      const to = info.destination;
      const lamports = Number(info.lamports || 0);
      const amount = lamports / 1e9;

      if (amount < 0.5 || SHADOW_WATCH.has(to)) continue;

      // log + mémoire temporaire (shadow mode 10 min)
      SHADOW_WATCH.set(to, Date.now());
      ctx.waitUntil(expire(to));

      // ping ton bot /spawn
      ctx.waitUntil(fetch(env.BOT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, amount })
      }));
    }

    return new Response("shadow scanned", {status:200});
  }
}

async function expire(addr) {
  await new Promise(r => setTimeout(r, 600_000)); // 10 min
  SHADOW_WATCH.delete(addr);
}
