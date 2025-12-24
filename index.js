require('dotenv').config();

// 1. Εισαγωγή Libsodium και αναμονή για αρχικοποίηση
const sodium = require('libsodium-wrappers');

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState,
    StreamType,
    generateDependencyReport 
} = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");
const http = require("http");

// Εκτύπωση αναφοράς εξαρτήσεων για έλεγχο στα Logs του Railway
console.log("--- Dependency Report ---");
console.log(generateDependencyReport());
console.log("-----------------------");

// Απλό Server για το Health Check του Railway
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Bot is Active and Ready"); 
}).listen(port);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Η Αθηνά ξεκίνησε! Συνδέθηκε ως: ${client.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // --- ΤΟ ΠΙΟ ΚΡΙΣΙΜΟ ΣΗΜΕΙΟ ---
  // Αναγκάζουμε το Bot να περιμένει τη βιβλιοθήκη κρυπτογράφησης
  await sodium.ready;
  console.log("🔒 Libsodium Ready - Ξεκινάει η σύνδεση...");

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  try {
    // Αναμονή για πλήρη σύνδεση
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Σύνδεση επιτυχής στο κανάλι: ${voiceChannel.name}`);

    // Ρύθμιση Azure
    const speechConfig = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_SPEECH_KEY, 
        "westeurope"
    );
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
                    <voice name="el-GR-AthinaNeural">
                        <prosody rate="0.85">${text}</prosody>
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

        if (resource.volume) resource.volume.setVolume(0.95);

        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Playing, () => {
          console.log("▶️ Μετάδοση ήχου σε εξέλιξη...");
        });

        player.on(AudioPlayerStatus.Idle, () => {
          console.log("⏹️ Τέλος ομιλίας.");
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
                console.log("🔌 Αποσύνδεση.");
            }
          }, 2000);
          synthesizer.close();
        });

        player.on('error', error => {
          console.error(`❌ Audio Player Error: ${error.message}`);
          connection.destroy();
        });

      } else {
        console.error("❌ Azure Error Details:", result.errorDetails);
        connection.destroy();
      }
    }, err => {
      console.error("❌ Synthesis Error:", err);
      connection.destroy();
    });

  } catch (error) {
    console.error("❌ Σφάλμα φωνής:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
    }
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι (όχι bot)
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Χρήστης: ${newState.member.displayName}`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
