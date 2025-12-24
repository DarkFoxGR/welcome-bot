require('dotenv').config();
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
const http = require("http");

// Εκτύπωση αναφοράς για να δούμε αν το sodium-native είναι "Found"
console.log(generateDependencyReport());

http.createServer((req, res) => { 
    res.writeHead(200); 
    res.end("Bot is Online"); 
}).listen(process.env.PORT || 8080);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers
  ]
});

// Διόρθωση του Warning που είδες στα logs
client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά ξεκίνησε ως: ${c.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    
    console.log(`🔊 Σύνδεση για: ${newState.member.displayName}`);

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
        <voice name="el-GR-AthinaNeural"><prosody rate="0.9">${newState.member.displayName} καλωσήρθες</prosody></voice>
      </speak>`;

      synthesizer.speakSsmlAsync(ssml, result => {
        if (result.audioData) {
          const bufferStream = new PassThrough();
          bufferStream.end(Buffer.from(result.audioData));
          const player = createAudioPlayer();
          connection.subscribe(player);
          player.play(createAudioResource(bufferStream, { inputType: StreamType.Arbitrary }));
          
          player.on('idle', () => {
            setTimeout(() => { if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy(); }, 3000);
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
