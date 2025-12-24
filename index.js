require('dotenv').config();
const http = require("http");

// --- 1. ΑΜΕΣΟΣ SERVER ΓΙΑ ΤΟ RAILWAY ---
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Health Check OK");
}).listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Health Check Server on port ${PORT}`);
});

// --- 2. ΦΟΡΤΩΣΗ ΚΡΥΠΤΟΓΡΑΦΗΣΗΣ ---
// Χρησιμοποιούμε το libsodium-wrappers που υποστηρίζει aead_aes256_gcm
const sodium = require('libsodium-wrappers');
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

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, async (c) => {
    await sodium.ready; // Περιμένουμε οπωσδήποτε το sodium
    console.log(`✅ Η Αθηνά ξεκίνησε: ${c.user.tag}`);
    console.log("--- Dependency Report ---");
    console.log(generateDependencyReport());
});

async function playSpeech(text, voiceChannel) {
  // Εξασφαλίζουμε ότι το sodium είναι έτοιμο πριν τη σύνδεση
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Σύνδεση επιτυχής!`);

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

        const player = createAudioPlayer();
        const resource = createAudioResource(bufferStream, { inputType: StreamType.Arbitrary });
        
        connection.subscribe(player);
        player.play(resource);

        player.on('idle', () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
          }, 2000);
          synthesizer.close();
        });
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα σύνδεσης:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
