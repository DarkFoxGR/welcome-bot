require('dotenv').config();
const sodium = require('libsodium-wrappers');

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

// Ο server για το Koyeb - Χρησιμοποιούμε τη θύρα 8080
const port = process.env.PORT || 8080;
http.createServer((req, res) => { 
    res.writeHead(200);
    res.end("Athina Bot is Running on Koyeb!"); 
}).listen(port);

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

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά ξεκίνησε επιτυχώς! Συνδέθηκε ως ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  // Περιμένουμε την κρυπτογράφηση να είναι έτοιμη
  await sodium.ready;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);

    const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const stream = new Readable();
        stream.push(Buffer.from(result.audioData));
        stream.push(null);

        const resource = createAudioResource(stream, { inputType: StreamType.Arbitrary });
        const player = createAudioPlayer();
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
          }, 1000);
          synthesizer.close();
        });
      }
    }, err => {
      console.error("Synthesizer error:", err);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    });

  } catch (error) {
    console.error("Σφάλμα σύνδεσης φωνής:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}

client.on("voiceStateUpdate", (oldState, newState) => {
  // Αν κάποιος μπει σε κανάλι και δεν είναι bot
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.login(process.env.DISCORD_TOKEN);
