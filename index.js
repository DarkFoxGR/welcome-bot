require('dotenv').config();

// --- 1. ΕΝΕΡΓΟΠΟΙΗΣΗ ΚΡΥΠΤΟΓΡΑΦΗΣΗΣ ---
const sodium = require('libsodium-wrappers');
const voice = require('@discordjs/voice');

async function prepareEncryption() {
    await sodium.ready;
    console.log("🔒 Libsodium Ready: Η κρυπτογράφηση ενεργοποιήθηκε.");
}
prepareEncryption();

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    entersState, 
    VoiceConnectionStatus, 
    StreamType 
} = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");
const http = require("http");

// --- 2. HEALTH CHECK SERVER ---
// Το Railway θα "χτυπάει" το Domain που δημιούργησες και αυτός ο server θα απαντάει "OK"
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot is Online and Healthy!"); 
}).listen(port, "0.0.0.0", () => {
    console.log(`🌐 Health Check Server active on port ${port}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά συνδέθηκε: ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // Περιμένουμε την κρυπτογράφηση να είναι έτοιμη
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Περιμένουμε τη σύνδεση να γίνει Ready (μέχρι 20 δευτερόλεπτα)
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Μπήκα στο κανάλι: ${voiceChannel.name}`);

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
  // Ανίχνευση αν κάποιος μπήκε σε κανάλι (όχι bot)
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Είσοδος χρήστη: ${newState.member.displayName}`);
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
