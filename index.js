const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require('@discordjs/voice');
const { exec } = require('child_process');
const ytSearch = require('youtube-search-api');
const { promisify } = require('util');
const execAsync = promisify(exec);
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// Müzik kuyruğu ve oynatıcı
const musicQueue = new Map();
const playlists = require('./config/playlists');

// ASK Loop sistemi
const askLoopPlayed = new Set();
const askLoopActive = new Map();

// AI Learning sistemi
const songAnalytics = new Map();
const realDurationCache = new Map();

client.once('ready', () => {
    console.log(`🎵 ${client.user.tag} müzik botunuz hazır! (No-Retry AI Version)`);
    client.user.setActivity('🎵 No-Retry AI Bot | Tek Çalma', { type: 'LISTENING' });
    
    realDurationCache.clear();
    songAnalytics.clear();
    console.log('🧠 AI Cache temizlendi - No-Retry Mode başlatıldı');
});

// Süre formatı
function formatDuration(seconds) {
    if (!seconds || seconds <= 0) return 'Bilinmiyor';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// YouTube süresini saniyeye çevir
function parseDurationToSeconds(duration) {
    if (!duration || duration === 'Bilinmiyor') return null;
    
    const parts = duration.split(':');
    if (parts.length === 2) {
        return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    } else if (parts.length === 3) {
        return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
    }
    return null;
}

// Video ID çıkarma
function extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
}

// AI Duration Learning
function updateRealDuration(videoId, actualDuration, expectedDuration) {
    if (!videoId || !actualDuration || !expectedDuration) return;
    
    const completionRate = Math.round((actualDuration / expectedDuration) * 100);
    const existing = realDurationCache.get(videoId);
    
    if (existing) {
        const newAvg = Math.round((existing.realDuration + actualDuration) / 2);
        const newRate = Math.round((existing.completionRate + completionRate) / 2);
        existing.realDuration = newAvg;
        existing.completionRate = newRate;
        existing.playCount++;
        existing.lastUpdated = Date.now();
        console.log(`🧠 AI Süre Güncellendi: ${videoId} → ${newAvg}s (%${newRate})`);
    } else {
        realDurationCache.set(videoId, {
            realDuration: actualDuration,
            expectedDuration: expectedDuration,
            completionRate: completionRate,
            playCount: 1,
            lastUpdated: Date.now()
        });
        console.log(`🧠 AI Yeni Süre Öğrendi: ${videoId} → ${actualDuration}s (%${completionRate})`);
    }
}

// AI süre tahmini
function getAIEstimatedDuration(song) {
    const videoId = extractVideoId(song.url);
    if (videoId && realDurationCache.has(videoId)) {
        const cached = realDurationCache.get(videoId);
        if (cached.completionRate >= 85) {
            console.log(`🧠 AI Cache'den süre: ${cached.realDuration}s`);
            return cached.realDuration;
        }
    }
    
    const ytDuration = parseDurationToSeconds(song.duration);
    if (ytDuration) {
        console.log(`📺 YouTube süresi: ${ytDuration}s`);
        return ytDuration;
    }
    
    return null;
}

// AI completion analizi
function analyzeCompletion(song, playedDuration, expectedDuration) {
    const aiEstimatedDuration = getAIEstimatedDuration(song);
    const finalExpectedDuration = aiEstimatedDuration || expectedDuration;
    
    const analytics = {
        song: song.title,
        expectedDuration: expectedDuration,
        aiEstimatedDuration: aiEstimatedDuration,
        finalExpectedDuration: finalExpectedDuration,
        playedDuration: playedDuration,
        isLikelyComplete: true, // No-retry modda her zaman true
        reason: 'No-retry mod - Tek seferde kabul',
        percentage: finalExpectedDuration ? Math.round((playedDuration / finalExpectedDuration) * 100) : 100,
        confidence: 100
    };

    return analytics;
}

