// Shadow tracker : détecte en live les transferts ≥ 0.5 SOL
// vers des wallets inconnus depuis ta watchlist

const WATCHLIST = new Set([
  "FWznbcNXWQuHTawe9RxvQ2LdCENssh12dsznf4RiouN5",
  "BmFdpraQhkiDQE6SnfG5omcA1VwzqfXrwtNYBwWTymy6",
  "5ndLnEYqSFiA5yUFHo6LVZ1eWc6Rhh11K5CfJNkoHEPs",
  "5VCwKtCXgCJ6kit5FybXjvriW3xELsFDhYrPSqtJNmcD",
  "ASTyfSima4LLAdDgoFGkgqoKowG1LZFDr9fAQrg7iaJZ",
  "A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR",
  "H8sMJSCQxfKiFTCfDR3DUMLPwcRbM61LGFJ8N4dK3WjS",
  "2AQdpHJ2JpcEgPiATUXjQxA8QmafFegfQwSLWSprPicm",
  "D89hHJT5Aqyx1trP6EnGY9jJUB3whgnq3aUvvCqedvzf",
  "FpwQQhQQoEaVu3WU2qZMfF1hx48YyfwsLoRgXG83E99Q",
  "5tzFkiKscXHK5ZXCGbXZxdw7gTjjD1mBwuoFbhUvuAi9",
  "53unSgGWqEWANcPYRF35B2Bgf8BkszUtcccKiXwGGLyr",
  "7UhjbynicBP8rqcobwsAJDfRMjwgHSgdxcYNJmLwxfms",
  "2WL4xqEQPBXzW1GwUhkaGkCNz8AMs949Mn89tQSinYGq",
  "GJRs4FwHtemZ5ZE9x3FNvJ8TMwitKTh21yxdRPqn7npE",
  "AC5RDfQFmDS1deWZos921JfqscXdByf8BKHs5ACWjtW2",
  "G2YxRa6wt1qePMwfJzdXZG62ej4qaTC7YURzuh2Lwd3t",
  "AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS"
]);

const SHADOW_WATCH = new Map();

export default {
  async fetch(req, env, ctx) {
    const body = await req.json();
    
    // Logge le payload brut reçu
    console.log("=== Helius payload ===");
    console.log(JSON.stringify(body, null, 2));
    
    const from = body.account;
    if (!WATCHLIST.has(from)) return new Response("not watcher", { status: 200 });
    
    const instructions = body.transaction?.message?.instructions || [];
    
    for (const ix of instructions) {
      if (ix.program !== "system") continue;
      const info = ix.parsed?.info;
      if (!info || info.source !== from) continue;
      
      const to = info.destination;
      const lamports = Number(info.lamports || 0);
      const amount = lamports / 1e9;
      
      if (amount < 0.5 || SHADOW_WATCH.has(to)) continue;
      
      // Mémorisation temporaire pour éviter les spams (10 min)
      SHADOW_WATCH.set(to, Date.now());
      ctx.waitUntil(expire(to));
      
      // Ping ton bot
      ctx.waitUntil(fetch(env.BOT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, amount })
      }));
    }
    
    return new Response("shadow scanned", { status: 200 });
  }
}

async function expire(addr) {
  await new Promise(r => setTimeout(r, 600_000)); // 10 minutes
  SHADOW_WATCH.delete(addr);
}
