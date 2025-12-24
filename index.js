require('dotenv').config();
const sodium = require('libsodium-wrappers');

// --- FORCE ENCRYPTION PATCH ---
const { generateDependencyReport } = require('@discordjs/voice');
console.log("Dependency Report:", generateDependencyReport());
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
const { Readable } = require("stream");
const http = require("http");

const port = process.env.PORT || 8000;
http.createServer((req, res) => { res.writeHead(200); res.end("Bot is Live"); }).listen(port);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
    console.log(`✅ Η Αθηνά ξεκίνησε!`);
});

async function playSpeech(text, voiceChannel) {
  // ΠΕΡΙΜΕΝΟΥΜΕ ΤΟ SODIUM
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
    // ΕΔΩ ΕΙΝΑΙ ΤΟ ΚΛΕΙΔΙ: Δοκιμάζουμε να μην ορίσουμε τίποτα 
    // και να αφήσουμε το sodium.ready να κάνει τη δουλειά
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30000);

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const resource = createAudioResource(new Readable().wrap(new Readable({
          read() { this.push(Buffer.from(result.audioData)); this.push(null); }
        })), { inputType: StreamType.Arbitrary });

        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          setTimeout(() => { if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy(); }, 1500);
          synthesizer.close();
        });
      }
    });

  } catch (error) {
    console.error("Σφάλμα:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
