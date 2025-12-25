require('dotenv').config();
const http = require("http");
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

// --- 1. HEALTH CHECK ΓΙΑ ΤΟ RENDER (Κρατάει το bot online) ---
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is Online");
}).listen(PORT, "0.0.0.0");

// --- 2. ΡΥΘΜΙΣΕΙΣ DISCORD CLIENT ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά είναι έτοιμη! Συνδέθηκε ως: ${c.user.tag}`);
    console.log(generateDependencyReport());
});

// --- 3. ΣΥΝΑΡΤΗΣΗ ΓΙΑ ΤΗ ΦΩΝΗ ---
async function playSpeech(text, voiceChannel) {
  // Ξεκινάμε τη σύνθεση στην Azure αμέσως για να μη χάνουμε χρόνο
  const speechConfig = sdk.SpeechConfig.fromSubscription(
    process.env.AZURE_SPEECH_KEY, 
    process.env.AZURE_REGION || "westeurope"
  );
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
  
  // SSML: Εδώ ρυθμίζουμε τη φωνή (rate="0.85" για πιο αργά)
  const ssml = `
    <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
      <voice name="el-GR-AthinaNeural">
        <prosody rate="0.85">
          ${text}
        </prosody>
      </voice>
    </speak>`;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Περιμένουμε το bot να συνδεθεί στο κανάλι
    await entersState(connection, VoiceConnectionStatus.Ready, 15000);

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.audioData) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));

        const player = createAudioPlayer();
        const resource = createAudioResource(bufferStream, { 
          inputType: StreamType.Arbitrary 
        });
        
        connection.subscribe(player);
        player.play(resource);

        // Όταν τελειώσει να μιλάει, περιμένει 1.5 δευτερόλεπτο και βγαίνει
        player.on('idle', () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
              connection.destroy();
            }
          }, 1500);
          synthesizer.close();
        });
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα στη σύνδεση:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  }
}

// --- 4. ΕΛΕΓΧΟΣ ΟΤΑΝ ΜΠΑΙΝΕΙ ΚΑΠΟΙΟΣ ---
client.on("voiceStateUpdate", (oldState, newState) => {
  // Αν κάποιος μπει σε κανάλι και δεν είναι bot
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Ο χρήστης ${newState.member.displayName} μπήκε στο κανάλι.`);
    
    // Το κείμενο που θα λέει η Αθηνά
    const welcomeMessage = `Καλωσήρθες στην παρέα μας, ${newState.member.displayName}! Καλές Γιορτές να έχεις!`;
    
    playSpeech(welcomeMessage, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