// Mesaj handler
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.content.startsWith('!')) return;

    const args = message.content.slice(1).trim().split(/ +/);
    const command = args.shift().toLowerCase();
    const serverQueue = musicQueue.get(message.guild.id);

    switch (command) {
        case 'askloop':
        case 'ask':
            await handleAskLoop(message, serverQueue);
            break;
        case 'play':
        case 'p':
            if (args.length === 0) {
                return message.reply('🎵 Kullanım: `!play şarkı adı`');
            }
            await handlePlay(message, args.join(' '), serverQueue);
            break;
        case 'stop':
            await handleStop(message, serverQueue);
            break;
        case 'skip':
        case 's':
            await handleSkip(message, serverQueue);
            break;
        case 'ai':
            await handleAIStatus(message);
            break;
        case 'help':
        case 'h':
            await handleHelp(message);
            break;
    }
});

// AI Status komutu
async function handleAIStatus(message) {
    const totalAnalytics = songAnalytics.size;
    if (totalAnalytics === 0) {
        return message.reply('🤖 Henüz AI analiz verisi yok. Birkaç şarkı çaldıktan sonra tekrar deneyin!');
    }

    const recentAnalytics = Array.from(songAnalytics.values()).slice(-10);
    const avgPercentage = Math.round(recentAnalytics.reduce((sum, a) => sum + a.percentage, 0) / recentAnalytics.length);

    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🤖 AI Analiz Raporu')
        .setDescription('**No-Retry AI sistemi çalışıyor!**')
        .addFields([
            { 
                name: '📊 Genel İstatistik', 
                value: `\`\`\`yaml\nToplam Analiz: ${totalAnalytics}\nMod: No-Retry\nBaşarı: %100\`\`\``, 
                inline: false 
            },
            { 
                name: '⏱️ Ortalama Çalma', 
                value: `\`%${avgPercentage}\``, 
                inline: true 
            },
            { 
                name: '🎯 AI Durumu', 
                value: '`🟢 No-Retry Aktif`', 
                inline: true 
            }
        ])
        .setFooter({ 
            text: '🚀 No-Retry AI Music System'
        })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// ASK Loop handler
async function handleAskLoop(message, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.reply('🔊 Ses kanalında değilsin!');
    }

    console.log('🎰 ASK Loop (No-Retry AI) başlatılıyor...');

    if (!askLoopActive.has(message.guild.id)) {
        askLoopPlayed.clear();
        askLoopActive.set(message.guild.id, { 
            isActive: true, 
            startTime: Date.now(),
            songsPlayed: 0,
            totalPlayTime: 0,
            normalCompletions: 0
        });
    }

    // Random şarkı seç
    const availableSongs = playlists.askAcisi.filter(song => !askLoopPlayed.has(song));
    
    if (availableSongs.length === 0) {
        askLoopPlayed.clear();
        console.log('🔄 ASK Loop: Liste sıfırlanıyor...');
        availableSongs.push(...playlists.askAcisi);
    }

    const randomSong = availableSongs[Math.floor(Math.random() * availableSongs.length)];
    askLoopPlayed.add(randomSong);

    try {
        console.log('🧠 AI arama yapılıyor:', randomSong);
        const searchResults = await ytSearch.GetListByKeyword(randomSong + ' official', false, 8);
        
        let bestVideo = searchResults.items?.[0];
        
        const song = {
            title: bestVideo ? bestVideo.title : randomSong,
            url: bestVideo ? `https://www.youtube.com/watch?v=${bestVideo.id}` : `https://www.youtube.com/results?search_query=${encodeURIComponent(randomSong)}`,
            duration: bestVideo ? (bestVideo.length?.simpleText || 'Bilinmiyor') : 'Bilinmiyor',
            thumbnail: bestVideo ? (bestVideo.thumbnail?.thumbnails?.[0]?.url || '') : '',
            requester: message.author,
            isAskLoop: true,
            searchQuery: randomSong
        };

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                player: null,
                songs: [],
                volume: 5,
                playing: true,
                playerListenersSet: false
            };

            musicQueue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.connection = connection;
                queueConstruct.player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: 'pause',
                        maxMissedFrames: Math.floor(5000 / 20)
                    }
                });

                connection.subscribe(queueConstruct.player);
                playSong(message.guild, queueConstruct.songs[0]);
            } catch (err) {
                console.log(err);
                musicQueue.delete(message.guild.id);
                return message.channel.send('❌ Voice channel bağlantı hatası!');
            }
        } else {
            console.log('🎰 ASK Loop - yeni şarkı çalınıyor...');
            serverQueue.songs = [song];
            playSong(message.guild, song);
        }

    } catch (error) {
        console.error('ASK Loop arama hatası:', error);
        message.reply('🚫 ASK Loop arama sırasında hata oluştu!');
    }
}

