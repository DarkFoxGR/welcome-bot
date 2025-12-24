require('dotenv').config(); // Διαβάζει το Secret File (.env) από το Render
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { Readable } = require("stream");
const http = require("http");

// Keep-alive server για να παραμένει online το bot στο Render
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

// Ρυθμίσεις Azure - Τώρα διαβάζονται από το Secret File
const SPEECH_KEY = process.env.AZURE_SPEECH_KEY;
const SPEECH_REGION = "westeurope";

// Το ID σου για να έχεις τον αποκλειστικό έλεγχο
const ADMIN_ID = "364849864611201026"; 

client.once("ready", () => {
    console.log(`✅ Η Αθηνά είναι online! Συνδεδεμένος ως: ${client.user.tag}`);
});

// Κεντρική λειτουργία ομιλίας (TTS)
async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
  });

  const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  // Ρύθμιση φωνής el-GR-AthinaNeural με ταχύτητα 0.80 (πιο φυσική)
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

// 1. Αυτόματο Καλωσόρισμα όταν μπαίνει κάποιος σε κανάλι
client.on("voiceStateUpdate", (oldState, newState) => {
  // Αν ένας χρήστης (όχι bot) μπει σε ένα Voice Channel
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    const text = `Καλωσήρθες στη παρέα μας, ${newState.member.displayName}`;
    playSpeech(text, newState.channel);
  }
});

// 2. Εντολή !say - Δουλεύει ΜΟΝΟ για εσένα
client.on("messageCreate", async (message) => {
  // Αγνοούμε μηνύματα από bots ή μηνύματα που δεν ξεκινούν με !say
  if (message.author.bot || !message.content.startsWith("!say ")) return;

  // Έλεγχος αν ο χρήστης είναι ο Admin (εσύ)
  if (message.author.id !== ADMIN_ID) {
    return message.reply("❌ Μόνο ο δημιουργός μου μπορεί να χρησιμοποιήσει αυτή την εντολή.");
  }

  // Έλεγχος αν ο Admin είναι σε Voice Channel
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply("⚠️ Πρέπει να μπεις σε ένα κανάλι φωνής πρώτα!");
  }

  // Αφαίρεση του "!say " από το κείμενο και εκφώνηση
  const textToSay = message.content.replace("!say ", "");
  playSpeech(textToSay, voiceChannel);
});

client.login(process.env.DISCORD_TOKEN);
