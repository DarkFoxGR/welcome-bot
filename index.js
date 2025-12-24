const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts"); // Η σωστή βιβλιοθήκη
const http = require("http");
const libsodium = require("libsodium-wrappers");

// Web Server για το Render
http.createServer((req, res) => {
  res.write("Bot is running with Athina Neural Voice!");
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

client.once("ready", () => {
  console.log(`✅ Το Bot είναι Online με τη φωνή της Αθηνάς: ${client.user.tag}`);
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
      
      // Χρήση της φωνής Αθηνάς με τη νέα βιβλιοθήκη
      const readableStream = tts.toStream(text, {
        voice: "el-GR-AthinaNeural",
        outputFormat: OUTPUT_FORMAT.AUDIO_24KHZ_48KBPS_MONO_SIREN
      });
      
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

// ΔΙΟΡΘΩΣΗ ΓΙΑ ΤΟ CRASH (SOCKET ERROR)
process.on('uncaughtException', (err) => {
    if (err.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') {
        console.warn('⚠️ Αποφεύχθηκε κρασάρισμα στο Voice Socket.');
        return;
    }
    console.error('❌ Uncaught Exception:', err);
});

client.login(process.env.DISCORD_TOKEN);
