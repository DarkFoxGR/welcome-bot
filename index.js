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

// Μεταβλητή για να μην μιλάει πάνω στον εαυτό της
let isProcessing = false;

client.once(Events.ClientReady, (c) => {
    console.log(`✅ Η Αθηνά είναι έτοιμη! Συνδέθηκε ως: ${c.user.tag}`);
});

// --- 3. ΚΥΡΙΑ ΣΥΝΑΡΤΗΣΗ ΟΜΙΛΙΑΣ (TURBO MODE) ---
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
    // Ετοιμάζουμε το Azure ΑΜΕΣΩΣ
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.AZURE_SPEECH_KEY, 
      process.env.AZURE_REGION || "westeurope"
    );
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    
    // SSML με υποστήριξη Αγγλικών και Γρήγορη Ταχύτητα
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="http://www.w3.org/2001/mstts" xml:lang="el-GR">
        <voice name="el-GR-AthinaNeural">
          <lang xml:lang="en-US">
            <prosody rate="0.95"> 
              ${text}
            </prosody>
          </lang>
        </voice>
      </speak>`;

    synthesizer.speakSsmlAsync(ssml, async result => {
      if (result.audioData) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));

        const player = createAudioPlayer();
        const resource = createAudioResource(bufferStream, { inputType: StreamType.Arbitrary });

        try {
            // Περιμένουμε ελάχιστα να κλειδώσει η σύνδεση
            await entersState(connection, VoiceConnectionStatus.Ready, 5000);
            connection.subscribe(player);
            player.play(resource);
        } catch (err) {
            console.log("Η σύνδεση άργησε πολύ, ακύρωση.");
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            isProcessing = false;
        }

        player.on('idle', () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
            isProcessing = false;
          }, 500); // Φεύγει γρήγορα (μισό δευτερόλεπτο)
          synthesizer.close();
        });
      } else {
        isProcessing = false;
        synthesizer.close();
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
    isProcessing = false;
  }
}

// --- 4. ΑΥΤΟΜΑΤΟ ΚΑΛΩΣΟΡΙΣΜΑ (ΜΕ SPAM PROTECTION & ΝΕΑ ΟΝΟΜΑΤΑ) ---

// Λίστα για το Cooldown
const lastWelcomed = new Map();
const COOLDOWN_TIME = 5 * 60 * 1000; // 5 Λεπτά

client.on("voiceStateUpdate", (oldState, newState) => {
  if (!oldState.channelId && newState.channelId && !newState.member.user.bot) {
    
    const userId = newState.member.id;
    const now = Date.now();

    // Έλεγχος Spam (5 λεπτά)
    if (lastWelcomed.has(userId)) {
        const lastTime = lastWelcomed.get(userId);
        if (now - lastTime < COOLDOWN_TIME) {
            console.log(`🔇 Παράκαμψη για ${newState.member.displayName} (Spam Protection)`);
            return; 
        }
    }
    lastWelcomed.set(userId, now);

    // Επεξεργασία Ονόματος
    let rawName = newState.member.displayName;
    let nickname = rawName;

    // 1. Σταματάει στην παύλα
    if (rawName.includes("-")) {
        nickname = rawName.split("-")[0].trim();
    }

    // 2. Νέο Λεξικό Προφοράς (ΕΝΗΜΕΡΩΜΕΝΟ)
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
        "padreimor": "παντρέιμορ", // Το άφησα γιατί υπήρχε στην παλιά λίστα, αν θες σβήστο
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
        // Ειδικό για Volkano
        playSpeech("Χαίρετε κύριε Γιώργο!", newState.channel);
    } 
    else if (newState.member.id === domenicaID) {
        // Ειδικό για Domenica
        const domenicaPhrases = [
            "Καλώς Ήρθες Κική",
            "Γειά σου Ντομένικα",
            "Εγέρθητω ήρθε η Κική"
        ];
        const randomDom = domenicaPhrases[Math.floor(Math.random() * domenicaPhrases.length)];
        playSpeech(randomDom, newState.channel);
    } 
    else {
        // Γενικά καλωσορίσματα
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
