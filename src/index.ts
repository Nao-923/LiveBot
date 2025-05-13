import axios from "axios";
import { Client, GatewayIntentBits, Interaction, SlashCommandBuilder } from "discord.js";
import * as dotenv from "dotenv";

dotenv.config();

const TOKEN: string | undefined = process.env.DISCORD_BOT_TOKEN;
const API_URL: string = "http://localhost:3005/list"; // マイクラAPIのURL
const NOTION_API_KEY: string | undefined = process.env.NOTION_API_KEY;
const NOTION_BOT_DB_ID: string | undefined = process.env.NOTION_BOT_DB_ID;

if (!TOKEN) {
  throw new Error("DISCORD_BOT_TOKEN が環境変数に設定されていません。");
}
if (!NOTION_API_KEY) {
  throw new Error("NOTION_API_KEY が環境変数に設定されていません。");
}
if (!NOTION_BOT_DB_ID) {
  throw new Error("NOTION_BOT_DB_ID が環境変数に設定されていません。");
}

const client: Client = new Client({
  intents: [
    GatewayIntentBits.Guilds, // サーバーの情報を取得
  ],
});

client.once("ready", async () => {
  console.log(`Logged in as ${client.user?.tag}`);

  // スラッシュコマンドの登録
  const commandData = new SlashCommandBuilder()
    .setName("mcstatus")
    .setDescription("Minecraftサーバーの参加状況を確認します。");

  for (const guild of client.guilds.cache.values()) {
    await guild.commands.create(commandData).catch(err => {
      console.error(`コマンド登録失敗 (${guild.name}):`, err);
    });
  }
});

client.on("interactionCreate", async (interaction: Interaction) => {
  if (!interaction.isChatInputCommand()) return;
  if (interaction.commandName !== "mcstatus") return;

  try {
    // すぐに返信を返す (応答の期限切れを防ぐ)
    const deferred = await interaction.deferReply({ ephemeral: true }).catch(err => {
      console.error("❌ deferReply に失敗:", err);
      return false;
    });
    if (!deferred) return;

    // APIリクエストを並列実行 (Promise.allSettled を使用)
    const [mcResult, notionResult] = await Promise.allSettled([
      axios.get(API_URL),
      axios.post("https://api.notion.com/v1/pages", {
        parent: { database_id: NOTION_BOT_DB_ID },
        properties: {
          User: { title: [{ text: { content: interaction.user.username } }] },
          UserID: { rich_text: [{ text: { content: interaction.user.id } }] },
          Command: { rich_text: [{ text: { content: "mcstatus" } }] },
          Timestamp: { date: { start: new Date().toISOString() } }
        }
      }, {
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          "Content-Type": "application/json",
          "Notion-Version": "2022-06-28"
        }
      })
    ]);

    // Notion API のエラーをログに記録
    if (notionResult.status === "rejected") {
      console.error("❌ Notion APIエラー:", notionResult.reason.response?.data || notionResult.reason);
    }

    // Minecraft API のレスポンスを確認
    if (mcResult.status === "fulfilled" && mcResult.value.data.players.length > 0) {
      const playerNames = mcResult.value.data.players.join(", ");
      await interaction.editReply(`🟢 参加中: ${playerNames}`);
    } else {
      await interaction.editReply("🔴 現在プレイヤーはいません。");
    }
  } catch (error) {
    console.error("Error handling interaction:", error);

    try {
      await interaction.editReply("⚠️ サーバーの状態を取得できませんでした。");
    } catch (editError) {
      console.error("Error editing reply:", editError);
    }
  }
});

client.login(TOKEN).catch((error) => {
  console.error("Bot のログインに失敗しました:", error);
});
