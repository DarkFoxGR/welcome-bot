const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { Readable } = require("stream");
const http = require("http");

// Keep-alive server για το Render
http.createServer((req, res) => { res.write("Athina Bot is Active"); res.end(); }).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

// Ρυθμίσεις Azure
const SPEECH_KEY = "9LFKQhTyqkt4XjNZ2Upolvc41QzW50okzE5uPncnJu3FHB3CZ49tJQQJ99BLAC5RqLJXJ3w3AAAYACOGz4dJ";
const SPEECH_REGION = "westeurope";

client.once("ready", () => console.log(`✅ Η Αθηνά είναι έτοιμη και ρυθμισμένη: ${client.user.tag}`));

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι (και δεν είναι bot)
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    console.log(`🔊 Καλωσόρισμα (πιο αργό) στον χρήστη: ${member.displayName}`);

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
    });

    try {
      const speechConfig = sdk.SpeechConfig.fromSubscription(SPEECH_KEY, SPEECH_REGION);
      const synthesizer = new sdk.SpeechSynthesizer(speechConfig);

      // Το κείμενο και η ρύθμιση ταχύτητας (rate="0.85")
      const welcomeText = `Καλωσήρθες στο κανάλι μας, ${member.displayName}`;
      const ssml = `
        <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
          <voice name="el-GR-AthinaNeural">
            <prosody rate="0.85">
              ${welcomeText}
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
              if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            }, 1500);
            synthesizer.close();
          });
        }
      }, err => {
        console.error("TTS Error:", err);
        if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
        synthesizer.close();
      });

    } catch (error) {
      console.error("Connection Error:", error);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
