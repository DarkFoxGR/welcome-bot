require('dotenv').config();
const http = require("http");
const { Client, GatewayIntentBits, Events } = require("discord.js");
const { 
    joinVoiceChannel, 
    createAudioPlayer, 
    createAudioResource, 
    entersState, 
    VoiceConnectionStatus, 
    StreamType
} = require("@discordjs/voice");
const sdk = require("microsoft-cognitiveservices-speech-sdk");
const { PassThrough } = require("stream");

// --- 1. HEALTH CHECK ---
const PORT = process.env.PORT || 8080;
http.createServer((req, res) => {
    res.writeHead(200);
    res.end("Bot is Online");
}).listen(PORT, "0.0.0.0");

// --- 2. CLIENT SETUP ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildVoiceStates, 
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

let isProcessing = false;

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά είναι έτοιμη! Συνδέθηκε ως: ${c.user.tag}`);
});

// --- 3. ΚΥΡΙΑ ΣΥΝΑΡΤΗΣΗ ΟΜΙΛΙΑΣ ---
async function playSpeech(text, voiceChannel) {
  if (isProcessing) return;
  isProcessing = true;

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    await new Promise(resolve => setTimeout(resolve, 800));

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY, 
      process.env.AZURE_REGION || "westeurope"
    );
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR">
        <voice name="el-GR-AthinaNeural">
          <prosody rate="0.85">
            ${text}
          </prosody>
        </voice>
      </speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.audioData) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));

        const player = createAudioPlayer();
        const resource = createAudioResource(bufferStream, { inputType: StreamType.Arbitrary });
        
        connection.subscribe(player);
        player.play(resource);

        player.on('idle', () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            isProcessing = false;
          }, 1500);
          synthesizer.close();
        });
      } else {
        isProcessing = false;
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    isProcessing = false;
  }
}

// --- 4. ΑΥΤΟΜΑΤΟ ΚΑΛΩΣΟΡΙΣΜΑ ΜΕ ΛΕΞΙΚΟ ΚΑΙ ΕΙΔΙΚΑ IDs ---
client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    
    let rawName = newState.member.displayName;
    let nickname = rawName;

    // 1. Σταματάει στην παύλα και κρατάει μόνο το nickname
    if (rawName.includes("-")) {
        nickname = rawName.split("-")[0].trim();
    }

    // 2. Λεξικό Προφοράς
    const pronunciationMap = {
        "Leo_1973_": "Στέλιο",
        "BigBoomer05": "Σίμο",
        "mayoll": "Δημήτρη",
        "jonniesss": "τζόνι",
        "GiorgosTagan": "Γιώργο Τάγκαν",
        "Seaman_Jr": "σήμαν",
        "Terminator_GR_2022": "τερμινέιτορ",
        "jimvw18": "Μήτσο",
        "NTPunk": "Λουλουδά",
        "Little_Master_Yoda": "Σταμάτη",
        "ABSOLUTE_NIGHTMARE": "Γιώργο",
        "gpoly": "γκρινιάρη",
        "THEDARKRIPPER": "Σώτο",
        "tsiftis": "Λευτέρη",
        "Kai_Kailand": "Κώστα",
        "BillKaras": "Μπίλυ",
        "leontios5": "λεόντιε",
        "koulistan": "κουλιστάν",
        "telxinos": "τελχίνε",
        "proud_gio": "πράουτ τζίο",
        "OYZOPOWER": "ούζο πάουερ",
        "MrPitsiou": "Αποστόλη",
        "ALIGATOR_2016_2016": "Στέφανε",
        "THREATY": "Βαγγέλη",
        "AngeloSpil": "Άγγελε",
        "Cpt_ZombZan_GR": "κάπτεν ζόμπι",
        "xxxguardianxxx": "Μάκη",
        "KOYRADOULIS": "κουραδούλι",
        "MONIK_KAPELO": "Χρήστος",
        "i_will_mitsotaki_you": "Νίκο",
        "Stam_warrior": "Σταμάτη",
        "Lindor": "λίντορ",
        "namor7123": "νέιμορ",
        "Cpt_Resar": "κάπτεν ριζάρ",
        "QuantumPhyzStix": "Θοδωρή",
        "ShotgunGun": "Γιάννη",
        "E3ANTAS": "έξαντα",
        "call_me_epifaneio": "επιφάνειο",
        "volkano23": "Γιώργο",
        "Domenicaa": "Κική"
    };

    let finalName = pronunciationMap[nickname] || nickname;

    // 3. Έλεγχος για Ειδικά IDs
    const volkanoID = "374318360017502208";
    const domenicaID = "604718910394073099";

    if (newState.member.id === volkanoID) {
        playSpeech("Χαίρετε κύριε Γιώργο!", newState.channel);
    } 
    else if (newState.member.id === domenicaID) {
        const domenicaPhrases = [
            "Καλώς Ήρθες Κική",
            "Γειά σου Ντομένικα",
            "Εγέρθητω ήρθε η Κική"
        ];
        const randomDom = domenicaPhrases[Math.floor(Math.random() * domenicaPhrases.length)];
        playSpeech(randomDom, newState.channel);
    } 
    else {
        // Γενικά καλωσορίσματα για όλους τους άλλους
        const generalPhrases = [
            `Καλώς Ήρθες στο κανάλι μας, ${finalName}`,
            `Καλησπέρα, ${finalName}`,
            `Σε περιμέναμε, ${finalName}`,
            `Έλα μέσα, ${finalName}`,
            `Καλώς μας ήρθες, ${finalName}`
        ];
        const randomPhrase = generalPhrases[Math.floor(Math.random() * generalPhrases.length)];
        playSpeech(randomPhrase, newState.channel);
    }
  }
});

// --- 5. ΕΝΤΟΛΗ !say ---
client.on("messageCreate", async (message) => {
  if (message.author.bot || !message.content.startsWith("!say ")) return;
  const voiceChannel = message.member.voice.channel;
  if (!voiceChannel) return message.reply("Πρέπει να είσαι σε voice channel!");
  if (isProcessing) return message.reply("Περίμενε λίγο!");

  const textToSay = message.content.slice(5).trim();
  if (textToSay.length > 200) return message.reply("Πολύ μεγάλο μήνυμα!");

  playSpeech(textToSay, voiceChannel);
});

client.login(process.env.DISCORD_TOKEN);


