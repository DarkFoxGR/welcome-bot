require('dotenv').config();
const nacl = require('tweetnacl');

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

// Απλό server για να κρατάει το service ζωντανό στο Cloud
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot is Active"); 
}).listen(port);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Η Αθηνά ξεκίνησε επιτυχώς!`);
});

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Αναμονή για σύνδεση στο κανάλι (έως 20 δευτερόλεπτα)
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log("🔊 Σύνδεση φωνής έτοιμη!");

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    // Ρύθμιση φωνής και κειμένου
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        // Μετατροπή των δεδομένων ήχου σε stream
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
            console.log("▶️ Η Αθηνά μιλάει στο κανάλι...");
        });

        player.on(AudioPlayerStatus.Idle, () => {
          // Μικρή καθυστέρηση πριν την έξοδο για να μην κόβεται ο ήχος
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
                connection.destroy();
                console.log("🔌 Αποσύνδεση από το κανάλι.");
            }
          }, 2000);
          synthesizer.close();
        });

        player.on('error', error => {
          console.error(`Σφάλμα Player: ${error.message}`);
          connection.destroy();
        });
      }
    }, err => {
      console.error("Azure Synthesizer Error:", err);
      connection.destroy();
    });

  } catch (error) {
    console.error("Σφάλμα σύνδεσης φωνής:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Ανίχνευση εισόδου χρήστη (όχι bot)
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Ο χρήστης ${newState.member.displayName} μπήκε στο κανάλι.`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
