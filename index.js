require('dotenv').config();
const sodium = require('libsodium-wrappers');
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, entersState, VoiceConnectionStatus, StreamType } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");
const http = require("http");

// Health check για να μην πεθαίνει το container
http.createServer((req, res) => { res.writeHead(200); res.end("Bot is Ready"); }).listen(process.env.PORT || 8080);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

// ΤΟ ΚΛΕΙΔΙ: Περιμένουμε την κρυπτογράφηση πριν από ΟΛΑ
client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    await sodium.ready; // Αναμονή εδώ!
    
    const connection = joinVoiceChannel({
      channelId: newState.channel.id,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 10000);
      
      const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
      const ssml = `<speak version="1.0" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.9">${newState.member.displayName} καλωσήρθες</prosody></voice></speak>`;

      synthesizer.speakSsmlAsync(ssml, result => {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(createAudioResource(bufferStream, { inputType: StreamType.Arbitrary }));
      });
    } catch (e) {
      console.error("Encryption error:", e);
      connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
