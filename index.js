const http = require("http");
http.createServer((req, res) => {
  res.write("Bot is running!");
  res.end();
}).listen(process.env.PORT || 3000);
const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const fetch = require("node-fetch");
const http = require("http"); // Προσθήκη για 24/7

// 1. Δημιουργία ενός mini web server για να μένει ανοιχτό το Render
http.createServer((req, res) => {
  res.write("Bot is running 24/7!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers // Απαραίτητο για τα ονόματα
  ]
});

client.once("ready", () => {
  console.log(`🤖 Bot online ως ${client.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    if (!member || member.user.bot) return;

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    try {
      const text = `Καλωσήρθες ${member.displayName}`;
      const url = googleTTS.getAudioUrl(text, {
        lang: "el",
        slow: false,
        host: "https://translate.google.com"
      });

      const response = await fetch(url);
      const buffer = Buffer.from(await response.arrayBuffer());
      const player = createAudioPlayer();
      const resource = createAudioResource(buffer);

      connection.subscribe(player);
      player.play(resource);

      player.on(AudioPlayerStatus.Idle, () => {
        // Περιμένουμε λίγο πριν αποσυνδεθεί για να μην "καρδιοχτυπάει" το bot
        setTimeout(() => connection.destroy(), 2000);
      });

    } catch (err) {
      console.error("Σφάλμα ήχου:", err);
      connection.destroy();
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

