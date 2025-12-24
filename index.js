require('dotenv').config();
// ΠΡΟΣΟΧΗ: Αυτό διορθώνει το σφάλμα No compatible encryption modes
try { require('sodium'); } catch (e) { require('libsodium-wrappers'); }

const { Client, GatewayIntentBits, Events } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { Readable } = require("stream");
const http = require("http");

// Server για το Render
http.createServer((req, res) => { res.write("Athina is Live"); res.end(); }).listen(process.env.PORT || 3000);

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

// Χρήση του νέου Event Name για να μη βγάζει Warning
client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά είναι έτοιμη! Συνδέθηκε ως ${c.user.tag}`);
});

async function playSpeech(text, voiceChannel) {
  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
  const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

  const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

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
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
        }, 1000);
        synthesizer.close();
      });
    }
  }, err => {
    console.error(err);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    synthesizer.close();
  });
}

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    playSpeech(`Καλωσήρθες ${newState.member.displayName}`, newState.channel);
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.id === ADMIN_ID && message.content.startsWith("!say ")) {
    const voiceChannel = message.member.voice.channel;
    if (voiceChannel) {
      const textToSay = message.content.replace("!say ", "");
      playSpeech(textToSay, voiceChannel);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