// Stop handler
async function handleStop(message, serverQueue) {
    if (!serverQueue) return message.reply('🚫 Çalan müzik yok!');
    
    askLoopActive.delete(message.guild.id);
    askLoopPlayed.clear();
    
    if (serverQueue.player) {
        serverQueue.player.stop();
    }
    if (serverQueue.connection) {
        serverQueue.connection.destroy();
    }
    
    musicQueue.delete(message.guild.id);
    message.reply('⏹️ Müzik durduruldu ve ASK Loop kapatıldı!');
}

// Skip handler
async function handleSkip(message, serverQueue) {
    if (!serverQueue) return message.reply('🚫 Çalan müzik yok!');
    
    if (askLoopActive.has(message.guild.id)) {
        message.reply('⏭️ Sonraki şarkıya geçiliyor...');
        handleAskLoop(message, serverQueue);
    } else {
        serverQueue.player.stop();
        message.reply('⏭️ Şarkı geçildi!');
    }
}

// PlaySong fonksiyonu
async function playSong(guild, song) {
    console.log(`🎵 No-Retry AI Şarkı çalınıyor: ${song.title}`);
    
    const serverQueue = musicQueue.get(guild.id);
    if (!song || !serverQueue) return;

    try {
        let audioUrl = null;

        // YT-DLP ile audio URL alma
        try {
            console.log('📻 YT-DLP stream alınıyor...');
            const { stdout } = await execAsync(`yt-dlp -f "bestaudio" --get-url "${song.url}"`);
            audioUrl = stdout.trim();
            console.log('✅ YT-DLP başarılı!');
        } catch (ytdlpError) {
            console.log('❌ YT-DLP başarısız:', ytdlpError.message);
            console.log('❌ Şarkı çalınamadı, yeni şarkı seçiliyor...');
            if (askLoopActive.has(guild.id)) {
                setTimeout(() => {
                    const fakeMessage = createFakeMessage(guild, serverQueue);
                    handleAskLoop(fakeMessage, serverQueue);
                }, 2000);
            }
            return;
        }

        // Audio resource oluştur
        console.log('🎧 Audio resource oluşturuluyor...');
        const resource = createAudioResource(audioUrl, {
            inputType: StreamType.Arbitrary,
            inlineVolume: false
        });

        // Event listener'lar (sadece bir kez)
        if (!serverQueue.playerListenersSet && serverQueue.player) {
            let playStartTime = null;
            let isProcessingEnd = false;

            serverQueue.player.on(AudioPlayerStatus.Idle, () => {
                if (isProcessingEnd) return;
                isProcessingEnd = true;

                const playDurationSeconds = playStartTime ? Math.floor((Date.now() - playStartTime) / 1000) : 0;
                console.log(`🏁 No-Retry AI: Şarkı bitti (${playDurationSeconds}s)`);

                // AI analiz
                const expectedDuration = parseDurationToSeconds(song.duration) || 180;
                const analytics = analyzeCompletion(song, playDurationSeconds, expectedDuration);
                
                songAnalytics.set(Date.now(), analytics);
                
                // AI Learning
                const videoId = extractVideoId(song.url);
                if (videoId) {
                    updateRealDuration(videoId, playDurationSeconds, expectedDuration);
                }

                console.log(`🤖 No-Retry AI: Şarkı kabul edildi (%${analytics.percentage})`);
                
                // ASK Loop stats
                if (askLoopActive.has(guild.id)) {
                    const loopData = askLoopActive.get(guild.id);
                    loopData.songsPlayed++;
                    loopData.totalPlayTime += playDurationSeconds;
                    loopData.normalCompletions++;
                }
                
                // Sonraki şarkı
                if (askLoopActive.has(guild.id)) {
                    console.log('🎰 No-Retry AI: Sonraki şarkıya geçiliyor...');
                    setTimeout(() => {
                        if (askLoopActive.has(guild.id)) {
                            const fakeMessage = createFakeMessage(guild, serverQueue);
                            isProcessingEnd = false;
                            handleAskLoop(fakeMessage, serverQueue);
                        } else {
                            isProcessingEnd = false;
                        }
                    }, 2000);
                } else {
                    isProcessingEnd = false;
                }
            });

            serverQueue.player.on(AudioPlayerStatus.Playing, () => {
                console.log('🎵 No-Retry AI: Şarkı çalmaya başladı!');
                playStartTime = Date.now();
                isProcessingEnd = false;
                
                sendNowPlayingMessage(serverQueue);
            });

            serverQueue.player.on('error', error => {
                console.error('❌ Player hatası:', error);
                isProcessingEnd = false;
            });

            serverQueue.playerListenersSet = true;
        }

        // Çal
        if (serverQueue.player && resource) {
            console.log('▶️ Audio resource çalınıyor...');
            serverQueue.player.play(resource);
        }

    } catch (error) {
        console.error('🚫 PlaySong hatası:', error.message);
        if (askLoopActive.has(guild.id)) {
            setTimeout(() => {
                const fakeMessage = createFakeMessage(guild, serverQueue);
                handleAskLoop(fakeMessage, serverQueue);
            }, 3000);
        }
    }
}

