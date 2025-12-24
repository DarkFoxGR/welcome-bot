require('dotenv').config();
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

// --- 1. HEALTH CHECK SERVER (ΚΡΑΤΑΕΙ ΤΟ BOT ΖΩΝΤΑΝΟ ΣΤΟ RAILWAY) ---
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot is running and encryption is ready!"); 
}).listen(port, "0.0.0.0", () => {
    console.log(`🌐 Web Server running on port ${port}`);
});

// --- 2. ΕΚΤΥΠΩΣΗ DEPENDENCIES (ΓΙΑ ΕΠΙΒΕΒΑΙΩΣΗ) ---
console.log("--- Discord Voice Dependency Report ---");
console.log(generateDependencyReport());
console.log("---------------------------------------");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

// Χρησιμοποιούμε το ClientReady (v14+) για να αποφύγουμε τα warnings
client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά συνδέθηκε επιτυχώς ως: ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // Δημιουργία σύνδεσης με επιπλέον ρυθμίσεις σταθερότητας
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });

  try {
    // Περιμένουμε τη σύνδεση να γίνει Ready (με το sodium-native θα γίνει αμέσως)
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Μπήκα στο κανάλι: ${voiceChannel.name}`);

    // Ρύθμιση Azure
    const speechConfig = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_SPEECH_KEY, 
        "westeurope"
    );
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

        player.on('error', error => {
          console.error(`❌ Σφάλμα Player: ${error.message}`);
        });

        player.on('idle', () => {
          console.log("⏹️ Τέλος ομιλίας.");
          // Περιμένουμε 2 δευτερόλεπτα πριν βγει για να μην κόβεται απότομα
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
            }
          }, 2000);
          synthesizer.close();
        });
      } else {
        console.error("❌ Σφάλμα Azure Synthesizer:", result.errorDetails);
        connection.destroy();
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα Σύνδεσης:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
    }
  }
}

// Event όταν κάποιος αλλάζει κατάσταση στη φωνή (μπαίνει/βγαίνει)
client.on("voiceStateUpdate", (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι (δεν ήταν πριν και είναι τώρα)
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Ο χρήστης ${newState.member.displayName} μπήκε στο κανάλι.`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
