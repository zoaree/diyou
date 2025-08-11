const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { DisTube } = require('distube');
const { YtDlpPlugin } = require('@distube/yt-dlp');
const { SpotifyPlugin } = require('@distube/spotify');
const { SoundCloudPlugin } = require('@distube/soundcloud');
const { YouTubePlugin } = require('@distube/youtube');
require('dotenv').config();

// Bot istemcisi oluştur
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// DisTube yapılandırması - Optimize edilmiş yt-dlp kombinasyonu
const distube = new DisTube(client, {
    plugins: [
        // Spotify desteği
        new SpotifyPlugin(),
        // SoundCloud desteği
        new SoundCloudPlugin(),
        // YouTube desteği
        new YouTubePlugin({
            cookies: [], // Cookie desteği
            ytdlOptions: {
                quality: 'highestaudio',
                filter: 'audioonly',
                highWaterMark: 1 << 25, // 32MB buffer
                requestOptions: {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    }
                }
            }
        }),
        // yt-dlp'yi son sıraya al (önerilen)
        new YtDlpPlugin({
            update: false, // Linux'ta otomatik güncellemeyi kapat
            quality: 'highestaudio/best', // En iyi ses kalitesi
            filter: 'audioonly' // Sadece ses indir
        })
    ]
});

// Roast mesajları
const roastMessages = [
    "Bu şarkı senin müzik zevkin kadar berbat! 🎵💀",
    "Kulakların çınlasın diye mi bu şarkıyı seçtin? 🔊😵",
    "Bu şarkı benim ses kartımı bozacak! 🎧💥",
    "Spotify'da bu şarkıyı dinleyenler utanıyor! 🎶😳",
    "Bu şarkı kadar kötü bir şey daha duymadım! 🎵🤮",
    "Müzik zevkin çöp tenekesi gibi! 🗑️🎵",
    "Bu şarkı beni depresyona soktu! 😭🎶",
    "Komşular şikayet edecek bu şarkıdan! 🏠🔊",
    "Bu şarkı ile dans eden ayılar bile kaçar! 🐻💃",
    "Kulaklarım kanıyor bu şarkıdan! 👂🩸"
];

// Buton oluşturma fonksiyonu
function createMusicButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('pause')
                .setLabel('⏸️ Duraklat')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('resume')
                .setLabel('▶️ Devam')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('skip')
                .setLabel('⏭️ Geç')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('stop')
                .setLabel('⏹️ Durdur')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('queue')
                .setLabel('📋 Kuyruk')
                .setStyle(ButtonStyle.Secondary)
        );
}

// Bot hazır olduğunda
client.once('ready', () => {
    console.log(`🤖 ${client.user.tag} aktif!`);
    console.log('🎵 DisTube + yt-dlp kombinasyonu aktif!');
    console.log('🔥 Gelişmiş roast sistemi aktif!');
    console.log('🛡️ Debian/Linux optimizasyonları aktif!');
    console.log('📋 Öncelik sırası: Spotify → SoundCloud → YouTube → yt-dlp (önerilen)');
    console.log('🎧 Ses kalitesi: Yüksek (highestaudio/best)');
    console.log('🚫 youtube-dl devre dışı (sadece yt-dlp kullanılıyor)');
    console.log('⚡ Gelişmiş hata yönetimi ve fallback sistemi aktif!');
});

