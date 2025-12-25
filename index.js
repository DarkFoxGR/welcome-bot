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

const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is Online");
}).listen(PORT, "0.0.0.0");

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

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // ΑΥΞΗΣΗ ΧΡΟΝΟΥ: Περιμένουμε έως 30 δευτερόλεπτα για να γίνει Ready
    console.log("⏳ Προσπάθεια σύνδεσης στο κανάλι...");
    await entersState(connection, VoiceConnectionStatus.Ready, 30000);
    console.log("🔊 Η σύνδεση ολοκληρώθηκε, ετοιμάζω τη φωνή...");

    // Μικρή παύση 1 δευτερολέπτου για να σταθεροποιηθεί η σύνδεση
    await new Promise(resolve => setTimeout(resolve, 1000));

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
        const resource = createAudioResource(bufferStream, { 
          inputType: StreamType.Arbitrary 
        });
        
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
    console.error("❌ Σφάλμα στη σύνδεση:", error.message);
    // Αν αποτύχει, κλείνουμε τη σύνδεση για να μπορεί να ξαναπροσπαθήσει μετά
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) {
      connection.destroy();
    }
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε (και δεν ήταν ήδη μέσα σε άλλο κανάλι)
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    console.log(`👤 Ο χρήστης ${newState.member.displayName} μπήκε.`);
    const welcomeMessage = `Καλωσήρθες στην παρέα μας, ${newState.member.displayName}! Καλές Γιορτές να έχεις!`;
    playSpeech(welcomeMessage, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
