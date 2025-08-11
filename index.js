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
        case 'nuke':
            try {
                const guildId = message.guild.id;
                console.log(`💥 ULTRA AGRESİF TEMİZLEME BAŞLATIYOR: ${guildId}`);
                
                // 1. Bot'u voice channel'dan zorla ayır
                try {
                    const botMember = message.guild.members.cache.get(client.user.id);
                    if (botMember?.voice?.channel) {
                        await botMember.voice.disconnect();
                        console.log('🔌 Bot voice channel\'dan zorla ayrıldı');
                    }
                } catch (disconnectError) {
                    console.error('Voice disconnect hatası:', disconnectError);
                }
                
                // 2. Voice connection'ı tamamen yok et
                try {
                    const voiceConnection = distube.voices.get(guildId);
                    if (voiceConnection) {
                        if (voiceConnection.connection) {
                            voiceConnection.connection.destroy();
                        }
                        if (voiceConnection.audioPlayer) {
                            voiceConnection.audioPlayer.stop(true);
                        }
                        console.log('💀 Voice connection tamamen yok edildi');
                    }
                } catch (voiceError) {
                    console.error('Voice yok etme hatası:', voiceError);
                }
                
                // 3. DisTube stop (eğer mümkünse)
                try {
                    await distube.stop(message);
                    console.log('⏹️ DisTube stop çalıştırıldı');
                } catch (stopError) {
                    console.error('DisTube stop hatası (normal):', stopError);
                }
                
                // 4. Collection'lardan zorla sil
                try {
                    distube.queues.collection.delete(guildId);
                    distube.voices.collection.delete(guildId);
                    console.log('🗑️ Collection\'lardan zorla silindi');
                } catch (deleteError) {
                    console.error('Collection silme hatası:', deleteError);
                }
                
                // 5. Garbage collection zorla çalıştır
                try {
                    if (global.gc) {
                        global.gc();
                        console.log('🧹 Garbage collection çalıştırıldı');
                    }
                } catch (gcError) {
                    console.error('GC hatası:', gcError);
                }
                
                // 6. 1 saniye bekle ve tekrar temizle
                setTimeout(() => {
                    try {
                        distube.queues.collection.delete(guildId);
                        distube.voices.collection.delete(guildId);
                        console.log('🔄 Gecikmiş temizleme tamamlandı');
                    } catch (delayedError) {
                        console.error('Gecikmiş temizleme hatası:', delayedError);
                    }
                }, 1000);
                
                console.log('💥 ULTRA AGRESİF TEMİZLEME TAMAMLANDI');
                message.reply('💥 **ULTRA TEMİZLEME TAMAMLANDI!**\n🔥 Sistem tamamen nuke edildi!\n⚡ Tüm bağlantılar zorla kesildi!\n🎵 Artık yeni müzik çalabilirsiniz!');
                
            } catch (ultraError) {
                console.error('❌ ULTRA TEMİZLEME HATASI:', ultraError);
                message.reply('💀 **KRİTİK HATA!** Ultra temizleme başarısız! Botu yeniden başlatın!');
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
        case 'komutlar':
            const helpEmbed = new EmbedBuilder()
                .setColor('#FF6B6B')
                .setTitle('🎵 Aşkolik Bot - Ultra Agresif Sistem')
                .setDescription('**Müzik komutları ve ultra güçlü özellikler:**')
                .addFields(
                    { name: '🎵 Temel Komutlar', value: '`!play <şarkı>` - Müzik çal\n`!skip` - Sonraki şarkı\n`!stop` - Müziği durdur\n`!pause` - Duraklat\n`!resume` - Devam ettir', inline: true },
                    { name: '📋 Queue Komutları', value: '`!queue` - Sırayı göster\n`!volume <0-100>` - Ses seviyesi', inline: true },
                    { name: '💥 Ultra Temizleme', value: '`!clear` - Temizle\n`!fix` - Düzelt\n`!destroy` - Yok et\n`!nuke` - Nuke et\n`!reset` - Sıfırla\n`!temizle` - Türkçe temizle', inline: true },
                    { name: '🔧 Sistem', value: '`!status` - Bot durumu\n`!help` - Bu menü', inline: true },
                    { name: '💥 Ultra Agresif Özellikler', value: '• **Ultra Error Handler** - Otomatik queue yok etme\n• **Ultra Periodic Control** - Her 15 saniyede agresif kontrol\n• **Ultra Cleanup Commands** - 6 farklı temizleme komutu\n• **Force Disconnect** - Zorla voice ayrılma\n• **Garbage Collection** - Bellek temizleme', inline: false },
                    { name: '⚡ Teknik Özellikler', value: '• Spotify, SoundCloud, YouTube desteği\n• Yüksek kalite ses (highestaudio)\n• DisTube + yt-dlp kombinasyonu\n• Debian/Linux optimizasyonları\n• Gelişmiş fallback sistemi\n• Otomatik roast sistemi', inline: false }
                )
                .setFooter({ text: 'Aşkolik Bot - Ultra Agresif Müzik Sistemi v2.0' })
                .setTimestamp();
            
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
    .on('error', async (channel, error) => {
        console.error('🚨 DisTube hatası:', error);
        
        try {
            const guildId = channel.guild.id;
            console.log(`💥 ULTRA AGRESİF TEMİZLEME BAŞLATIYOR: ${guildId}`);
            
            // 1. Tüm voice bağlantılarını zorla kes
            try {
                const guild = channel.guild;
                const botMember = guild.members.cache.get(channel.client.user.id);
                if (botMember?.voice?.channel) {
                    await botMember.voice.disconnect();
                    console.log('🔌 Bot voice channel\'dan zorla ayrıldı');
                }
            } catch (disconnectError) {
                console.error('Voice disconnect hatası:', disconnectError);
            }
            
            // 2. DisTube voice manager'dan sil
            try {
                const voiceConnection = distube.voices.get(guildId);
                if (voiceConnection) {
                    if (voiceConnection.connection) {
                        voiceConnection.connection.destroy();
                    }
                    if (voiceConnection.audioPlayer) {
                        voiceConnection.audioPlayer.stop(true);
                    }
                    distube.voices.collection.delete(guildId);
                    console.log('🗑️ Voice connection tamamen yok edildi');
                }
            } catch (voiceError) {
                console.error('Voice yok etme hatası:', voiceError);
            }
            
            // 3. Queue'yu tamamen yok et
            try {
                distube.queues.collection.delete(guildId);
                console.log('💀 Queue collection\'dan tamamen silindi');
            } catch (queueError) {
                console.error('Queue silme hatası:', queueError);
            }
            
            // 4. Garbage collection zorla çalıştır
            try {
                if (global.gc) {
                    global.gc();
                    console.log('🧹 Garbage collection çalıştırıldı');
                }
            } catch (gcError) {
                console.error('GC hatası:', gcError);
            }
            
            // 5. 2 saniye bekle ve tekrar temizle
            setTimeout(() => {
                try {
                    distube.queues.collection.delete(guildId);
                    distube.voices.collection.delete(guildId);
                    console.log('🔄 Gecikmiş temizleme tamamlandı');
                } catch (delayedError) {
                    console.error('Gecikmiş temizleme hatası:', delayedError);
                }
            }, 2000);
            
            console.log('💥 ULTRA AGRESİF TEMİZLEME TAMAMLANDI');
            
            // Kullanıcıya bilgi ver
            channel.send('💥 **ULTRA TEMİZLEME YAPILDI!**\n🔥 Sistem tamamen sıfırlandı!\n⚡ `!destroy` komutuyla manuel temizleme yapabilirsiniz.\n🎵 Yeni müzik çalmayı deneyebilirsiniz.');
            
        } catch (ultraError) {
            console.error('❌ ULTRA AGRESİF TEMİZLEME HATASI:', ultraError);
            channel.send('💀 **KRİTİK HATA!** Botu yeniden başlatın!');
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

// ULTRA AGRESİF Periyodik Queue Kontrolü (her 15 saniyede bir)
setInterval(async () => {
    try {
        console.log('💥 ULTRA AGRESİF QUEUE KONTROLÜ BAŞLATIYOR...');
        
        // Tüm queue'ları kontrol et
        const queuesToDelete = [];
        const voicesToDelete = [];
        
        distube.queues.collection.forEach((queue, guildId) => {
            try {
                // Boş ama hala çalan queue'ları tespit et
                if (queue.songs.length === 0 && (queue.playing || !queue.stopped)) {
                    console.log(`🚨 PROBLEMLI QUEUE TESPİT EDİLDİ: ${guildId}`);
                    queuesToDelete.push(guildId);
                }
                
                // Çok uzun süredir aynı durumda kalan queue'ları tespit et
                if (queue.songs.length === 0 && queue.playing === true && queue.stopped === false) {
                    console.log(`💀 STUCK QUEUE TESPİT EDİLDİ: ${guildId}`);
                    queuesToDelete.push(guildId);
                }
            } catch (queueError) {
                console.error(`Queue kontrol hatası (${guildId}):`, queueError);
                queuesToDelete.push(guildId);
            }
        });
        
        // Orphaned voice connection'ları tespit et
        distube.voices.collection.forEach((voice, guildId) => {
            try {
                const queue = distube.queues.collection.get(guildId);
                if (!queue) {
                    console.log(`🧹 ORPHANED VOICE TESPİT EDİLDİ: ${guildId}`);
                    voicesToDelete.push(guildId);
                }
            } catch (voiceError) {
                console.error(`Voice kontrol hatası (${guildId}):`, voiceError);
                voicesToDelete.push(guildId);
            }
        });
        
        // Problemli queue'ları ultra agresif şekilde temizle
        for (const guildId of queuesToDelete) {
            try {
                console.log(`💥 ULTRA TEMİZLEME: ${guildId}`);
                
                // 1. Bot'u voice channel'dan ayır
                try {
                    const guild = client.guilds.cache.get(guildId);
                    if (guild) {
                        const botMember = guild.members.cache.get(client.user.id);
                        if (botMember?.voice?.channel) {
                            await botMember.voice.disconnect();
                            console.log(`🔌 Bot voice'dan ayrıldı: ${guildId}`);
                        }
                    }
                } catch (disconnectError) {
                    console.error(`Disconnect hatası (${guildId}):`, disconnectError);
                }
                
                // 2. Voice connection'ı yok et
                const voiceConnection = distube.voices.get(guildId);
                if (voiceConnection) {
                    try {
                        if (voiceConnection.connection) {
                            voiceConnection.connection.destroy();
                        }
                        if (voiceConnection.audioPlayer) {
                            voiceConnection.audioPlayer.stop(true);
                        }
                    } catch (voiceError) {
                        console.error(`Voice yok etme hatası (${guildId}):`, voiceError);
                    }
                }
                
                // 3. Collection'lardan sil
                distube.queues.collection.delete(guildId);
                distube.voices.collection.delete(guildId);
                
                console.log(`✅ ULTRA TEMİZLEME TAMAMLANDI: ${guildId}`);
                
            } catch (cleanupError) {
                console.error(`Ultra temizleme hatası (${guildId}):`, cleanupError);
                // Yine de sil
                distube.queues.collection.delete(guildId);
                distube.voices.collection.delete(guildId);
            }
        }
        
        // Orphaned voice'ları temizle
        for (const guildId of voicesToDelete) {
            try {
                const voice = distube.voices.get(guildId);
                if (voice) {
                    if (voice.connection) {
                        voice.connection.destroy();
                    }
                    if (voice.audioPlayer) {
                        voice.audioPlayer.stop(true);
                    }
                }
                distube.voices.collection.delete(guildId);
                console.log(`🧹 Orphaned voice temizlendi: ${guildId}`);
            } catch (voiceError) {
                console.error(`Orphaned voice temizleme hatası (${guildId}):`, voiceError);
                distube.voices.collection.delete(guildId);
            }
        }
        
        // Garbage collection
        try {
            if (global.gc) {
                global.gc();
                console.log('🧹 Garbage collection çalıştırıldı');
            }
        } catch (gcError) {
            console.error('GC hatası:', gcError);
        }
        
        if (queuesToDelete.length > 0 || voicesToDelete.length > 0) {
            console.log(`💥 ULTRA KONTROL TAMAMLANDI - Temizlenen: ${queuesToDelete.length} queue, ${voicesToDelete.length} voice`);
        } else {
            console.log('✅ Ultra kontrol tamamlandı - Temizleme gerekmedi');
        }
        
    } catch (controlError) {
        console.error('❌ ULTRA KONTROL HATASI:', controlError);
    }
}, 15000); // Her 15 saniyede bir

// Bot'u başlat
client.login(process.env.DISCORD_TOKEN);
