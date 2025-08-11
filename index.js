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

// DisTube yapılandırması
const distube = new DisTube(client, {
    plugins: [
        new SpotifyPlugin(),
        new SoundCloudPlugin(),
        new YouTubePlugin(),
        new YtDlpPlugin({
            update: false // Linux'ta otomatik güncellemeyi kapat
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
    console.log('🎵 DisTube müzik sistemi aktif!');
    console.log('🔥 Gelişmiş roast sistemi aktif!');
    console.log('🛡️ Linux optimizasyonları aktif!');
    console.log('📋 Fallback sırası: YouTube → Spotify → SoundCloud → yt-dlp');
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
                
                const embed = new EmbedBuilder()
                    .setTitle('🎵 Müzik Kuyruğu')
                    .setColor('#FF6B6B')
                    .setDescription(
                        queue.songs.map((song, index) => 
                            `${index === 0 ? '🎵 **Şu an çalıyor:**' : `${index}.`} [${song.name}](${song.url}) - \`${song.formattedDuration}\``
                        ).slice(0, 10).join('\n')
                    )
                    .setFooter({ text: `Toplam ${queue.songs.length} şarkı` });
                
                message.reply({ embeds: [embed], components: [createMusicButtons()] });
            } catch (error) {
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

        case 'help':
        case 'yardım':
            const helpEmbed = new EmbedBuilder()
                .setTitle('🎵 DisTube Müzik Bot Komutları')
                .setColor('#FF6B6B')
                .addFields(
                    { name: '🎵 Müzik Komutları', value: '`!play <şarkı>` - Şarkı çal\n`!pause` - Duraklat\n`!resume` - Devam et\n`!skip` - Geç\n`!stop` - Durdur\n`!queue` - Kuyruğu göster\n`!volume <0-100>` - Ses seviyesi', inline: true },
                    { name: '🔥 Özellikler', value: '• YouTube, Spotify, SoundCloud desteği\n• Otomatik roast sistemi\n• Buton kontrolleri\n• Linux optimizasyonu\n• Gelişmiş hata yönetimi', inline: true }
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

// DisTube olayları
distube
    .on('playSong', (queue, song) => {
        const embed = new EmbedBuilder()
            .setTitle('🎵 Şu an çalıyor')
            .setDescription(`[${song.name}](${song.url})`)
            .addFields(
                { name: '⏱️ Süre', value: song.formattedDuration, inline: true },
                { name: '👤 İsteyen', value: song.user.toString(), inline: true },
                { name: '📋 Kuyruk', value: `${queue.songs.length} şarkı`, inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setColor('#00FF00')
            .setFooter({ text: 'DisTube - Linux Optimized' });

        queue.textChannel.send({ embeds: [embed], components: [createMusicButtons()] });
    })
    .on('addSong', (queue, song) => {
        const embed = new EmbedBuilder()
            .setTitle('➕ Kuyruğa eklendi')
            .setDescription(`[${song.name}](${song.url})`)
            .addFields(
                { name: '⏱️ Süre', value: song.formattedDuration, inline: true },
                { name: '👤 İsteyen', value: song.user.toString(), inline: true },
                { name: '📍 Sıra', value: `${queue.songs.length}`, inline: true }
            )
            .setThumbnail(song.thumbnail)
            .setColor('#FFD700');

        queue.textChannel.send({ embeds: [embed] });
    })
    .on('error', (channel, error) => {
        console.error('DisTube hatası:', error);
        if (channel) {
            channel.send('❌ Bir hata oluştu! Lütfen tekrar deneyin.');
        }
    })
    .on('empty', queue => {
        queue.textChannel.send('📭 Ses kanalı boş, ayrılıyorum!');
    })
    .on('finish', queue => {
        queue.textChannel.send('🎵 Kuyruk bitti!');
    })
    .on('disconnect', queue => {
        queue.textChannel.send('👋 Ses kanalından ayrıldım!');
    });

// Hata yakalama
process.on('unhandledRejection', error => {
    console.error('Yakalanmamış hata:', error);
});

process.on('uncaughtException', error => {
    console.error('Yakalanmamış istisna:', error);
});

// Bot'u başlat
client.login(process.env.DISCORD_TOKEN);