// Mesaj komutları
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Ses kanalı kontrolü
    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel && ['play', 'p', 'çal'].includes(command)) {
        return message.reply('❌ Önce bir ses kanalına katılmalısın!');
    }

    switch (command) {
        case 'play':
        case 'p':
        case 'çal':
            if (!args.length) {
                return message.reply('❌ Bir şarkı adı veya URL belirt!\nÖrnek: `!play Tarkan Şımarık`');
            }
            
            try {
                const query = args.join(' ');
                await distube.play(voiceChannel, query, {
                    textChannel: message.channel,
                    member: message.member
                });
                
                // Roast mesajı gönder
                const randomRoast = roastMessages[Math.floor(Math.random() * roastMessages.length)];
                setTimeout(() => {
                    message.channel.send(`🔥 **ROAST:** ${randomRoast}`);
                }, 2000);
                
            } catch (error) {
                console.error('Çalma hatası:', error);
                message.reply('❌ Şarkı çalarken bir hata oluştu!');
            }
            break;

        case 'pause':
        case 'duraklat':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) return message.reply('❌ Çalan şarkı yok!');
                
                distube.pause(message.guild);
                message.reply('⏸️ Şarkı duraklatıldı!');
            } catch (error) {
                message.reply('❌ Duraklatma hatası!');
            }
            break;

        case 'resume':
        case 'devam':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) return message.reply('❌ Çalan şarkı yok!');
                
                distube.resume(message.guild);
                message.reply('▶️ Şarkı devam ediyor!');
            } catch (error) {
                message.reply('❌ Devam ettirme hatası!');
            }
            break;

        case 'skip':
        case 'geç':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) return message.reply('❌ Çalan şarkı yok!');
                
                distube.skip(message.guild);
                message.reply('⏭️ Şarkı geçildi!');
            } catch (error) {
                message.reply('❌ Geçme hatası!');
            }
            break;

        case 'stop':
        case 'durdur':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) return message.reply('❌ Çalan şarkı yok!');
                
                distube.stop(message.guild);
                message.reply('⏹️ Müzik durduruldu ve kuyruk temizlendi!');
            } catch (error) {
                message.reply('❌ Durdurma hatası!');
            }
            break;

        case 'queue':
        case 'kuyruk':
        case 'q':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) return message.reply('❌ Kuyruk boş!');
                
                // Queue durumunu kontrol et
                if (queue.songs.length === 0) {
                    if (queue.playing) {
                        console.log('🔧 Boş queue ama playing=true, düzeltiliyor...');
                        distube.stop(message.guild);
                    }
                    return message.reply('❌ Kuyrukta şarkı yok!');
                }
                
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Müzik Kuyruğu')
                    .setColor('#FF6B6B')
                    .setDescription(
                        queue.songs.map((song, index) => 
                            `${index === 0 ? '🎵 **Şu an çalıyor:**' : `${index}.`} [${song.name}](${song.url}) - \`${song.formattedDuration}\``
                        ).slice(0, 10).join('\n')
                    )
                    .setFooter({ text: `Toplam ${queue.songs.length} şarkı | Durum: ${queue.playing ? 'Çalıyor' : 'Durduruldu'}` });
                
                message.reply({ embeds: [embed], components: [createMusicButtons()] });
            } catch (error) {
                console.error('Queue hatası:', error);
                message.reply('❌ Kuyruk gösterme hatası!');
            }
            break;

        case 'volume':
        case 'ses':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) return message.reply('❌ Çalan şarkı yok!');
                
                const volume = parseInt(args[0]);
                if (isNaN(volume) || volume < 0 || volume > 100) {
                    return message.reply('❌ Ses seviyesi 0-100 arasında olmalı!');
                }
                
                distube.setVolume(message.guild, volume);
                message.reply(`🔊 Ses seviyesi ${volume}% olarak ayarlandı!`);
            } catch (error) {
                message.reply('❌ Ses ayarlama hatası!');
            }
            break;

        case 'clear':
        case 'temizle':
        case 'reset':
        case 'fix':
        case 'destroy':
            try {
                const guildId = message.guild.id;
                console.log(`🔥 Agresif manuel temizleme başlatılıyor: ${guildId}`);
                
                // Voice connection'ı zorla kapat
                const voiceConnection = distube.voices.get(guildId);
                if (voiceConnection) {
                    try {
                        if (voiceConnection.connection) {
                            voiceConnection.connection.destroy();
                        }
                        voiceConnection.audioPlayer.stop(true);
                        console.log('🔌 Voice connection zorla kapatıldı');
                    } catch (voiceError) {
                        console.error('Voice kapatma hatası:', voiceError);
                    }
                }
                
                // Queue'yu collection'dan tamamen sil
                try {
                    distube.queues.collection.delete(guildId);
                    distube.voices.collection.delete(guildId);
                    console.log('🗑️ Queue ve Voice collection\'dan silindi');
                } catch (deleteError) {
                    console.error('Collection silme hatası:', deleteError);
                }
                
                // Guild'deki tüm voice state'leri temizle
                try {
                    const guild = message.guild;
                    const botMember = guild.members.cache.get(message.client.user.id);
                    if (botMember && botMember.voice.channel) {
                        await botMember.voice.disconnect();
                        console.log('🔇 Bot voice channel\'dan ayrıldı');
                    }
                } catch (disconnectError) {
                    console.error('Voice disconnect hatası:', disconnectError);
                }
                
                console.log('✅ Agresif manuel temizleme tamamlandı');
                message.reply('🔥 Sistem tamamen yok edildi ve sıfırlandı! Artık yeni müzik çalabilirsiniz.');
                
            } catch (error) {
                console.error('Agresif temizleme hatası:', error);
                message.reply('❌ Kritik temizleme hatası! Botu yeniden başlatın.');
            }
            break;

        case 'status':
        case 'durum':
            try {
                const queue = distube.getQueue(message.guild);
                if (!queue) {
                    return message.reply('❌ Aktif queue yok!');
                }
                
                const statusEmbed = new EmbedBuilder()
                    .setTitle('📊 Bot Durumu')
                    .setColor('#00FF00')
                    .addFields(
                        { name: '🎵 Çalan Şarkı', value: queue.songs[0] ? queue.songs[0].name : 'Yok', inline: true },
                        { name: '📋 Kuyruk', value: `${queue.songs.length} şarkı`, inline: true },
                        { name: '▶️ Durum', value: queue.playing ? 'Çalıyor' : 'Durduruldu', inline: true },
                        { name: '⏸️ Duraklama', value: queue.paused ? 'Evet' : 'Hayır', inline: true },
                        { name: '🔊 Ses', value: `${queue.volume}%`, inline: true },
                        { name: '🔄 Tekrar', value: queue.repeatMode === 0 ? 'Kapalı' : queue.repeatMode === 1 ? 'Şarkı' : 'Liste', inline: true }
                    )
                    .setFooter({ text: `Queue ID: ${queue.id}` });
                
                message.reply({ embeds: [statusEmbed] });
            } catch (error) {
                console.error('Durum kontrol hatası:', error);
                message.reply('❌ Durum kontrol hatası!');
            }
            break;

        case 'help':
        case 'yardım':
            const helpEmbed = new EmbedBuilder()
                .setTitle('🎵 DisTube Müzik Bot Komutları')
                .setColor('#FF6B6B')
                .addFields(
                    { name: '🎵 Müzik Komutları', value: '`!play <şarkı>` - Şarkı çal\n`!pause` - Duraklat\n`!resume` - Devam et\n`!skip` - Geç\n`!stop` - Durdur\n`!queue` - Kuyruğu göster\n`!volume <0-100>` - Ses seviyesi', inline: true },
                    { name: '🔧 Sistem Komutları', value: '`!clear` / `!fix` / `!destroy` - Agresif temizleme\n`!status` - Bot durumu\n`!help` - Bu yardım menüsü', inline: true },
                    { name: '🔥 Özellikler', value: '• YouTube, Spotify, SoundCloud desteği\n• Otomatik roast sistemi\n• Agresif queue temizleme (20s)\n• Linux optimizasyonu\n• Gelişmiş hata yönetimi', inline: true }
                )
                .setFooter({ text: 'DisTube v5.0.7 - Linux Optimized' });
            
            message.reply({ embeds: [helpEmbed] });
            break;
    }
});

