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

const tts = new MsEdgeTTS();

client.once("ready", () => {
  console.log(`✅ Το Bot είναι Online: ${client.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι
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
      // Ρύθμιση φωνής
      await tts.setMetadata("el-GR-AthinaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBPS_MONO_SIREN);
      
      const text = `Καλωσήρθες ${member.displayName}`;
      
      // ΠΡΟΣΟΧΗ: Εδώ προσθέσαμε το await για να πάρουμε το σωστό Stream
      const readableStream = await tts.toStream(text);
      
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