// Fake message helper
function createFakeMessage(guild, serverQueue) {
    return {
        guild: guild,
        member: { voice: { channel: serverQueue.voiceChannel } },
        channel: serverQueue.textChannel,
        author: { displayName: 'No-Retry AI' }
    };
}

// Now playing embed
function sendNowPlayingMessage(serverQueue) {
    if (!serverQueue.songs.length) return;
    
    const song = serverQueue.songs[0];
    const guildId = serverQueue.voiceChannel?.guild?.id;
    
    if (askLoopActive.has(guildId)) {
        const loopData = askLoopActive.get(guildId);
        const totalSongs = playlists.askAcisi.length;
        const playedCount = askLoopPlayed.size;
        const remainingCount = totalSongs - playedCount;
        const progressPercentage = Math.round((playedCount / totalSongs) * 100);
        
        const barLength = 15;
        const filledLength = Math.round((playedCount / totalSongs) * barLength);
        const progressBar = '█'.repeat(filledLength) + '░'.repeat(barLength - filledLength);
        
        const sessionTime = Math.round((Date.now() - loopData.startTime) / 1000 / 60);
        
        const embed = new EmbedBuilder()
            .setColor('#FF1744')
            .setTitle('🚀 AI ASK LOOP | No-Retry Yapay Zeka')
            .setDescription(`> **${song.title}**\n\n🧠 *Tek seferde çalındı - No Retry!*`)
            .addFields([
                { 
                    name: '📊 Loop Durumu', 
                    value: `\`\`\`yaml\nİlerleme: ${progressBar} ${progressPercentage}%\nÇalınan: ${playedCount} şarkı\nKalan  : ${remainingCount} şarkı\nToplam : ${totalSongs} şarkı\`\`\``, 
                    inline: false 
                },
                { 
                    name: '⏰ Şarkı Bilgisi', 
                    value: `\`${song.duration || 'Hesaplanıyor...'}\``, 
                    inline: true 
                },
                { 
                    name: '🎯 Session', 
                    value: `\`${sessionTime}dk\``, 
                    inline: true 
                },
                { 
                    name: '🚀 Mod', 
                    value: `\`No-Retry\``, 
                    inline: true 
                }
            ])
            .setThumbnail(song.thumbnail || null)
            .setFooter({ 
                text: `🚀 No-Retry AI Music • !stop !skip !ai` 
            })
            .setTimestamp();

        serverQueue.textChannel.send({ embeds: [embed] });
    }
}

