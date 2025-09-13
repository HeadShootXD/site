import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// Conecta no Supabase usando variáveis de ambiente do Railway
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ---------------- Rotas ----------------

// Lista todas as sieges
app.get("/sieges", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sieges")
      .select("*")
      .order("date", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error("Erro ao buscar sieges:", err.message);
    res.status(500).json({ error: "Erro ao buscar sieges" });
  }
});

// Ranking (guilds e players) de uma siege
app.get("/sieges/:id/rankings", async (req, res) => {
  try {
    const siegeId = req.params.id;

    const { data: guilds, error: guildError } = await supabase
      .from("siege_guild_rankings")
      .select("guild_name, score")
      .eq("siege_id", siegeId)
      .order("score", { ascending: false });

    const { data: players, error: playerError } = await supabase
      .from("siege_player_rankings")
      .select("player_name, score")
      .eq("siege_id", siegeId)
      .order("score", { ascending: false });

    if (guildError || playerError) throw guildError || playerError;

    res.json({ guilds, players });
  } catch (err) {
    console.error("Erro ao buscar rankings:", err.message);
    res.status(500).json({ error: "Erro ao buscar rankings" });
  }
});

// Guild campeã de uma siege
app.get("/sieges/:id/topGuild", async (req, res) => {
  try {
    const siegeId = req.params.id;

    const { data, error } = await supabase
      .from("siege_guild_rankings")
      .select("guild_name, score")
      .eq("siege_id", siegeId)
      .order("score", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({ guild_name: "—" });
    }

    res.json(data[0]);
  } catch (err) {
    console.error("Erro ao buscar topGuild:", err.message);
    res.status(500).json({ error: "Erro ao buscar topGuild" });
  }
});

// MVP de uma siege
app.get("/sieges/:id/mvp", async (req, res) => {
  try {
    const siegeId = req.params.id;

    const { data, error } = await supabase
      .from("siege_player_rankings")
      .select("player_name, score")
      .eq("siege_id", siegeId)
      .order("score", { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({ player_name: "—" });
    }

    res.json(data[0]);
  } catch (err) {
    console.error("Erro ao buscar MVP:", err.message);
    res.status(500).json({ error: "Erro ao buscar MVP" });
  }
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);
