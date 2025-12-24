require('dotenv').config();

const sodium = require('libsodium-wrappers');
const voice = require('@discordjs/voice');

async function prepareEncryption() {
    await sodium.ready;
    console.log("🔒 Libsodium Ready.");
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

// --- 1. HEALTH CHECK SERVER (ΣΤΑΘΕΡΗ ΠΟΡΤΑ 8080) ---
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("OK"); 
});

// Ακούμε σε όλες τις διεπαφές (0.0.0.0) για να μας βλέπει το Railway
server.listen(PORT, "0.0.0.0", () => {
    console.log(`🌐 Health Check Server is LIVE on port ${PORT}`);
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
  await sodium.ready;
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.9">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(createAudioResource(bufferStream, { inputType: StreamType.Arbitrary }));
        player.on('idle', () => {
          setTimeout(() => { if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy(); }, 2000);
          synthesizer.close();
        });
      }
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
