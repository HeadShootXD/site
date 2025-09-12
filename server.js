import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors()); // permite chamadas do seu site
app.use(express.json());

// Lê as variáveis de ambiente do Railway
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Rota para listar todas as sieges
app.get("/sieges", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("sieges")
      .select("*")
      .order("date", { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar sieges" });
  }
});

// Rota para ranking (guilds e players)
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
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar rankings" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor rodando na porta ${PORT}`));
