require('dotenv').config();
const sodium = require('libsodium-wrappers');
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

// --- SERVER ΓΙΑ ΤΟ RAILWAY HEALTH CHECK ---
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot is Online"); 
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
  // 1. ΠΕΡΙΜΕΝΟΥΜΕ ΤΗΝ ΚΡΥΠΤΟΓΡΑΦΗΣΗ (Λύνει το σφάλμα No compatible encryption modes)
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // 2. ΠΕΡΙΜΕΝΟΥΜΕ ΤΗ ΣΥΝΔΕΣΗ
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Σύνδεση επιτυχής στο κανάλι: ${voiceChannel.name}`);

    // 3. ΡΥΘΜΙΣΗ AZURE SPEECH
    const speechConfig = sdk.SpeechConfig.fromSubscription(
        process.env.AZURE_SPEECH_KEY, 
        "westeurope" // Βεβαιώσου ότι η περιοχή σου είναι σωστή
    );
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
                    <voice name="el-GR-AthinaNeural">
                        <prosody rate="0.85">${text}</prosody>
                    </voice>
                  </speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        console.log("📝 Ο ήχος δημιουργήθηκε επιτυχώς.");

        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));

        // 4. ΔΗΜΙΟΥΡΓΙΑ AUDIO RESOURCE
        const resource = createAudioResource(bufferStream, {
          inputType: StreamType.Arbitrary,
          inlineVolume: true
        });

        if (resource.volume) resource.volume.setVolume(0.9);

        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Playing, () => {
          console.log("▶️ Η Αθηνά μιλάει τώρα...");
        });

        // 5. ΑΠΟΔΕΣΜΕΥΣΗ ΚΑΙ ΕΞΟΔΟΣ
        player.on(AudioPlayerStatus.Idle, () => {
          console.log("⏹️ Τέλος ομιλίας. Αποσύνδεση σε 2 δευτερόλεπτα.");
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
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
    console.error("❌ Σφάλμα φωνής:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Ενεργοποίηση μόνο όταν κάποιος (όχι bot) μπαίνει σε κανάλι
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Είσοδος χρήστη: ${newState.member.displayName}`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
