const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const http = require("http");
const { Readable } = require("stream");
const fetch = require("node-fetch");
const libsodium = require("libsodium-wrappers");

// Web Server για το Render (για να μην κλείνει το service)
http.createServer((req, res) => {
  res.write("Bot is running!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`✅ Το Bot είναι Online: ${client.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι (και δεν είναι το ίδιο το bot)
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    console.log(`🎤 Χρήστης ${member.displayName} μπήκε στο κανάλι.`);

    // Περιμένουμε την κρυπτογράφηση να είναι έτοιμη
    await libsodium.ready;

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    try {
      const text = `καλωσήρθες ${member.displayName}`;
      const url = googleTTS.getAudioUrl(text, {
        lang: "el",
        slow: false,
        host: "https://translate.google.com"
      });

      const response = await fetch(url);
      const buffer = await response.buffer();
      const stream = Readable.from(buffer);
      
      const resource = createAudioResource(stream);
      const player = createAudioPlayer();

      connection.subscribe(player);
      player.play(resource);

      // Όταν τελειώσει ο ήχος, περίμενε 2 δευτερόλεπτα και βγες
      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
            connection.destroy();
          }
        }, 2000);
      });

      player.on('error', error => {
        console.error(`Audio Player Error: ${error.message}`);
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
          connection.destroy();
        }
      });

    } catch (err) {
      console.error("Σφάλμα κατά την αναπαραγωγή:", err);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
      }
    }
  }
});

// --- ΔΙΟΡΘΩΣΗ ΓΙΑ ΤΟ ΣΦΑΛΜΑ ERR_SOCKET_DGRAM_NOT_RUNNING ---
process.on('uncaughtException', (err) => {
    // Αν το σφάλμα αφορά το κλείσιμο του socket του ήχου, το αγνοούμε για να μην κρασάρει
    if (err.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') {
        console.warn('⚠️ Αποφεύχθηκε κρασάρισμα: Το Voice Socket έκλεισε πρόωρα.');
        return;
    }
    console.error('❌ Κρίσιμο σφάλμα (Uncaught):', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});
// -----------------------------------------------------------

client.login(process.env.DISCORD_TOKEN);