// Buton etkileşimleri
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isButton()) return;

    const queue = distube.getQueue(interaction.guild);
    if (!queue) {
        return interaction.reply({ content: '❌ Çalan şarkı yok!', ephemeral: true });
    }

    try {
        switch (interaction.customId) {
            case 'pause':
                distube.pause(interaction.guild);
                await interaction.reply({ content: '⏸️ Şarkı duraklatıldı!', ephemeral: true });
                break;
            case 'resume':
                distube.resume(interaction.guild);
                await interaction.reply({ content: '▶️ Şarkı devam ediyor!', ephemeral: true });
                break;
            case 'skip':
                distube.skip(interaction.guild);
                await interaction.reply({ content: '⏭️ Şarkı geçildi!', ephemeral: true });
                break;
            case 'stop':
                distube.stop(interaction.guild);
                await interaction.reply({ content: '⏹️ Müzik durduruldu!', ephemeral: true });
                break;
            case 'queue':
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Müzik Kuyruğu')
                    .setColor('#FF6B6B')
                    .setDescription(
                        queue.songs.map((song, index) => 
                            `${index === 0 ? '🎵 **Şu an çalıyor:**' : `${index}.`} [${song.name}](${song.url}) - \`${song.formattedDuration}\``
                        ).slice(0, 10).join('\n')
                    )
                    .setFooter({ text: `Toplam ${queue.songs.length} şarkı` });
                
                await interaction.reply({ embeds: [embed], ephemeral: true });
                break;
        }
    } catch (error) {
        console.error('Buton hatası:', error);
        await interaction.reply({ content: '❌ İşlem sırasında hata oluştu!', ephemeral: true });
    }
});

