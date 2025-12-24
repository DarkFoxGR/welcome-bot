require('dotenv').config();

// --- FORCE ENCRYPTION PATCH ---
// Φορτώνουμε το tweetnacl χειροκίνητα πριν από οτιδήποτε άλλο
const nacl = require('tweetnacl');
const voice = require('@discordjs/voice');

console.log("--- Dependency Report ---");
console.log(voice.generateDependencyReport());
console.log("-----------------------");
// ------------------------------

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

// Απλό HTTP Server για να μην κλείνει το Railway το container
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot is running with TweetNaCl"); 
}).listen(port);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Η Αθηνά είναι Online! Συνδέθηκε ως: ${client.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // Δημιουργία σύνδεσης
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false,
  });

  try {
    // Αναμονή για τη σύνδεση (Handshake)
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Συνδέθηκε στο κανάλι: ${voiceChannel.name}`);

    // Ρύθμιση Azure Speech
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
          console.log("▶️ Η Αθηνά μιλάει...");
        });

        player.on(AudioPlayerStatus.Idle, () => {
          console.log("⏹️ Τέλος ομιλίας.");
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
                console.log("🔌 Αποσυνδέθηκε.");
            }
          }, 2000);
          synthesizer.close();
        });

        player.on('error', error => {
          console.error(`❌ Audio Player Error: ${error.message}`);
          connection.destroy();
        });

      } else {
        console.error("❌ Azure Error:", result.errorDetails);
        connection.destroy();
      }
    }, err => {
      console.error("❌ Synthesis Task Error:", err);
      connection.destroy();
    });

  } catch (error) {
    console.error("❌ Σφάλμα φωνής/κρυπτογράφησης:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
    }
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Έλεγχος αν κάποιος πραγματικός χρήστης μπήκε σε κανάλι
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Χρήστης: ${newState.member.displayName}`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
