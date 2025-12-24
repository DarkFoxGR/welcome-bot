require('dotenv').config();

// --- ENCRYPTION & DEPENDENCY CHECK ---
const { generateDependencyReport } = require('@discordjs/voice');
const nacl = require('tweetnacl'); // Επιβεβαίωση ότι το tweetnacl είναι διαθέσιμο

console.log("--------------------------------------------------");
console.log("Railway Deployment - Dependency Report:");
console.log(generateDependencyReport());
console.log("--------------------------------------------------");
// -------------------------------------

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    AudioPlayerStatus, 
    VoiceConnectionStatus, 
    entersState,
    StreamType 
} = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");
const http = require("http");

// Δημιουργία ενός απλού HTTP server για το Railway health check
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot is running on Railway"); 
}).listen(port);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Η Αθηνά συνδέθηκε στο Discord ως: ${client.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Αναμονή για σύνδεση (έως 20 δευτερόλεπτα)
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Σύνδεση στο κανάλι "${voiceChannel.name}" επιτυχής!`);

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    // SSML για καλύτερη προφορά
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

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

        player.on(AudioPlayerStatus.Playing, () => {
            console.log("▶️ Ξεκίνησε η αναπαραγωγή ήχου.");
        });

        player.on(AudioPlayerStatus.Idle, () => {
          // Καθυστέρηση 2 δευτερολέπτων πριν την αποσύνδεση
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
                console.log("🔌 Αποσυνδέθηκε κανονικά.");
            }
          }, 2000);
          synthesizer.close();
        });

        player.on('error', error => {
          console.error(`Audio Player Error: ${error.message}`);
          connection.destroy();
        });
      }
    }, err => {
      console.error("Azure Synthesis Error:", err);
      connection.destroy();
    });

  } catch (error) {
    console.error("❌ Σφάλμα φωνής:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Ενεργοποίηση μόνο όταν κάποιος μπαίνει σε κανάλι (όχι bot)
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Ο χρήστης ${newState.member.displayName} εισήλθε.`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