// DisTube olayları - Optimize edilmiş yt-dlp kombinasyonu
distube
    .on('playSong', (queue, song) => {
        const embed = new EmbedBuilder()
            .setTitle('🎵 Şu an çalıyor')
            .setDescription(`[${song.name}](${song.url})`)
            .addFields(
                { name: '⏱️ Süre', value: song.formattedDuration, inline: true },
                { name: '👤 İsteyen', value: song.user.toString(), inline: true },
                { name: '📋 Kuyruk', value: `${queue.songs.length} şarkı`, inline: true },
                { name: '🔧 Kaynak', value: song.source || 'yt-dlp', inline: true },
                { name: '🎧 Kalite', value: 'Yüksek Ses', inline: true },
                { name: '🛡️ Sistem', value: 'Linux Optimized', inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setColor('#00FF00')
            .setFooter({ text: 'DisTube + yt-dlp - Debian Optimized' });

        queue.textChannel.send({ embeds: [embed], components: [createMusicButtons()] });
    })
    .on('addSong', (queue, song) => {
        const embed = new EmbedBuilder()
            .setTitle('➕ Kuyruğa eklendi')
            .setDescription(`[${song.name}](${song.url})`)
            .addFields(
                { name: '⏱️ Süre', value: song.formattedDuration, inline: true },
                { name: '👤 İsteyen', value: song.user.toString(), inline: true },
                { name: '📍 Sıra', value: `${queue.songs.length}`, inline: true },
                { name: '🔧 Kaynak', value: song.source || 'yt-dlp', inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setColor('#FFD700');

        queue.textChannel.send({ embeds: [embed] });
    })
    .on('error', (channel, error) => {
        console.error('🚨 DisTube hatası:', error);
        
        // Agresif queue temizleme
        try {
            const guildId = channel.guild.id;
            console.log(`🔥 Agresif queue temizleme başlatılıyor: ${guildId}`);
            
            // Tüm voice connection'ları kapat
            const voiceConnection = distube.voices.get(guildId);
            if (voiceConnection) {
                try {
                    if (voiceConnection.connection) {
                        voiceConnection.connection.destroy();
                    }
                    voiceConnection.audioPlayer.stop(true);
                    console.log('🔌 Voice connection zorla kapatıldı');
                } catch (voiceError) {
                    console.error('Voice kapatma hatası:', voiceError);
                }
            }
            
            // Queue'yu tamamen yok et
            try {
                const queue = distube.getQueue(channel.guild);
                if (queue) {
                    // Queue'yu collection'dan sil
                    distube.queues.collection.delete(guildId);
                    console.log('🗑️ Queue collection\'dan silindi');
                }
            } catch (deleteError) {
                console.error('Queue silme hatası:', deleteError);
            }
            
            // Voice'u da sil
            try {
                distube.voices.collection.delete(guildId);
                console.log('🔇 Voice collection\'dan silindi');
            } catch (voiceDeleteError) {
                console.error('Voice silme hatası:', voiceDeleteError);
            }
            
            console.log('✅ Agresif temizleme tamamlandı');
            
        } catch (aggressiveError) {
            console.error('❌ Agresif temizleme hatası:', aggressiveError);
        }
        
        // Hata mesajları
        if (error.message?.includes('410')) {
            channel.send('❌ YouTube 410 hatası! Video mevcut değil. Sistem temizlendi.');
        } else if (error.message?.includes('Access denied')) {
            channel.send('❌ Erişim reddedildi! Video özel veya kısıtlı. Sistem temizlendi.');
        } else if (error.message?.includes('Video unavailable')) {
            channel.send('❌ Video mevcut değil! Sistem temizlendi.');
        } else if (error.message?.includes('stream') || error.message?.includes('Stream')) {
            channel.send('❌ Stream hatası! Sistem tamamen temizlendi, yeniden deneyin.');
        } else if (error.message?.includes('queue') || error.message?.includes('Queue')) {
            channel.send('❌ Queue hatası! Sistem tamamen sıfırlandı, yeniden deneyin.');
        } else {
            channel.send('❌ Kritik hata! Sistem tamamen temizlendi, yeniden deneyin.');
        }
    })
    .on('empty', queue => {
        queue.textChannel.send('📭 Ses kanalı boş, 60 saniye sonra ayrılıyorum!');
    })
    .on('finish', queue => {
        queue.textChannel.send('🎵 Kuyruk bitti! Yeni şarkılar ekleyebilirsiniz.');
    })
    .on('disconnect', queue => {
        queue.textChannel.send('👋 Ses kanalından ayrıldım! Tekrar görüşmek üzere!');
    })
    .on('initQueue', queue => {
        queue.autoplay = false; // Otomatik çalmayı kapat
        queue.volume = 50; // Varsayılan ses seviyesi
        console.log(`🎵 Yeni kuyruk oluşturuldu: ${queue.id}`);
    })
    .on('noRelated', queue => {
        queue.textChannel.send('🔍 İlgili şarkı bulunamadı!');
    })
    .on('searchNoResult', (message, query) => {
        message.channel.send(`🔍 "${query}" için sonuç bulunamadı! Farklı anahtar kelimeler deneyin.`);
    })
    .on('searchResult', (message, result) => {
        console.log(`🔍 Arama sonucu: ${result.length} şarkı bulundu`);
    });

// Hata yakalama
process.on('unhandledRejection', error => {
    console.error('Yakalanmamış hata:', error);
});

process.on('uncaughtException', error => {
    console.error('Yakalanmamış istisna:', error);
});

// Periyodik agresif queue kontrolü (her 20 saniyede bir)
setInterval(() => {
    try {
        const queues = distube.queues.collection;
        const voices = distube.voices.collection;
        
        queues.forEach((queue, guildId) => {
            // Boş queue ama çalıyor durumunu kontrol et
            if (queue.songs.length === 0 && (queue.playing || !queue.stopped)) {
                console.log(`🔥 [${guildId}] Periyodik kontrol: Boş queue tespit edildi, agresif temizleme başlatılıyor...`);
                
                try {
                    // Voice connection'ı zorla kapat
                    const voiceConnection = voices.get(guildId);
                    if (voiceConnection) {
                        try {
                            if (voiceConnection.connection) {
                                voiceConnection.connection.destroy();
                            }
                            voiceConnection.audioPlayer.stop(true);
                            console.log(`🔌 [${guildId}] Voice connection zorla kapatıldı`);
                        } catch (voiceError) {
                            console.error(`Voice kapatma hatası [${guildId}]:`, voiceError);
                        }
                    }
                    
                    // Queue'yu collection'dan tamamen sil
                    queues.delete(guildId);
                    voices.delete(guildId);
                    
                    console.log(`🗑️ [${guildId}] Queue ve Voice tamamen silindi`);
                    
                } catch (aggressiveError) {
                    console.error(`❌ [${guildId}] Agresif temizleme hatası:`, aggressiveError);
                }
            }
        });
        
        // Orphaned voice connections'ları da temizle
        voices.forEach((voice, guildId) => {
            if (!queues.has(guildId)) {
                console.log(`🧹 [${guildId}] Orphaned voice connection temizleniyor...`);
                try {
                    if (voice.connection) {
                        voice.connection.destroy();
                    }
                    voice.audioPlayer.stop(true);
                    voices.delete(guildId);
                    console.log(`✅ [${guildId}] Orphaned voice temizlendi`);
                } catch (orphanError) {
                    console.error(`❌ [${guildId}] Orphaned voice temizleme hatası:`, orphanError);
                }
            }
        });
        
    } catch (intervalError) {
        console.error('Periyodik kontrol hatası:', intervalError);
    }
}, 20000); // 20 saniye

// Bot'u başlat
client.login(process.env.DISCORD_TOKEN);
