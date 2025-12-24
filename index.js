const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const http = require("http");
const libsodium = require("libsodium-wrappers");

// Web Server για το Render
http.createServer((req, res) => {
  res.write("Bot is running with Athina!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

// Δημιουργία του TTS instance
const tts = new MsEdgeTTS();

client.once("ready", async () => {
  try {
    // Ρύθμιση της φωνής Αθηνάς κατά την εκκίνηση του Bot
    await tts.setMetadata("el-GR-AthinaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBPS_MONO_SIREN);
    console.log(`✅ Το Bot είναι Online και η Αθηνά είναι έτοιμη: ${client.user.tag}`);
  } catch (err) {
    console.error("Σφάλμα κατά τη ρύθμιση της Αθηνάς:", err);
  }
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    console.log(`🎤 Καλωσόρισμα στον χρήστη: ${member.displayName}`);

    await libsodium.ready;

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    try {
      const text = `Καλωσήρθες ${member.displayName}`;
      
      // Τώρα η κλήση είναι σωστή γιατί το metadata έχει οριστεί στο ready
      const readableStream = tts.toStream(text);
      
      const resource = createAudioResource(readableStream);
      const player = createAudioPlayer();

      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.destroy();
          }
        }, 2000);
      });

      player.on('error', error => {
        console.error(`Audio Error: ${error.message}`);
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy();
        }
      });

    } catch (err) {
      console.error("TTS Error:", err);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }
    }
  }
});

// Προστασία από κρασαρίσματα
process.on('uncaughtException', (err) => {
    if (err.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') return;
    console.error('❌ Uncaught Exception:', err);
});

client.login(process.env.DISCORD_TOKEN);
