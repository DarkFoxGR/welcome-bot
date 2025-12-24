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

// Ρυθμίσεις Azure
const SPEECH_KEY = "9LFKQhTyqkt4XjNZ2Upolvc41QzW50okzE5uPncnJu3FHB3CZ49tJQQJ99BLAC5RqLJXJ3w3AAAYACOGz4dJ";
const SPEECH_REGION = "westeurope";

// Το δικό σου ID για να έχεις τον έλεγχο
const ADMIN_ID = "364849864611201026"; 

client.once("ready", () => {
    console.log(`✅ Η Αθηνά ξεκίνησε! Συνδεδεμένος ως: ${client.user.tag}`);
});

// Κύρια λειτουργία ομιλίας (TTS)
async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  // SSML για αργή και φυσική φωνή (rate="0.85")
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
    console.error("Azure Error:", err);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    synthesizer.close();
  });
}

// 1. Λειτουργία Καλωσορίσματος (Για όλους)
client.on("voiceStateUpdate", (oldState, newState) => {
  // Αν κάποιος μπει σε κανάλι και δεν είναι bot
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    const text = `Καλωσήρθες στο κανάλι μας, ${newState.member.displayName}`;
    playSpeech(text, newState.channel);
  }
});

// 2. Εντολή !say (Μόνο για σένα)
client.on("messageCreate", async (message) => {
  // Αγνοούμε bot και μηνύματα που δεν ξεκινούν με !say
  if (message.author.bot || !message.content.startsWith("!say ")) return;

  // Έλεγχος αν ο χρήστης είναι ο Admin
  if (message.author.id !== ADMIN_ID) {
    return message.reply("❌ Δεν έχεις άδεια να χρησιμοποιείς την Αθηνά!");
  }

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply("⚠️ Πρέπει να μπεις πρώτα σε ένα Voice Channel!");
  }

  const textToSay = message.content.replace("!say ", "");
  playSpeech(textToSay, voiceChannel);
});

client.login(process.env.DISCORD_TOKEN);
