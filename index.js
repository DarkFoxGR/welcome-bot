const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const http = require("http");

http.createServer((req, res) => { res.write("Athina Fix is Live"); res.end(); }).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

const tts = new MsEdgeTTS();

client.once("ready", () => console.log(`✅ Το Bot είναι Online: ${client.user.tag}`));

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
    });

    try {
      const text = `Καλωσήρθες ${member.displayName}`;

      // 1. ΠΡΩΤΑ το setMetadata (όπως ζήτησε το log)
      await tts.setMetadata("el-GR-AthinaNeural", OUTPUT_FORMAT.AUDIO_24KHZ_48KBPS_MONO_SIREN);
      
      // 2. ΠΕΡΙΜΕΝΟΥΜΕ το stream (await) γιατί η βιβλιοθήκη το επιστρέφει ως Promise
      const audioStream = await tts.toStream(text);
      
      const resource = createAudioResource(audioStream);
      const player = createAudioPlayer();

      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
        }, 2000);
      });

      player.on('error', error => {
        console.error(`Audio Error: ${error.message}`);
        connection.destroy();
      });

    } catch (err) {
      console.error("TTS Final Error:", err);
      if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    }
  }
});

process.on('uncaughtException', (err) => {
    if (err.code === 'ERR_SOCKET_DGRAM_NOT_RUNNING') return;
    console.error('❌ Fatal Error:', err);
});

client.login(process.env.DISCORD_TOKEN);
