require('dotenv').config(); 
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { Readable } = require("stream");
const http = require("http");

// Keep-alive server για το Render
http.createServer((req, res) => { 
    res.write("Athina Bot is Active"); 
    res.end(); 
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Ρυθμίσεις Azure από το Secret File (.env) του Render
const SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const SPEECH_REGION = "westeurope";

// Το ID σου για την εντολή !say
const ADMIN_ID = "364849864611201026"; 

client.once("ready", () => {
    console.log(`✅ Η Αθηνά ξεκίνησε! Συνδεδεμένος ως: ${client.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false // Σημαντικό για να μην αποσυνδέεται
  });

  const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
      <voice name="el-GR-AthinaNeural">
        <prosody rate="0.85">
          ${text}
        </prosody>
      </voice>
    </speak>`;

  synthesizer.speakSsmlAsync(ssml, result => {
    if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
      const buffer = Buffer.from(result.audioData);
      const stream = new Readable();
      stream.push(buffer);
      stream.push(null);

      const resource = createAudioResource(stream);
      const player = createAudioPlayer();
      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
              connection.destroy();
          }
        }, 1500);
        synthesizer.close();
      });
    }
  }, err => {
    console.error(err);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    synthesizer.close();
  });
}

// Αυτόματο καλωσόρισμα
client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες στο κανάλι μας, ${newState.member.displayName}`, newState.channel);
  }
});

// Εντολή !say
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!say ")) return;
  if (message.author.id !== ADMIN_ID) return message.reply("❌ Δεν έχεις άδεια!");

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply("⚠️ Μπες σε Voice Channel!");

  const textToSay = message.content.replace("!say ", "");
  playSpeech(textToSay, voiceChannel);
});

client.login(process.env.DISCORD_TOKEN);
