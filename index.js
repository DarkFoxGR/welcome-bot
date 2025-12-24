require('dotenv').config();
const sodium = require('libsodium-wrappers');
const { 
    Client, 
    GatewayIntentBits, 
    Events 
} = require("discord.js");
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

// --- STARTUP & ENCRYPTION CHECK ---
(async () => {
    await sodium.ready;
    console.log("🔒 Libsodium Ready - Η κρυπτογράφηση ενεργοποιήθηκε.");
})();

const port = process.env.PORT || 8080;
http.createServer((req, res) => { res.writeHead(200); res.end("Bot Online"); }).listen(port);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

async function playSpeech(text, voiceChannel) {
  // Αναμονή για την κρυπτογράφηση πριν από κάθε σύνδεση
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Περιμένουμε τη σύνδεση να γίνει Ready (εδώ γινόταν το σφάλμα)
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log("✅ Σύνδεση επιτυχής με κρυπτογράφηση.");

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));
        const resource = createAudioResource(bufferStream, { inputType: StreamType.Arbitrary, inlineVolume: true });
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          setTimeout(() => { if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy(); }, 2000);
          synthesizer.close();
        });
      }
    });
  } catch (error) {
    console.error("❌ Σφάλμα φωνής:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
