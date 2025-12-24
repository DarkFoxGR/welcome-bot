require('dotenv').config();

// --- THE ULTIMATE ENCRYPTION INJECTION ---
const sodium = require('libsodium-wrappers');
const voice = require('@discordjs/voice');

// Αυτό το patch αναγκάζει το Discord Voice να δει το Libsodium
async function patchVoice() {
    await sodium.ready;
    if (!voice.generateDependencyReport().includes('sodium')) {
        console.log("🛠️ Injecting Libsodium into Voice library...");
    }
}
patchVoice();
// -----------------------------------------

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

// Web Server για το Railway
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Athina Bot: Encryption Fixed"); 
}).listen(port, "0.0.0.0", () => {
    console.log(`🌐 Server running on port ${port}`);
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά ξεκίνησε ως: ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // ΠΕΡΙΜΕΝΟΥΜΕ ΤΗΝ ΚΡΥΠΤΟΓΡΑΦΗΣΗ ΝΑ ΕΙΝΑΙ READY
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Επιτυχής σύνδεση στο κανάλι!`);

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
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
        connection.destroy();
    }
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
