const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const { EdgeTTS } = require("edge-tts"); // Η νέα σταθερή βιβλιοθήκη
const http = require("http");

http.createServer((req, res) => { res.write("Stable Athina Live"); res.end(); }).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

// Δημιουργία TTS
const tts = new EdgeTTS();

client.once("ready", () => console.log(`✅ Το Bot είναι Online (Edge-TTS): ${client.user.tag}`));

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    console.log(`🎤 Καλωσόρισμα: ${member.displayName}`);

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
    });

    try {
      const text = `Καλωσήρθες ${member.displayName}`;
      
      // Η νέα βιβλιοθήκη επιστρέφει Readable Stream απευθείας!
      const audioStream = tts.ttsPromise(text, "el-GR-AthinaNeural");

      const resource = createAudioResource(audioStream);
      const player = createAudioPlayer();

      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
        }, 2000);
      });

    } catch (err) {
      console.error("New TTS Error:", err);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
