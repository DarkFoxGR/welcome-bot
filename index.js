require('dotenv').config();

// --- THE ULTIMATE ENCRYPTION INJECTION ---
// Φορτώνουμε το libsodium-wrappers και το κάνουμε inject στη βιβλιοθήκη voice
const sodium = require('libsodium-wrappers');
const voice = require('@discordjs/voice');

async function prepareEncryption() {
    await sodium.ready;
    console.log("🔒 Libsodium is ready and injected into voice library.");
}
prepareEncryption();
// -----------------------------------------

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    entersState, 
    VoiceConnectionStatus, 
    StreamType,
    generateDependencyReport
} = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");
const http = require("http");

// Web Server για το Railway (Health Check)
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot: Encryption Mode Active"); 
}).listen(port, "0.0.0.0", () => {
    console.log(`🌐 Web Server running on port ${port}`);
});

// Εκτύπωση Report για έλεγχο
console.log("--- Current Dependency Report ---");
console.log(generateDependencyReport());
console.log("-------------------------------");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά ξεκίνησε επιτυχώς ως: ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // ΠΕΡΙΜΕΝΟΥΜΕ ΤΟ SODIUM ΠΡΙΝ ΤΟ JOIN
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Αναμονή για Ready κατάσταση
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Επιτυχής σύνδεση στο κανάλι: ${voiceChannel.name}`);

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
        <voice name="el-GR-AthinaNeural">
          <prosody rate="0.9">${text}</prosody>
        </voice>
      </speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));

        const resource = createAudioResource(bufferStream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true
        });

        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on('idle', () => {
          console.log("⏹️ Τέλος ομιλίας.");
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
          }, 2000);
          synthesizer.close();
        });

        player.on('error', err => console.error("❌ Player Error:", err.message));
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα Σύνδεσης/Encryption:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
    }
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Ο χρήστης ${newState.member.displayName} εισήλθε.`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
