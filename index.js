const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, VoiceConnectionStatus } = require("@discordjs/voice");
const { MsEdgeTTS, OUTPUT_FORMAT } = require("msedge-tts");
const { Readable } = require("stream");
const http = require("http");

http.createServer((req, res) => { res.write("Athina is ready"); res.end(); }).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates, GatewayIntentBits.GuildMembers]
});

const tts = new MsEdgeTTS();

client.once("ready", () => console.log(`✅ Bot Online: ${client.user.tag}`));

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
      let audioBuffer;

      // ΑΥΤΟΜΑΤΟΣ ΕΛΕΓΧΟΣ ΜΕΘΟΔΟΥ (ΓΙΑ ΝΑ ΜΗΝ ΞΑΝΑΒΓΑΛΕΙ "NOT A FUNCTION")
      if (typeof tts.toRaw === 'function') {
        audioBuffer = await tts.toRaw(text, { voice: "el-GR-AthinaNeural" });
      } else if (typeof tts.toBuffer === 'function') {
        audioBuffer = await tts.toBuffer(text, { voice: "el-GR-AthinaNeural" });
      } else {
        // Αν αποτύχουν όλα, χρησιμοποιούμε το Stream και το μετατρέπουμε
        const stream = await tts.toStream(text, { voice: "el-GR-AthinaNeural" });
        return playResource(connection, stream);
      }

      const stream = new Readable();
      stream.push(audioBuffer);
      stream.push(null);
      playResource(connection, stream);

    } catch (err) {
      console.error("TTS Error:", err);
      connection.destroy();
    }
  }
});

function playResource(connection, stream) {
  const resource = createAudioResource(stream);
  const player = createAudioPlayer();
  connection.subscribe(player);
  player.play(resource);
  player.on(AudioPlayerStatus.Idle, () => {
    setTimeout(() => { if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy(); }, 2000);
  });
}

process.on('uncaughtException', (err) => { if (err.code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') console.error(err); });

client.login(process.env.DISCORD_TOKEN);
