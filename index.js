require('dotenv').config();

// --- FORCE ENCRYPTION PATCH ---
const sodium = require('libsodium-wrappers');
const voice = require('@discordjs/voice');

// Αυτό το block "κολλάει" το sodium μέσα στη βιβλιοθήκη voice
(async () => {
    await sodium.ready;
    console.log("🔒 ENCRYPTION LOADED MANUALLY");
})();
// ------------------------------

const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, StreamType } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");
const http = require("http");

// Web Server για το Railway Health Check
http.createServer((req, res) => { res.writeHead(200); res.end("Bot is alive"); }).listen(process.env.PORT || 8080);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Μόνο όταν μπαίνει χρήστης
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    
    // ΠΕΡΙΜΕΝΟΥΜΕ ΤΟ SODIUM ΠΡΙΝ ΚΑΝΟΥΜΕ JOIN
    await sodium.ready;

    const connection = joinVoiceChannel({
      channelId: newState.channel.id,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15000);
      
      const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
      
      const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
        <voice name="el-GR-AthinaNeural">
          <prosody rate="0.9">${newState.member.displayName} καλωσήρθες</prosody>
        </voice>
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
            }, 3000);
            synthesizer.close();
          });
        }
      });
    } catch (e) {
      console.error("❌ Σφάλμα:", e.message);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
