require('dotenv').config();

// --- FORCE TWEETNACL PATCH ---
const nacl = require('tweetnacl');
// Αυτό το κομμάτι λέει στο Discord Voice να χρησιμοποιήσει το tweetnacl
// παρόλο που το report λέει ότι δεν το βλέπει αυτόματα.
// -----------------------------

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

http.createServer((req, res) => { res.write("Athina Ready"); res.end(); }).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers, 
    GatewayIntentBits.GuildMessages, 
    GatewayIntentBits.MessageContent
  ]
});

const SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const SPEECH_REGION = "westeurope";
const ADMIN_ID = "364849864611201026";

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά ξεκίνησε! Συνδέθηκε ως ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    // Προσθήκη επιλογών κρυπτογράφησης
    selfDeaf: false,
  });

  try {
    // Περιμένουμε τη σύνδεση να είναι Ready
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);

    const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const resource = createAudioResource(new Readable().wrap(new Readable({
          read() { this.push(Buffer.from(result.audioData)); this.push(null); }
        })), {
            inputType: StreamType.Arbitrary, // Βοηθάει στην αναγνώριση του stream χωρίς opus
        });

        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
          }, 1500);
          synthesizer.close();
        });
      }
    }, err => {
      console.error("Synthesizer error:", err);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    });

  } catch (error) {
    console.error("Σφάλμα σύνδεσης:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.id === ADMIN_ID && message.content.startsWith("!say ")) {
    const voiceChannel = message.member.voice.channel;
    if (voiceChannel) playSpeech(message.content.replace("!say ", ""), voiceChannel);
  }
});

client.login(process.env.DISCORD_TOKEN);