// Play handler
async function handlePlay(message, query, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.reply('🔊 Ses kanalında değilsin!');
    }

    console.log('🔍 AI Play arama yapılıyor:', query);

    try {
        const searchResults = await ytSearch.GetListByKeyword(query, false, 5);
        
        if (!searchResults.items || searchResults.items.length === 0) {
            return message.reply('🚫 Şarkı bulunamadı!');
        }

        const bestVideo = searchResults.items[0];
        
        const song = {
            title: bestVideo.title,
            url: `https://www.youtube.com/watch?v=${bestVideo.id}`,
            duration: bestVideo.length?.simpleText || 'Bilinmiyor',
            thumbnail: bestVideo.thumbnail?.thumbnails?.[0]?.url || '',
            requester: message.author,
            isAskLoop: false,
            searchQuery: query
        };

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                player: null,
                songs: [],
                volume: 5,
                playing: true,
                playerListenersSet: false
            };

            musicQueue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.connection = connection;
                queueConstruct.player = createAudioPlayer({
                    behaviors: {
                        noSubscriber: 'pause',
                        maxMissedFrames: Math.floor(5000 / 20)
                    }
                });

                connection.subscribe(queueConstruct.player);
                
                // ASK Loop'u durdur
                askLoopActive.delete(message.guild.id);
                
                playSong(message.guild, queueConstruct.songs[0]);
                
                message.reply(`🎵 **${song.title}** çalınıyor! (No-Retry mod)`);
            } catch (err) {
                console.log(err);
                musicQueue.delete(message.guild.id);
                return message.channel.send('❌ Voice channel bağlantı hatası!');
            }
        } else {
            // ASK Loop'u durdur
            askLoopActive.delete(message.guild.id);
            
            serverQueue.songs = [song];
            playSong(message.guild, song);
            message.reply(`🎵 **${song.title}** çalınıyor! (No-Retry mod)`);
        }

    } catch (error) {
        console.error('Play arama hatası:', error);
        message.reply('🚫 Şarkı arama sırasında hata oluştu!');
    }
}

// Help handler
async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#00D4AA')
        .setTitle('🎵 No-Retry AI Bot Komutları')
        .setDescription('**Tüm komutlar ! ile başlar**')
        .addFields([
            { 
                name: '🎵 Müzik Komutları', 
                value: `\`\`\`yaml\n!play <şarkı>  : YouTube'dan şarkı çal\n!askloop      : ASK playlist başlat\n!stop         : Müziği durdur\n!skip         : Şarkıyı geç\`\`\``, 
                inline: false 
            },
            { 
                name: '🤖 AI Komutları', 
                value: `\`\`\`yaml\n!ai           : AI analiz raporu\n!help         : Bu yardım menüsü\`\`\``, 
                inline: false 
            },
            { 
                name: '🚀 Özellikler', 
                value: `• **No-Retry**: Şarkılar sadece bir kez çalınır\n• **AI Learning**: Akıllı şarkı analizi\n• **Modern UI**: Görsel embed mesajları`, 
                inline: false 
            }
        ])
        .setFooter({ 
            text: '🚀 No-Retry AI Music Bot | Made by Kadiroski'
        })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// Discord login
client.login(process.env.DISCORD_TOKEN);
