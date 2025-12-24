// --- ΕΙΔΙΚΟ PATCH ΓΙΑ ΤΗΝ ΚΡΥΠΤΟΓΡΑΦΗΣΗ ---
const sodium = require('libsodium-wrappers');
async function loadSodium() {
    await sodium.ready;
}
loadSodium();
// ------------------------------------------

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus, entersState } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { Readable } = require("stream");
const http = require("http");

http.createServer((req, res) => { res.write("Bot is running"); res.end(); }).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ]
});

// Το κλειδί σου κατευθείαν για να αποκλείσουμε πρόβλημα μεταβλητών
const SPEECH_KEY = "9LFKQhTyqkt4XjNZ2Upolvc41QzW50okzE5uPncnJu3FHB3CZ49tJQQJ99BLAC5RqLJXJ3w3AAAYACOGz4dJ";
const SPEECH_REGION = "westeurope";
const ADMIN_ID = "364849864611201026";

client.once(Events.ClientReady, () => {
    console.log("✅ Η Αθηνά ξεκίνησε με το νέο patch!");
});

async function playSpeech(text, voiceChannel) {
  // Επιβεβαίωση κρυπτογράφησης πριν τη σύνδεση
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  // Δυναμική προσθήκη της βιβλιοθήκης στη σύνδεση
  connection.on('stateChange', (oldState, newState) => {
    if (newState.status === VoiceConnectionStatus.Networking) {
      console.log("Δικτύωση σε εξέλιξη...");
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 10000);

    const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const resource = createAudioResource(new Readable().wrap(new Readable({
          read() { this.push(Buffer.from(result.audioData)); this.push(null); }
        })));

        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
          }, 1500);
          synthesizer.close();
        });
      }
    }, err => {
      console.error("Synthesizer error:", err);
      connection.destroy();
    });

  } catch (error) {
    console.error("Σφάλμα σύνδεσης:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.id === ADMIN_ID && message.content.startsWith("!say ")) {
    const voiceChannel = message.member.voice.channel;
    if (voiceChannel) {
      playSpeech(message.content.replace("!say ", ""), voiceChannel);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
