async function playSpeech(text, voiceChannel) {
  // --- ΤΟ ΚΡΙΣΙΜΟ ΒΗΜΑ ---
  // Περιμένουμε το sodium να αρχικοποιηθεί, αλλιώς πετάει το σφάλμα "No compatible encryption modes"
  await sodium.ready; 
  // -----------------------

  const connection = joinVoiceChannel({
    channelId: voiceChannel.id,
    guildId: voiceChannel.guild.id,
    adapterCreator: voiceChannel.guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  try {
    // Δίνουμε χρόνο στη σύνδεση να σταθεροποιηθεί
    await entersState(connection, VoiceConnectionStatus.Ready, 20000);
    console.log(`🔊 Η κρυπτογράφηση ενεργοποιήθηκε. Σύνδεση στο "${voiceChannel.name}"!`);

    const speechConfig = sdk.SpeechConfig.fromSubscription(process.env.AZURE_SPEECH_KEY, "westeurope");
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const ssml = `<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="el-GR"><voice name="el-GR-AthinaNeural"><prosody rate="0.85">${text}</prosody></voice></speak>`;

    synthesizer.speakSsmlAsync(ssml, result => {
      if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
        const bufferStream = new PassThrough();
        bufferStream.end(Buffer.from(result.audioData));

        const resource = createAudioResource(bufferStream, { inputType: StreamType.Arbitrary });
        const player = createAudioPlayer();
        
        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          setTimeout(() => {
            if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
          }, 2000);
          synthesizer.close();
        });
      }
    });

  } catch (error) {
    console.error("❌ Σφάλμα σύνδεσης:", error.message);
    if (connection.state.status !== VoiceConnectionStatus.Destroyed) connection.destroy();
  }
}
