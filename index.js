const { Client, GatewayIntentBits } = require("discord.js");
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require("@discordjs/voice");
const googleTTS = require("google-tts-api");
const http = require("http");

// Διόρθωση για το node-fetch σε περιβάλλον CommonJS
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Δημιουργία Web Server για να κρατάει το Render το bot ενεργό
http.createServer((req, res) => {
  res.write("Bot is running!");
  res.end();
}).listen(process.env.PORT || 3000);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers // Απαραίτητο για να βλέπει ποιος μπαίνει στο κανάλι
  ]
});

client.once("ready", () => {
  console.log(`🤖 Bot online ως ${client.user.tag}`);
});

client.on("voiceStateUpdate", async (oldState, newState) => {
  // Έλεγχος αν κάποιος μπήκε σε κανάλι (ενώ πριν δεν ήταν σε κανένα)
  if (!oldState.channelId && newState.channelId) {
    const member = newState.member;
    
    // Αγνοούμε τα άλλα bots
    if (!member || member.user.bot) return;

    console.log(`Προσπάθεια σύνδεσης για τον χρήστη: ${member.displayName}`);

    const connection = joinVoiceChannel({
      channelId: newState.channelId,
      guildId: newState.guild.id,
      adapterCreator: newState.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    try {
      // Δημιουργία ήχου από κείμενο
      const text = `καλωσήρθες ${member.displayName}`;
      const url = googleTTS.getAudioUrl(text, {
        lang: "el",
        slow: false,
        host: "https://translate.google.com"
      });

      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Μετατροπή του Buffer σε Stream για να μην πετάει σφάλμα "chunk"
      const stream = Readable.from(buffer);
      
      const player = createAudioPlayer();
      const resource = createAudioResource(stream); // Χρησιμοποιούμε το stream εδώ

      connection.subscribe(player);
      player.play(resource);

      // Αποσύνδεση αφού τελειώσει η ομιλία
      player.on(AudioPlayerStatus.Idle, () => {
        setTimeout(() => {
            if (connection.state.status !== 'destroyed') {
                connection.destroy();
            }
        }, 2000);
      });

      player.on('error', error => {
        console.error(`Audio Player Error: ${error.message}`);
        connection.destroy();
      });

    } catch (err) {
      console.error("Σφάλμα κατά την αναπαραγωγή ήχου:", err);
      if (connection.state.status !== 'destroyed') {
          connection.destroy();
      }
    }
  }
});

client.login(process.env.DISCORD_TOKEN);

