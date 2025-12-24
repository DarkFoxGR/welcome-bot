require('dotenv').config();
const http = require("http");

// --- 1. HEALTH CHECK ΓΙΑ ΤΟ RAILWAY ---
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is Online");
}).listen(PORT, "0.0.0.0");

// --- 2. ΦΟΡΤΩΣΗ DISCORD ---
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

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά συνδέθηκε: ${c.user.tag}`);
    console.log("--- Dependency Report ---");
    console.log(generateDependencyReport());
});

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  // --- ΤΟ FIX ΓΙΑ ΤΟ ENCRYPTION ERROR ---
  connection.on('stateChange', (oldState, newState) => {
      // Αν κολλήσει στο Signaling, προσπαθούμε να "σπρώξουμε" τη σύνδεση
      if (newState.status === VoiceConnectionStatus.Signalling) {
          console.log("🔄 Signaling... Trying to negotiate encryption.");
      }
  });

  try {
    // Δίνουμε περισσότερο χρόνο (30s) για το encryption handshake
    await entersState(connection, VoiceConnectionStatus.Ready, 30000);
    console.log(`🔊 Η σύνδεση έγινε Ready!`);

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
        <voice name="el-GR-AthinaNeural"><prosody rate="0.9">${text}</prosody></voice>
      </speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.audioData) {
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
    console.log(`👤 Χρήστης μπήκε: ${newState.member.displayName}`);
    playSpeech(`${newState.member.displayName} καλωσήρθες`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
