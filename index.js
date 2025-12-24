require('dotenv').config();
const http = require("http");
const sodium = require('libsodium-wrappers');

// --- 1. RAILWAY HEALTH CHECK ---
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is Alive");
}).listen(PORT, "0.0.0.0");

// --- 2. DISCORD SETUP ---
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

client.once(Events.ClientReady, async () => {
    await sodium.ready;
    console.log("🔒 Encryption: Libsodium is READY");
    console.log(generateDependencyReport());
    console.log(`✅ Logged in as ${client.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    selfMute: false
  });

  // Force το encryption mode αν η βιβλιοθήκη κολλάει
  connection.on('stateChange', (oldState, newState) => {
    if (newState.status === VoiceConnectionStatus.Disconnected) {
        console.log("⚠️ Αποσυνδέθηκε, προσπάθεια επανασύνδεσης...");
    }
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log("🔊 Η σύνδεση έγινε Ready!");

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
    console.error("❌ Error during voice connection:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Καλωσόρισμα: ${newState.member.displayName}`);
    playSpeech(`${newState.member.displayName} καλωσήρθες`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
