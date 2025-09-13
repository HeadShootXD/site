import express from "express";
import cors from "cors";
import { createClient } from "@supabase/supabase-js";

const app = express();
app.use(cors());
app.use(express.json());

// Conecta no Supabase com variáveis do Railway
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ---------------- Rotas ----------------

// Lista todas as sieges, enriquecidas com topGuild e MVP
app.get("/sieges", async (req, res) => {
  try {
    // Buscar todas as sieges
    const { data: sieges, error: siegeError } = await supabase
      .from("sieges")
      .select("*")
      .order("date", { ascending: false });

    if (siegeError) throw siegeError;

    // Enriquecer cada siege com topGuild e MVP em paralelo
    const enrichedSieges = await Promise.all(
      sieges.map(async (siege) => {
        // Buscar guild campeã
        const { data: guildData, error: guildError } = await supabase
          .from("siege_guild_rankings")
          .select("guild_name, score")
          .eq("siege_id", siege.id)
          .order("score", { ascending: false })
          .limit(1);

        // Buscar MVP
        const { data: playerData, error: playerError } = await supabase
          .from("siege_player_rankings")
          .select("player_name, score")
          .eq("siege_id", siege.id)
          .order("score", { ascending: false })
          .limit(1);

        if (guildError) console.warn(`Erro ao buscar topGuild para siege ${siege.id}:`, guildError);
        if (playerError) console.warn(`Erro ao buscar MVP para siege ${siege.id}:`, playerError);

        return {
          ...siege,
          topGuild: guildData && guildData.length > 0 ? guildData[0].guild_name : "—",
          mvp: playerData && playerData.length > 0 ? playerData[0].player_name : "—",
        };
      })
    );

    res.json(enrichedSieges);
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

// Guild campeã de uma siege (mantido para compatibilidade, mas agora desnecessário com /sieges enriquecido)
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
    if (!data || data.length === 0) return res.json({ guild_name: "—" });

    res.json(data[0]);
  } catch (err) {
    console.error("Erro ao buscar topGuild:", err.message);
    res.status(500).json({ error: "Erro ao buscar topGuild" });
  }
});

// MVP (player destaque) de uma siege (mantido para compatibilidade, mas agora desnecessário com /sieges enriquecido)
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
    if (!data || data.length === 0) return res.json({ player_name: "—" });

    res.json(data[0]);
  } catch (err) {
    console.error("Erro ao buscar MVP:", err.message);
    res.status(500).json({ error: "Erro ao buscar MVP" });
  }
});

// Estatísticas detalhadas dos jogadores para uma siege
app.get("/sieges/:id/stats", async (req, res) => {
  try {
    const siegeId = req.params.id;

    // Buscar estatísticas dos jogadores
    const { data: playerStats, error: statsError } = await supabase
      .from("siege_player_stats")
      .select("id, player_name, guild_name, kills, deaths, points")
      .eq("siege_id", siegeId);

    if (statsError) throw statsError;
    if (!playerStats || playerStats.length === 0) {
      return res.status(404).json({ error: "Nenhuma estatística encontrada para esta siege" });
    }

    // Extrair IDs dos player stats
    const statIds = playerStats.map(stat => stat.id);

    // Buscar kills por vida usando siege_player_stat_id
    const { data: killsByLife, error: killsError } = await supabase
      .from("siege_player_kills")
      .select("siege_player_stat_id, life_number, victim_name, points_earned")
      .in("siege_player_stat_id", statIds);

    if (killsError) throw killsError;

    // Buscar mortes por vida usando siege_player_stat_id
    const { data: deathsByLife, error: deathsError } = await supabase
      .from("siege_player_deaths")
      .select("siege_player_stat_id, life_number, killer_name")
      .in("siege_player_stat_id", statIds);

    if (deathsError) throw deathsError;

    // Combinar os dados
    const result = playerStats.map(player => {
      const playerKills = killsByLife
        .filter(kill => kill.siege_player_stat_id === player.id)
        .map(kill => ({
          life_number: kill.life_number,
          victim_name: kill.victim_name,
          points_earned: kill.points_earned
        }));

      const playerDeaths = deathsByLife
        .filter(death => death.siege_player_stat_id === player.id)
        .map(death => ({
          life_number: death.life_number,
          killer_name: death.killer_name
        }));

      return {
        player_name: player.player_name,
        guild_name: player.guild_name || "Sem Guilda",
        kills: player.kills || 0,
        deaths: player.deaths || 0,
        points: player.points || 0,
        kills_by_life: playerKills,
        deaths_by_life: playerDeaths
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Erro ao buscar estatísticas dos jogadores:", err.message);
    res.status(500).json({ error: "Erro ao buscar estatísticas dos jogadores" });
  }
});

// ---------------- Start ----------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Servidor rodando na porta ${PORT}`)
);