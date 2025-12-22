const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const http = require("http");
const { Readable } = require("stream");
const libsodium = require("libsodium-wrappers");

const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

http.createServer((req, res) => {
  res.write("Bot is running!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers
  ]
});

client.once("ready", () => {
  console.log(`🤖 Bot online ως ${client.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    // Περιμένουμε την κρυπτογράφηση να είναι έτοιμη
    await libsodium.ready;

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    try {
      const text = `καλωσήρθες ${member.displayName}`;
      const url = googleTTS.getAudioUrl(text, {
        lang: "el",
        slow: false,
        host: "https://translate.google.com"
      });

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const stream = Readable.from(buffer);
      
      const player = createAudioPlayer();
      const resource = createAudioResource(stream);

      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
          if (connection.state.status !== 'destroyed') connection.destroy();
        }, 2000);
      });

      player.on('error', error => {
        console.error(`Audio Error: ${error.message}`);
        if (connection.state.status !== 'destroyed') connection.destroy();
      });

    } catch (err) {
      if (connection.state.status !== 'destroyed') connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
