require('dotenv').config();
const http = require("http");
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

// --- 1. HEALTH CHECK ---
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is Online");
}).listen(PORT, "0.0.0.0");

// --- 2. CLIENT SETUP ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Μεταβλητή για το Cooldown (10 δευτερόλεπτα)
let isProcessing = false;

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά είναι έτοιμη! Συνδέθηκε ως: ${c.user.tag}`);
});

// --- 3. ΚΥΡΙΑ ΣΥΝΑΡΤΗΣΗ ΟΜΙΛΙΑΣ ---
async function playSpeech(text, voiceChannel) {
  if (isProcessing) return; // Αν μιλάει ήδη, αγνόησε τη νέα εντολή
  isProcessing = true;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    await new Promise(resolve => setTimeout(resolve, 800));

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY, 
      process.env.AZURE_REGION || "westeurope"
    );
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
            isProcessing = false; // Απελευθέρωση για την επόμενη εντολή
          }, 1500);
          synthesizer.close();
        });
      } else {
        isProcessing = false;
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    isProcessing = false;
  }
}

// --- 4. ΑΥΤΟΜΑΤΟ ΚΑΛΩΣΟΡΙΣΜΑ (Διορθωμένο χωρίς το Καλές Γιορτές) ---
client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    // Εδώ αφαιρέθηκε η φράση "Καλές Γιορτές να έχεις!"
    const welcomeMessage = `Καλωσήρθες στην παρέα μας, ${newState.member.displayName}!`;
    playSpeech(welcomeMessage, newState.channel);
  }
});

// --- 5. ΕΝΤΟΛΗ !say ---
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!say ")) return;

  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) {
    return message.reply("Πρέπει να είσαι σε voice channel για να χρησιμοποιήσεις την εντολή!");
  }

  if (isProcessing) {
    return message.reply("Περίμενε λίγο, είμαι απασχολημένη!");
  }

  const textToSay = message.content.slice(5).trim();
  
  if (textToSay.length > 200) {
    return message.reply("Το μήνυμα είναι πολύ μεγάλο! (Όριο 200 χαρακτήρες)");
  }

  console.log(`💬 !say από ${message.author.username}: ${textToSay}`);
  playSpeech(textToSay, voiceChannel);
});

client.login(process.env.DISCORD_TOKEN);
