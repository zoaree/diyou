const { Client, GatewayIntentBits, EmbedBuilder, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType, entersState, VoiceConnectionStatus } = require('@discordjs/voice');
const { exec, spawn } = require('child_process');
const ytSearch = require('youtube-search-api');
const playdl = require('play-dl');
const { promisify } = require('util');
const execAsync = promisify(exec);
const axios = require('axios');
const ytdl = require('ytdl-core');
require('dotenv').config();

// Config files
const playlists = require('./config/playlists');
const roastMessages = require('./config/roast-messages');
const megaRoastMessages = require('./config/mega-roast-messages');
const handlers = require('./handlers');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates
    ]
});

// State management
const musicQueue = new Map();
const askLoopPlayed = new Set();
const askLoopActive = new Map();
const songAnalytics = new Map();
const realDurationCache = new Map();
const nsfwEnabled = new Map(); // guild -> boolean
const userStats = new Map(); // user -> {commandsUsed, favoriteCommand}

client.once('ready', () => {
    console.log(`🤖 Bot hazır! ${client.user.tag} olarak giriş yapıldı`);
    console.log('🔥 Gelişmiş Stream Sistemi aktif!');
    console.log('🧠 No-Retry AI Modu çalışıyor!');
    console.log('🧹 AI Cache temizlendi');
});

// Utility functions
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function parseDurationToSeconds(duration) {
    if (!duration || duration === 'Bilinmiyor') return 0;
    const parts = duration.split(':').map(p => parseInt(p, 10));
    if (parts.length === 2) {
        return parts[0] * 60 + parts[1];
    } else if (parts.length === 3) {
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 0;
}

function extractVideoId(url) {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?#]+)/);
    return match ? match[1] : null;
}

function updateRealDuration(videoId, actualDuration, expectedDuration) {
    if (!videoId || actualDuration < 5) return;
    
    const key = `duration_${videoId}`;
    const cached = realDurationCache.get(key);
    
    if (cached && Math.abs(cached.duration - actualDuration) < 3) {
        cached.confidence = Math.min(100, cached.confidence + 10);
        cached.lastUpdated = Date.now();
        return;
    }
    
    realDurationCache.set(key, {
        videoId,
        duration: actualDuration,
        expectedDuration,
        confidence: 40,
        accuracy: expectedDuration ? Math.round((actualDuration / expectedDuration) * 100) : 100,
        lastUpdated: Date.now()
    });
    
    if (realDurationCache.size > 1000) {
        const oldestEntries = Array.from(realDurationCache.entries())
            .sort((a, b) => a[1].lastUpdated - b[1].lastUpdated)
            .slice(0, 200);
        oldestEntries.forEach(([key]) => {
            realDurationCache.delete(key);
        });
    }
}

function getAIEstimatedDuration(song) {
    const videoId = extractVideoId(song.url);
    if (!videoId) return 0;
    
    const key = `duration_${videoId}`;
    const cached = realDurationCache.get(key);
    
    if (cached && cached.confidence > 60) {
        return cached.duration;
    }
    
    return parseDurationToSeconds(song.duration);
}

function analyzeCompletion(song, playedDuration, expectedDuration) {
    const finalExpectedDuration = getAIEstimatedDuration(song) || expectedDuration || playedDuration;
    
    const analytics = {
        song: song.title || 'Bilinmiyor',
        videoId: extractVideoId(song.url),
        playedDuration,
        expectedDuration: finalExpectedDuration,
        mode: 'No-Retry',
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
        case 'test':
            if (args.length === 0) {
                return message.reply('🧪 Kullanım: `!test şarkı adı` - Audio test için');
            }
            await handleTestSong(message, args.join(' '), serverQueue);
            break;
        // Eğlence komutları
        case 'meme':
            await handleMeme(message, args);
            break;
        case 'patlat': // rastgele diss/roast (SFW versiyon)
            await handlePatlat(message, args);
            break;
        case 'yazitura':
        case 'coin':
            await handleYaziTura(message);
            break;
        case 'kufur': // sansürlü, SFW küfür
            await handleKufur(message, args);
            break;
        case 'dogruluk':
            await handleDogruluk(message);
            break;
        case 'yalan':
            await handleYalan(message);
            break;
        case 'lovecalc':
        case 'askorani':
            await handleLoveCalc(message, args);
            break;
        case 'emoji':
            await handleEmojiMix(message, args);
            break;
        case 'zar':
        case 'dice':
            await handleZar(message, args);
            break;
        case 'espri':
            await handleEspri(message);
            break;
        case 'sarki': // eğlence: playlistten rastgele isim öner
            await handleSarkiOner(message);
            break;
        // Gelişmiş oyun komutları
        case 'oyunkesfet':
        case 'oyunara':
            await handlers.handleOyunKesfet(message, args);
            break;
        case 'oyunpuan':
        case 'gamerating':
            await handlers.handleOyunPuan(message, args);
            break;
        case 'oyuntur':
        case 'gamegenre':
            await handlers.handleOyunTur(message, args);
            break;
        // Gelişmiş müzik komutları
        case 'queue':
        case 'kuyruk':
            await handlers.handleMusicQueue(message, serverQueue);
            break;
        case 'shuffle':
        case 'karistir':
            await handlers.handleShuffle(message, serverQueue);
            break;
        case 'repeat':
        case 'tekrar':
            await handlers.handleRepeat(message, serverQueue);
            break;
        case 'volume':
        case 'ses':
            await handlers.handleVolume(message, args, serverQueue);
            break;
        case 'nowplaying':
        case 'np':
            await handlers.handleNowPlaying(message, serverQueue);
            break;
        // Yeni görsel kategorileri
        case 'panda':
            await handlers.handleAnimalPic(message, 'panda');
            break;
        case 'fox':
        case 'tilki':
            await handlers.handleAnimalPic(message, 'fox');
            break;
        case 'bird':
        case 'kus':
            await handlers.handleAnimalPic(message, 'bird');
            break;
        case 'space':
        case 'uzay':
            await handlers.handleSpacePic(message);
            break;
        case 'nature':
        case 'doga':
            await handlers.handleNaturePic(message);
            break;
        case 'anime':
            await handleWaifuCategory(message, 'waifu');
            break;
        case 'manga':
            await handlers.handleMangaPic(message);
            break;
        // NSFW/Roast komutları
        case 'nsfwtoggle':
            if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                return message.reply('Bu komutu sadece yöneticiler kullanabilir.');
            }
            const current = nsfwEnabled.get(message.guild.id) || false;
            nsfwEnabled.set(message.guild.id, !current);
            return message.reply(`NSFW modu: ${!current ? 'AÇIK' : 'KAPALI'}`);
        case 'roast':
            const targetUser = args.join(' ') || message.member.displayName;
            const allowNSFW = nsfwEnabled.get(message.guild.id) === true;
            const pool = allowNSFW ? [...roastMessages, ...megaRoastMessages.messages] : roastMessages.filter(m => !/\b(orospu|sik|am|göt|kahpe|pezevenk)\b/i.test(m));
            const pick = pool[Math.floor(Math.random()*pool.length)];
            const line = pick.replace('{user}', targetUser);
            return message.reply(line);
        case 'roastme':
            const allowNSFWMe = nsfwEnabled.get(message.guild.id) === true;
            const poolMe = allowNSFWMe ? [...roastMessages, ...megaRoastMessages.messages] : roastMessages.filter(m => !/\b(orospu|sik|am|göt|kahpe|pezevenk)\b/i.test(m));
            const pickMe = poolMe[Math.floor(Math.random()*poolMe.length)];
            const lineMe = pickMe.replace('{user}', message.member.displayName);
            return message.reply(lineMe);
        // Yeni yaratıcı komutlar
        case 'rastgele':
        case 'random':
            await handleRastgele(message, args);
            break;
        case 'nick':
        case 'nickname':
            await handleNickGenerator(message, args);
            break;
        case 'renk':
        case 'color':
            await handleColorGenerator(message);
            break;
        case 'kehanet':
        case 'fortune':
            await handleKehanet(message);
            break;
        case 'oyun':
        case 'game':
            await handleOyunOner(message);
            break;
        case 'fikir':
        case 'idea':
            await handleFikirOner(message);
            break;
        case 'ascii':
            await handleAsciiArt(message, args);
            break;
        case 'kelime':
        case 'word':
            await handleKelimeOyunu(message);
            break;
        case 'haiku':
            await handleHaiku(message);
            break;
        case 'rap':
            await handleRapBattle(message, args);
            break;
        // Yeni eğlenceli sosyal komutlar
        case 'dogruya':
        case 'truthordare':
            await handleTruthOrDare(message, args);
            break;
        case 'kisilik':
        case 'personality':
            await handlePersonalityTest(message);
            break;
        case 'hikaye':
        case 'story':
            await handleStoryGenerator(message, args);
            break;
        case 'challenge':
        case 'meydan':
            await handleChallenge(message);
            break;
        case 'wouldyou':
        case 'tercihet':
            await handleWouldYouRather(message);
            break;
        case 'ship':
            await handleShip(message, args);
            break;
        case 'icerik':
        case 'content':
            await handleContentGenerator(message, args);
            break;
        case 'viral':
            await handleViralContent(message);
            break;
        case 'trend':
            await handleTrendyContent(message);
            break;
            // Görsel/SFW image komutları
            case 'kedi':
            case 'cat':
                await handleCat(message);
                break;
            case 'kopek':
            case 'dog':
                await handleDog(message);
                break;
            case 'waifu':
                await handleWaifuCategory(message, 'waifu');
                break;
            case 'neko':
                await handleWaifuCategory(message, 'neko');
                break;
            case 'hug':
            case 'saril':
                await handleWaifuCategory(message, 'hug');
                break;
            case 'kiss':
            case 'opus':
                await handleWaifuCategory(message, 'kiss');
                break;
            case 'patgif':
            case 'oksa':
                await handleWaifuCategory(message, 'pat');
                break;
            // NSFW Görsel komutları (Admin toggle gerekli)
            case 'nsfw':
            case 'nsfwimg':
                await handleNSFWImage(message);
                break;
            case 'erotic':
            case 'erotik':
                await handleEroticImage(message);
                break;
            case 'hentai':
                await handleHentaiImage(message);
                break;
            case 'r34':
            case 'rule34':
                await handleRule34Image(message);
                break;
            case 'nsfwwaifu':
                await handleNSFWWaifu(message);
                break;
            case 'nsfwneko':
                await handleNSFWNeko(message);
                break;
            case 'ecchi':
                await handleEcchiImage(message);
                break;
            default:
                await handleAskLoop(message, serverQueue);
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
                playerListenersSet: false,
                repeat: false,
                currentResource: null
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
                        maxMissedFrames: Math.floor(15000 / 20)
                    }
                });

                connection.subscribe(queueConstruct.player);
                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
                } catch (e) {
                    console.warn('⚠️ Voice connection ready olmadı, yine de denenecek:', e.message);
                }
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
        return message.reply(`❌ Şarkı arama hatası: ${error.message}`);
    }
}

// Stop handler
async function handleStop(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.reply('🔊 Ses kanalında değilsin!');
    }
    
    if (!serverQueue) {
        return message.reply('❌ Çalan şarkı yok!');
    }

    askLoopActive.delete(message.guild.id);
    askLoopPlayed.clear();
    
    serverQueue.songs = [];
    if (serverQueue.player) {
        serverQueue.player.stop();
    }
    if (serverQueue.connection) {
        serverQueue.connection.destroy();
    }
    musicQueue.delete(message.guild.id);
    
    return message.reply('⏹️ Müzik durduruldu ve kuyruk temizlendi!');
}

// Skip handler
async function handleSkip(message, serverQueue) {
    if (!message.member.voice.channel) {
        return message.reply('🔊 Ses kanalında değilsin!');
    }
    if (!serverQueue) {
        return message.reply('❌ Çalan şarkı yok!');
    }
    
    if (serverQueue.player) {
        serverQueue.player.stop();
    }
    return message.reply('⏭️ Şarkı atlandı!');
}

// Play song function
async function playSong(guild, song) {
    const serverQueue = musicQueue.get(guild.id);
    let lastSourceProvider = null;
    let earlyRetryDone = false;

    if (!song) {
        if (askLoopActive.has(guild.id)) {
            console.log('🎰 ASK Loop devam ediyor...');
            const fakeMessage = createFakeMessage(guild, serverQueue);
            return handleAskLoop(fakeMessage, serverQueue);
        }
        
        if (serverQueue.connection) {
            serverQueue.connection.destroy();
        }
        musicQueue.delete(guild.id);
        return;
    }

    console.log('🎵 Şarkı çalınıyor:', song.title);
    
    try {
        let audioStream = null;
        let streamSource = 'unknown';
        
        try {
            console.log('🎮 play-dl ile stream alınıyor...');
            audioStream = await playdl.stream(song.url, { quality: 1 });
            streamSource = 'play-dl';
            lastSourceProvider = 'play-dl';
        } catch (error) {
            console.log('⚠️ play-dl başarısız, ytdl-core deneniyor...', error.message);
            try {
                const stream = ytdl(song.url, { 
                    filter: 'audioonly',
                    quality: 'lowestaudio',
                    highWaterMark: 1 << 25
                });
                audioStream = { stream: stream, type: StreamType.Arbitrary };
                streamSource = 'ytdl-core';
                lastSourceProvider = 'ytdl-core';
            } catch (ytdlError) {
                console.log('⚠️ ytdl-core başarısız, yt-dlp pipe deneniyor...', ytdlError.message);
                try {
                    const ytdlpProcess = spawn('yt-dlp', [
                        '-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio',
                        '-o', '-',
                        '--no-warnings',
                        '--no-call-home',
                        '--no-check-certificate',
                        '--prefer-free-formats',
                        '--youtube-skip-dash-manifest',
                        '--extract-flat',
                        '--no-playlist',
                        song.url
                    ], {
                        stdio: ['ignore', 'pipe', 'pipe']
                    });
                    
                    // Check if process started successfully
                    if (!ytdlpProcess.pid) {
                        throw new Error('yt-dlp process failed to start');
                    }
                    
                    audioStream = { stream: ytdlpProcess.stdout, type: StreamType.Arbitrary };
                    streamSource = 'yt-dlp-pipe';
                    lastSourceProvider = 'yt-dlp-pipe';
                    
                    ytdlpProcess.stderr.on('data', (data) => {
                        const errorMsg = data.toString();
                        if (errorMsg.includes('ERROR') || errorMsg.includes('WARNING')) {
                            console.log('🔧 yt-dlp:', errorMsg.trim());
                        }
                    });
                    
                    ytdlpProcess.on('error', (error) => {
                        console.error('❌ yt-dlp process error:', error.message);
                    });
                    
                    ytdlpProcess.on('exit', (code) => {
                        if (code !== 0) {
                            console.log(`🔧 yt-dlp process exited with code: ${code}`);
                        }
                    });
                    
                    console.log('✅ yt-dlp pipe stream başlatıldı');
                } catch (ytdlpError) {
                    console.error('❌ Tüm stream yöntemleri başarısız:', ytdlpError.message);
                    throw new Error('Stream alınamadı');
                }
            }
        }

        const resource = createAudioResource(audioStream.stream, {
            inputType: audioStream.type,
            inlineVolume: true,
            silencePaddingFrames: 5
        });
        
        if (resource.volume) {
            resource.volume.setVolume((serverQueue.volume || 5) / 10);
        }
        serverQueue.currentResource = resource;

        if (!serverQueue.playerListenersSet) {
            serverQueue.player.on('stateChange', (oldState, newState) => {
                console.log(`🎭 Player: ${oldState.status} -> ${newState.status}`);
            });

            serverQueue.player.on(AudioPlayerStatus.Idle, () => {
                // Use tracked start timestamp to compute how long the song actually played
                const startTs = serverQueue._playStart || Date.now();
                const playedDuration = Math.floor((Date.now() - startTs) / 1000);
                const expectedDuration = getAIEstimatedDuration(song) || parseDurationToSeconds(song.duration);
                
                console.log(`⏹️ Şarkı sona erdi: ${playedDuration}s çalındı (beklenen: ${expectedDuration}s)`);
                
                // Early end retry logic
                if (playedDuration < 5 && !earlyRetryDone && expectedDuration > 10) {
                    console.log('🔄 Erken bitiş tespit edildi, alternatif source ile yeniden denenecek...');
                    earlyRetryDone = true;
                    
                    // Switch to alternative source
                    const alternativeSource = lastSourceProvider === 'play-dl' ? 'ytdl-core' : 
                                            lastSourceProvider === 'ytdl-core' ? 'yt-dlp-pipe' : 'play-dl';
                    console.log(`🔀 ${lastSourceProvider} -> ${alternativeSource} değişimi yapılıyor...`);
                    
                    setTimeout(() => {
                        playSong(guild, song);
                    }, 1000);
                    return;
                }
                
                const analytics = analyzeCompletion(song, playedDuration, expectedDuration);
                songAnalytics.set(`${Date.now()}_${song.title}`, analytics);
                
                updateRealDuration(extractVideoId(song.url), playedDuration, expectedDuration);
                
                if (serverQueue.repeat && serverQueue.songs[0]) {
                    // Tekrar modu aktifse aynı şarkıyı yeniden çal
                    playSong(guild, serverQueue.songs[0]);
                } else {
                    serverQueue.songs.shift();
                    playSong(guild, serverQueue.songs[0]);
                }
            });

            serverQueue.player.on('error', error => {
                console.error('❌ Audio player hatası:', error);
                serverQueue.songs.shift();
                playSong(guild, serverQueue.songs[0]);
            });

            serverQueue.playerListenersSet = true;
        }

        // Track when we start playing this resource for analytics and retry logic
        serverQueue._playStart = Date.now();
        serverQueue.player.play(resource);
        sendNowPlayingMessage(serverQueue);

    } catch (error) {
        console.error(`❌ Şarkı çalma hatası: ${error.message}`);
        serverQueue.textChannel.send(`❌ Şarkı çalınamadı: **${song.title}**`);
        serverQueue.songs.shift();
        playSong(guild, serverQueue.songs[0]);
    }
}

function createFakeMessage(guild, serverQueue) {
    return {
        guild: guild,
        member: { voice: { channel: serverQueue.voiceChannel } },
        channel: serverQueue.textChannel,
        author: { bot: false }
    };
}

function sendNowPlayingMessage(serverQueue) {
    if (!serverQueue.songs[0]) return;
    
    const song = serverQueue.songs[0];
    const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('🎵 Şu An Çalıyor')
        .setDescription(`**${song.title}**`)
        .addFields([
            { name: '⏱️ Süre', value: song.duration || 'Bilinmiyor', inline: true },
            { name: '👤 İsteyen', value: song.requester.username, inline: true },
            { name: '🎯 Mod', value: song.isAskLoop ? 'ASK Loop' : 'Manuel', inline: true }
        ])
        .setFooter({ text: '🚀 No-Retry AI Music System' })
        .setTimestamp();

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    serverQueue.textChannel.send({ embeds: [embed] });
}

async function handlePlay(message, query, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.reply('🔊 Ses kanalında değilsin!');
    }

    console.log('🔍 Şarkı aranıyor:', query);

    try {
        const searchResults = await ytSearch.GetListByKeyword(query + ' official', false, 8);
        
        if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
            return message.reply('❌ Şarkı bulunamadı!');
        }

        let bestVideo = searchResults.items[0];

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
                playerListenersSet: false,
                repeat: false,
                currentResource: null
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
                        maxMissedFrames: Math.floor(15000 / 20)
                    }
                });

                connection.subscribe(queueConstruct.player);
                try {
                    await entersState(connection, VoiceConnectionStatus.Ready, 15000);
                } catch (e) {
                    console.warn('⚠️ Voice connection ready olmadı, yine de denenecek:', e.message);
                }
                playSong(message.guild, queueConstruct.songs[0]);
            } catch (err) {
                console.log(err);
                musicQueue.delete(message.guild.id);
                return message.channel.send('❌ Voice channel bağlantı hatası!');
            }
        } else {
            serverQueue.songs.push(song);
            return message.reply(`✅ **${song.title}** kuyruğa eklendi!`);
        }

    } catch (error) {
        console.error('Play komutu hatası:', error);
        return message.reply(`❌ Şarkı arama hatası: ${error.message}`);
    }
}

async function handleHelp(message) {
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('🤖 Bot Komutları')
        .setDescription('**Mevcut komutların listesi:**')
        .addFields([
            { 
                name: '🎵 Müzik Komutları', 
                value: '`!play <şarkı>` - Şarkı çal\n`!askloop` - ASK acısı çal\n`!stop` - Müziği durdur\n`!skip` - Şarkıyı atla\n`!queue/!kuyruk` - Kuyruğu göster\n`!shuffle/!karistir` - Karıştır\n`!repeat/!tekrar` - Tekrar modu\n`!volume/!ses <0-10>` - Ses\n`!nowplaying/!np` - Şu an çalan', 
                inline: false 
            },
            { 
                name: '🤖 AI Komutları', 
                value: '`!ai` - AI durumu\n`!help` - Yardım\n`!test <şarkı>` - Audio test', 
                inline: false 
            },
            { 
                name: '🎲 Eğlence Komutları', 
                value: '`!meme` - Rastgele meme\n`!patlat` - SFW roast\n`!yazitura` - Yazı tura\n`!kufur` - Sansürlü küfür\n`!dogruluk` - Doğruluk sorusu\n`!yalan` - Yalan ifade\n`!lovecalc` - Aşk hesaplama\n`!emoji` - Emoji karışımı\n`!zar` - Zar atma\n`!espri` - Espri\n`!sarki` - Şarkı önerisi\n`!oyunkesfet/!oyunara <kelime>` - Oyun keşfet\n`!oyunpuan <oyun>` - Oyun puanı\n`!oyuntur <kategori>` - Oyun türleri', 
                inline: false 
            },
            { 
                name: '🔥 NSFW/Roast Komutları', 
                value: '`!nsfwtoggle` - NSFW aç/kapat (Admin)\n`!roast <kişi>` - Roast mesajı\n`!roastme` - Kendini roast et\n\nNSFW görsel komutları (admin açarsa): `!nsfw`, `!erotic`, `!hentai`, `!r34`, `!nsfwwaifu`, `!nsfwneko`, `!ecchi`\nSFW alternatifler: `!waifu`, `!neko`, `!hug`, `!kiss`, `!patgif`, `!kedi`, `!kopek`', 
                inline: false 
            },
            { 
                name: '🌟 Yaratıcı Komutlar', 
                value: '`!rastgele` - Rastgele içerik\n`!nick` - Nick önerisi\n`!renk` - Renk üreteci\n`!kehanet` - Kehanet\n`!oyun` - Oyun önerisi\n`!fikir` - Yaratıcı fikir\n`!ascii <metin>` - ASCII art\n`!kelime` - Kelime oyunu\n`!haiku` - Haiku şiiri\n`!rap <tema>` - Rap battle', 
                inline: false 
            },
            { 
                name: '📷 Görsel/SFW İçerik', 
                value: '`!kedi/!cat` - Sevimli kedi resmi\n`!kopek/!dog` - Köpek resmi\n`!waifu` - Anime kızı\n`!neko` - Neko kedi kızı\n`!hug/!saril` - Sarılma GIF\n`!kiss/!opus` - Öpücük GIF\n`!patgif/!oksa` - Okşama GIF\n`!panda` - Panda\n`!fox/!tilki` - Tilki\n`!bird/!kus` - Kuş\n`!space/!uzay` - Uzay\n`!nature/!doga` - Doğa\n`!anime` - Anime stili\n`!manga` - Manga stili', 
                inline: false 
            }
        ])
        .setFooter({ text: '🚀 No-Retry AI Music System | Eğlence Paketleri' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

client.login(process.env.DISCORD_TOKEN);

async function handleTestSong(message, query, serverQueue) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
        return message.reply('🔊 Ses kanalında değilsin!');
    }

    console.log('🧪 TEST MODE - Şarkı aranıyor:', query);

    try {
        const searchResults = await ytSearch.GetListByKeyword(query + ' official', false, 8);
        
        if (!searchResults || !searchResults.items || searchResults.items.length === 0) {
            return message.reply('❌ Test şarkısı bulunamadı!');
        }

        let bestVideo = searchResults.items[0];

        const song = {
            title: '[TEST] ' + bestVideo.title,
            url: `https://www.youtube.com/watch?v=${bestVideo.id}`,
            duration: bestVideo.length?.simpleText || 'Bilinmiyor',
            thumbnail: bestVideo.thumbnail?.thumbnails?.[0]?.url || '',
            requester: message.author,
            isAskLoop: false,
            isTest: true,
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
                playerListenersSet: false,
                repeat: false,
                currentResource: null
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
                        maxMissedFrames: Math.floor(15000 / 20)
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
            serverQueue.songs.push(song);
            return message.reply(`🧪 **TEST: ${song.title}** kuyruğa eklendi!`);
        }

    } catch (error) {
        console.error('Test komutu hatası:', error);
        return message.reply(`❌ Test şarkısı arama hatası: ${error.message}`);
    }
}


async function handlePatlat(message, args) {
    const target = args.join(' ') || message.member.displayName;
    const sfwRoasts = roastMessages.filter(m => !/\b(orospu|sik|am|göt|kahpe|pezevenk)\b/i.test(m));
    const roast = sfwRoasts[Math.floor(Math.random() * sfwRoasts.length)];
    const finalRoast = roast.replace('{user}', target);
    await message.reply(`🔥 ${finalRoast}`);
}

async function handleYaziTura(message) {
    const result = Math.random() < 0.5 ? 'YAZI' : 'TURA';
    await message.reply(`🪙 **${result}**`);
}

async function handleKufur(message, args) {
    const target = args.join(' ') || 'birisi';
    const kufurler = [
        `${target} çok salak ya!`,
        `Vay be ${target}, kafan güzel çalışıyor!`,
        `${target} tam bir dingil!`,
        `E hadi ${target}, beynini kullan!`,
        `${target} kafayı mı yedin sen?`
    ];
    const pick = kufurler[Math.floor(Math.random() * kufurler.length)];
    await message.reply(`🤬 ${pick}`);
}

async function handleDogruluk(message) {
    const dogruluklar = [
        'Su aslında yaş değil, ıslaktır.',
        'Pizza üçgen ama kutusu kare.',
        'Hiç kimse bugünden önce yarını görmedi.',
        'Aynada kendini görürsün ama sen ayna değilsin.',
        'Her dakika 60 saniyedir.'
    ];
    const pick = dogruluklar[Math.floor(Math.random() * dogruluklar.length)];
    await message.reply(`✨ ${pick}`);
}

async function handleYalan(message) {
    const yalanlar = [
        'Kediler aslında köpeklerin evrimleşmiş halidir.',
        'WiFi çok kullanırsan internetten düşersin.',
        'Telefonu şarja takılı bırakırsan patlayabilir.',
        'Gece ıslık çalarsan ruh çağırırsın.',
        'Sakız yutarsan midende 7 yıl kalır.'
    ];
    const pick = yalanlar[Math.floor(Math.random() * yalanlar.length)];
    await message.reply(`🤥 ${pick}`);
}

async function handleLoveCalc(message, args) {
    if (args.length < 2) {
        return message.reply('💕 Kullanım: `!lovecalc kişi1 kişi2`');
    }
    const person1 = args[0];
    const person2 = args.slice(1).join(' ');
    const percentage = Math.floor(Math.random() * 101);
    
    let description = '';
    if (percentage < 30) description = 'Hmm, pek uyumlu görünmüyorsuz...';
    else if (percentage < 60) description = 'Fena değil, belki bir şans verebilirsiniz!';
    else if (percentage < 85) description = 'Vay be! Güzel bir uyum var burada!';
    else description = 'PERFECT MATCH! 🔥💕';
    
    await message.reply(`💖 **${person1}** & **${person2}**\n❤️ Aşk Oranı: **%${percentage}**\n${description}`);
}

async function handleEmojiMix(message, args) {
    const emojis = ['😀', '���2', '🥰', '😎', '🤔', '😴', '🤯', '🥳', '😇', '🤪', '🤠', '🥶', '🔥', '💯', '✨', '🌟', '💖', '🎵', '🎉', '🚀'];
    const mixed = [];
    for (let i = 0; i < 5; i++) {
        mixed.push(emojis[Math.floor(Math.random() * emojis.length)]);
    }
    await message.reply(`🎭 Emoji Karışımın: ${mixed.join(' ')}`);
}

async function handleZar(message, args) {
    const sides = args[0] ? parseInt(args[0]) : 6;
    if (sides < 2 || sides > 100) {
        return message.reply('🎲 Zar yüzü sayısı 2-100 arası olmalı!');
    }
    const result = Math.floor(Math.random() * sides) + 1;
    await message.reply(`🎲 ${sides} yüzlü zar: **${result}**`);
}

async function handleEspri(message) {
    const jokes = [
        'Balık ne zaman konuşur? Suda.',
        'Hangi hayvan en çok uyur? Uyku-şu!',
        'Doktorlar neden kalem kullanır? Çünkü onlar iyileştirirler!',
        'Neden telefon çaldı? Çünkü açıktaydı!',
        'Hangi meyve en çok koşar? Elma, çünkü vitamin C!'
    ];
    const pick = jokes[Math.floor(Math.random() * jokes.length)];
    await message.reply(`🤣 ${pick}`);
}

async function handleSarkiOner(message) {
    const list = playlists.askAcisi || [];
    if (!list.length) return message.reply('Liste boş gibi görünüyor.');
    const pick = list[Math.floor(Math.random() * list.length)];
    await message.reply(`🎧 Rastgele öneri: **${pick}**`);
}

// Yeni yaratıcı komut handlers
async function handleRastgele(message, args) {
    const categories = {
        sayi: () => Math.floor(Math.random() * 1000) + 1,
        renk: () => '#' + Math.floor(Math.random()*16777215).toString(16),
        hayvan: () => ['Kedi', 'Köpek', 'Aslan', 'Kaplan', 'Fil', 'Zebra', 'Giraffe', 'Panda'][Math.floor(Math.random() * 8)],
        yemek: () => ['Pizza', 'Burger', 'Kebab', 'Makarna', 'Sushi', 'Dondurma', 'Çikolata', 'Baklava'][Math.floor(Math.random() * 8)],
        ülke: () => ['Türkiye', 'Amerika', 'Japonya', 'Almanya', 'Fransa', 'İtalya', 'İspanya', 'Brezilya'][Math.floor(Math.random() * 8)]
    };
    
    const category = args[0] || Object.keys(categories)[Math.floor(Math.random() * Object.keys(categories).length)];
    
    if (categories[category]) {
        const result = categories[category]();
        await message.reply(`🎲 Rastgele **${category}**: **${result}**`);
    } else {
        await message.reply(`🎲 Mevcut kategoriler: ${Object.keys(categories).join(', ')}`);
    }
}

async function handleNickGenerator(message, args) {
    const adjectives = ['Cool', 'Epic', 'Legendary', 'Shadow', 'Fire', 'Ice', 'Dark', 'Bright', 'Swift', 'Silent'];
    const nouns = ['Wolf', 'Dragon', 'Phoenix', 'Tiger', 'Eagle', 'Warrior', 'Hunter', 'Master', 'Knight', 'Ninja'];
    const numbers = Math.floor(Math.random() * 999) + 1;
    
    const nick = `${adjectives[Math.floor(Math.random() * adjectives.length)]}${nouns[Math.floor(Math.random() * nouns.length)]}${numbers}`;
    
    await message.reply(`🏷️ Öneri Nick: **${nick}**`);
}

async function handleColorGenerator(message) {
    const color = '#' + Math.floor(Math.random()*16777215).toString(16);
    const embed = new EmbedBuilder()
        .setColor(color)
        .setTitle('🎨 Rastgele Renk')
        .setDescription(`**${color.toUpperCase()}**`)
        .addFields([
            { name: 'Hex Kod', value: color.toUpperCase(), inline: true },
            { name: 'RGB', value: `(${parseInt(color.slice(1,3), 16)}, ${parseInt(color.slice(3,5), 16)}, ${parseInt(color.slice(5,7), 16)})`, inline: true }
        ]);
    
    await message.reply({ embeds: [embed] });
}

async function handleKehanet(message) {
    const kehanetler = [
        'Yakında büyük bir değişiklik yaşayacaksın.',
        'Bugün sana güzel bir haber gelecek.',
        'Dikkatli ol, etrafında seni seven biri var.',
        'Şansın yolda, sabırlı ol.',
        'Geçmişten birisi hayatına geri dönecek.',
        'Maddi bir kazanç elde edeceksin.',
        'Yeni bir arkadaşlık kurulacak.',
        'Sağlığına dikkat et, dinlenmen gerek.',
        'Aşk kapını çalıyor.',
        'Bir sırrın ortaya çıkacak.'
    ];
    
    const kehanet = kehanetler[Math.floor(Math.random() * kehanetler.length)];
    await message.reply(`🔮 **Kehanet:** ${kehanet}`);
}

async function handleOyunOner(message) {
    const oyunlar = [
        'Among Us', 'Minecraft', 'Valorant', 'CS:GO', 'Fortnite', 'League of Legends', 
        'Fall Guys', 'Rocket League', 'Apex Legends', 'Overwatch', 'PUBG', 'Roblox',
        'GTA V', 'Red Dead Redemption 2', 'Cyberpunk 2077', 'The Witcher 3'
    ];
    
    const oyun = oyunlar[Math.floor(Math.random() * oyunlar.length)];
    await message.reply(`🎮 Oyun Önerisi: **${oyun}**`);
}

async function handleFikirOner(message) {
    const fikirler = [
        'Bugün yeni bir hobi edin!',
        'Eski bir arkadaşına mesaj at.',
        'Bir kitap okumaya başla.',
        'Yürüyüş yapmaya çık.',
        'Yeni bir yemek tarifi dene.',
        'Odanı yeniden düzenle.',
        'Bir film izle.',
        'Müzik dinleyerek dans et.',
        'Kedilerle oyna.',
        'Günlük tutmaya başla.',
        'Bir online kurs al.',
        'Bahçıvanlık yap.',
        'Fotoğraf çekmeye çık.',
        'Puzzle çöz.',
        'Arkadaşlarınla oyun oyna.'
    ];
    
    const fikir = fikirler[Math.floor(Math.random() * fikirler.length)];
    await message.reply(`💡 **Yaratıcı Fikir:** ${fikir}`);
}

async function handleAsciiArt(message, args) {
    if (!args.length) {
        return message.reply('📝 Kullanım: `!ascii <metin>`');
    }
    
    const text = args.join(' ').toUpperCase();
    if (text.length > 10) {
        return message.reply('⚠️ Metin 10 karakterden kısa olmalı!');
    }
    
    // Basit ASCII art (sadece A-Z için)
    const ascii = {
        'A': ['  A  ', ' A A ', 'AAAAA', 'A   A', 'A   A'],
        'B': ['BBBB ', 'B   B', 'BBBB ', 'B   B', 'BBBB '],
        'C': [' CCC ', 'C    ', 'C    ', 'C    ', ' CCC '],
        'D': ['DDDD ', 'D   D', 'D   D', 'D   D', 'DDDD '],
        'E': ['EEEEE', 'E    ', 'EEE  ', 'E    ', 'EEEEE'],
        'O': [' OOO ', 'O   O', 'O   O', 'O   O', ' OOO '],
        'L': ['L    ', 'L    ', 'L    ', 'L    ', 'LLLLL'],
        ' ': ['     ', '     ', '     ', '     ', '     ']
    };
    
    let result = ['', '', '', '', ''];
    for (let char of text) {
        if (ascii[char]) {
            for (let i = 0; i < 5; i++) {
                result[i] += ascii[char][i] + ' ';
            }
        }
    }
    
    await message.reply('```\n' + result.join('\n') + '\n```');
}

async function handleKelimeOyunu(message) {
    const kelimeler = [
        'JAVASCRIPT', 'DISCORD', 'MUZIK', 'OYUN', 'BILGISAYAR', 'TELEFON', 'INTERNET', 'PROGRAM',
        'WEBSITE', 'YOUTUBE', 'INSTAGRAM', 'FACEBOOK', 'TWITTER', 'GOOGLE', 'APPLE', 'MICROSOFT'
    ];
    
    const kelime = kelimeler[Math.floor(Math.random() * kelimeler.length)];
    const harfler = kelime.split('').sort(() => Math.random() - 0.5);
    
    await message.reply(`🔤 **Kelime Oyunu!**\nBu harflerden hangi kelime oluşur?\n\`${harfler.join(' ')}\`\n\n*İpucu: ${kelime.length} harfli*`);
}

async function handleHaiku(message) {
    const haiku = [
        'Sabah rüzgarı\nYaprağı usulca dans\nEttirir, huzur',
        'Kedi miyavlar\nPencerede güneş var\nUykuya dalır',
        'Yağmur damlaları\nCamda iz bırakarak\nAkar, sessizce',
        'Müzik çalarken\nKalp ritmi hızlanır\nDans eder ruh',
        'Kahve kokusu\nSabah uyanışımı\nTatlı kılar çok'
    ];
    
    const selectedHaiku = haiku[Math.floor(Math.random() * haiku.length)];
    await message.reply(`🌸 **Haiku:**\n\`\`\`\n${selectedHaiku}\n\`\`\``);
}

async function handleRapBattle(message, args) {
    const tema = args.join(' ') || 'genel';
    
    const rapLines = [
        `Yo, ${message.author.username} burada, flow\'um var`,
        `${tema} hakkında rap yapıyorum, dinle ne var`,
        'Mikrofonu kap, beat\'i aç, başlasın show',
        'Discord\'da rap battle, bu bizim flow',
        'Kelimeler akıyor sanki nehir gibi',
        'Ritim tutuyorum, kalp gibi',
        'Bu server\'da efsane olacağım',
        'Herkesi geçeceğim, birinci olacağım'
    ];
    
    const selectedLines = [];
    for (let i = 0; i < 4; i++) {
        selectedLines.push(rapLines[Math.floor(Math.random() * rapLines.length)]);
    }
    
    await message.reply(`🎤 **Rap Battle - ${tema}:**\n\`\`\`\n${selectedLines.join('\n')}\n\`\`\``);
}

async function handleTruthOrDare(message, args) {
    const mode = (args[0] || '').toLowerCase();
    const truths = [
        'En utanç verici anın neydi?',
        'Hiç kimseye söylemediğin bir sırrın var mı?',
        'Birinden gizlediğin en büyük şey ne?',
        'Aşık olup da söyleyemediğin oldu mu?',
        'Bugüne kadar yaptığın en komik şey ne?'
    ];
    const dares = [
        'Profil fotoğrafını 10 dakika boyunca komik bir şeye değiştir.',
        'Sunucuda birine övgü yaz.',
        'En sevdiğin şarkıyı caps lock ile yaz.',
        'Bir emoji ile kendini anlatmaya çalış.',
        'Rastgele biriyle 3 cümlelik mini hikaye yaz.'
    ];
    if (mode === 'truth' || mode === 'dogru') {
        const t = truths[Math.floor(Math.random() * truths.length)];
        return message.reply(`🧐 Doğruluk: ${t}`);
    }
    if (mode === 'dare' || mode === 'cesaret') {
        const d = dares[Math.floor(Math.random() * dares.length)];
        return message.reply(`💪 Cesaret: ${d}`);
    }
    const pick = Math.random() < 0.5 ? `🧐 Doğruluk: ${truths[Math.floor(Math.random() * truths.length)]}` : `💪 Cesaret: ${dares[Math.floor(Math.random() * dares.length)]}`;
    await message.reply(pick);
}

async function handlePersonalityTest(message) {
    const types = [
        'Stratejist 🧠', 'Macera Ruhlu 🧭', 'Lider 🦁', 'Sanatçı 🎨', 'Bilge 🧙‍♂️',
        'Neşeli 😄', 'Analitik 📊', 'Sakin 🌿', 'Yaratıcı 💡', 'Karizmatik ✨'
    ];
    const result = types[Math.floor(Math.random() * types.length)];
    await message.reply(`🧩 Kişilik Testi Sonucun: **${result}**`);
}

async function handleStoryGenerator(message, args) {
    const tema = args.join(' ') || 'müthiş bir macera';
    const starters = [
        'Bir zamanlar uzak bir diyarda',
        'Gece yarısı sessizlik çökerken',
        'Kalabalık bir şehirde yalnız yürürken',
        'Eski bir defterin sayfaları arasında',
        'Bir yağmur damlasının peşinden'
    ];
    const twists = [
        'beklenmedik bir kapı açıldı',
        'gizemli bir not bulundu',
        'zaman aniden yavaşladı',
        'bir köpek yolu gösterdi',
        'bir şarkı her şeyi değiştirdi'
    ];
    const endings = [
        've o gün her şey yeni başladı.',
        'ama esas macera şimdi başlıyordu.',
        've artık hiçbir şey eskisi gibi olmayacaktı.',
        've dostluk her şeyi kazandı.',
        've kahramanımız yeni bir yol seçti.'
    ];
    const story = `${starters[Math.floor(Math.random()*starters.length)]} ${tema} üzerine ${twists[Math.floor(Math.random()*twists.length)]} ve ${endings[Math.floor(Math.random()*endings.length)]}`;
    await message.reply(`📖 Hikaye: ${story}`);
}

async function handleChallenge(message) {
    const challenges = [
        'Sunucuda 3 farklı kişiye övgü yaz.',
        'Profiline 1 saatliğine bir emojiyi ekle.',
        'Rastgele bir emoji ile 3 cümle kur.',
        'En sevdiğin şarkıyı paylaş.',
        'Son çektiğin fotoğrafı (SFW) hashtag ile anlat.'
    ];
    const c = challenges[Math.floor(Math.random()*challenges.length)];
    await message.reply(`🏁 Meydan Okuma: ${c}`);
}

async function handleWouldYouRather(message) {
    const pairs = [
        ['Görünmez olmak', 'Zihin okumak'],
        ['Uçmak', 'Işınlanmak'],
        ['Geçmişe gitmek', 'Geleceğe gitmek'],
        ['Asla uyumamak', 'Asla acıkmamak'],
        ['Sınırsız zaman', 'Sınırsız para']
    ];
    const [a, b] = pairs[Math.floor(Math.random() * pairs.length)];
    await message.reply(`🤔 Hangisini seçersin?
A) ${a}
B) ${b}`);
}

async function handleShip(message, args) {
    if (args.length < 2) {
        return message.reply('⛵ Kullanım: `!ship kişi1 kişi2`');
    }
    const a = args[0];
    const b = args.slice(1).join(' ');
    const score = Math.floor(Math.random() * 101);
    const bar = '❤️'.repeat(Math.floor(score / 10)) + '🖤'.repeat(10 - Math.floor(score / 10));
    await message.reply(`⛵ Ship: **${a}** + **${b}** = %${score}
${bar}`);
}

async function handleContentGenerator(message, args) {
    const topic = args.join(' ') || 'komik paylaşım';
    const ideas = [
        `"${topic}" için 10 saniyelik kısa video: hızlı zoom + emoji patlaması`,
        `"${topic}" hakkında anket: 4 seçenekle arkadaşlarınını yokla`,
        `"${topic}" ile ilgili mini skeç: 3 sahnelik, 30 saniye`,
        `Template: "beklenti vs gerçek" - ${topic}`,
        `${topic} için meme: caption + 2 panel`
    ];
    const idea = ideas[Math.floor(Math.random()*ideas.length)];
    await message.reply(`📌 İçerik Fikri: ${idea}`);
}

async function handleViralContent(message) {
    const hooks = [
        'Kimse bunu söylemiyor ama...',
        'Bunu ilk kez paylaşacağım...',
        'Sadece %1 kişinin bildiği...',
        'Bu taktikle 10 saniyede...',
        'Gözünü kırpmadan izle...'
    ];
    const hook = hooks[Math.floor(Math.random()*hooks.length)];
    await message.reply(`🚀 Viral Başlangıç Önerisi: "${hook}"`);
}

async function handleTrendyContent(message) {
    const trends = [
        'POV videoları', 'Geçiş efektleri', 'Duet/Remix içerikler', 'Storytime akımları', 'Emoji trendleri'
    ];
    const pick = trends[Math.floor(Math.random()*trends.length)];
    await message.reply(`📈 Trend Fikir: **${pick}**`);
}

// Upgrade meme handler with curated SFW sources
async function handleMeme(message, args) {
    try {
        const sources = [
            'https://meme-api.com/gimme/ProgrammerHumor',
            'https://meme-api.com/gimme/memes',
            'https://meme-api.com/gimme/wholesomememes',
            'https://meme-api.com/gimme/dankmemes'
        ];
        const url = sources[Math.floor(Math.random()*sources.length)];
        const { data } = await axios.get(url, { timeout: 8000 });
        const meme = data;
        const embed = new EmbedBuilder()
            .setColor('#FF6B6B')
            .setTitle(meme.title || '😂 Meme')
            .setImage(meme.url)
            .setFooter({ text: meme.author ? `by ${meme.author}` : 'meme-api.com' });
        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply('🤡 Meme bulunamadı, başka bir şey deneyelim! `!espri` veya `!trend`');
    }
}

// SFW image handlers
async function handleCat(message) {
    try {
        const { data } = await axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 8000 });
        const url = data && data[0] && data[0].url;
        if (!url) throw new Error('no_image');
        const embed = new EmbedBuilder().setColor('#ffb6c1').setTitle('🐱 Kedi Zamanı').setImage(url);
        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply('😿 Kedi resmi bulunamadı, tekrar dene!');
    }
}

async function handleDog(message) {
    try {
        const { data } = await axios.get('https://dog.ceo/api/breeds/image/random', { timeout: 8000 });
        const url = data && data.message;
        if (!url) throw new Error('no_image');
        const embed = new EmbedBuilder().setColor('#c0ffee').setTitle('🐶 Köpek Keyfi').setImage(url);
        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply('🐕 Köpek resmi bulunamadı, tekrar dene!');
    }
}

async function handleWaifuCategory(message, category) {
    try {
        const { data } = await axios.get(`https://api.waifu.pics/sfw/${category}`, { timeout: 8000 });
        const url = data && data.url;
        if (!url) throw new Error('no_image');
        const titles = { waifu: '💖 Waifu', neko: '🐾 Neko', hug: '🤗 Sarılma', kiss: '💋 Öpücük', pat: '🫶 Okşama' };
        const embed = new EmbedBuilder().setColor('#9b59b6').setTitle(titles[category] || '✨ Görsel').setImage(url);
        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply('📷 Görsel alınamadı, tekrar dene!');
    }
}

// NSFW görsel komutları (Admin toggle gerekli)
function nsfwDeniedText() {
    return (
        '⚠️ NSFW içerik bu sunucuda kapalı. Yönetici `!nsfwtoggle` ile açabilir.\n' +
        'SFW alternatifler: `!waifu`, `!neko`, `!hug`, `!kiss`, `!patgif`, `!kedi`, `!kopek`'
    );
}

async function handleNSFWImage(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const response = await axios.get('https://api.waifu.pics/nsfw/waifu');
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('🔥 NSFW Waifu')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 NSFW görsel alınamadı, tekrar dene!');
    }
}

async function handleEroticImage(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const response = await axios.get('https://api.waifu.pics/nsfw/neko');
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('💋 Erotik Görsel')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 Erotik görsel alınamadı, tekrar dene!');
    }
}

async function handleHentaiImage(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const response = await axios.get('https://api.waifu.pics/nsfw/trap');
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('🌸 Hentai Görsel')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 Hentai görsel alınamadı, tekrar dene!');
    }
}

async function handleRule34Image(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const response = await axios.get('https://api.waifu.pics/nsfw/blowjob');
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('🔞 Rule34 Görsel')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 Rule34 görsel alınamadı, tekrar dene!');
    }
}

async function handleNSFWWaifu(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const categories = ['waifu', 'neko', 'trap'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        const response = await axios.get(`https://api.waifu.pics/nsfw/${randomCategory}`);
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('💖 NSFW Waifu')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 NSFW waifu görsel alınamadı, tekrar dene!');
    }
}

async function handleNSFWNeko(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const response = await axios.get('https://api.waifu.pics/nsfw/neko');
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('🐾 NSFW Neko')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 NSFW neko görsel alınamadı, tekrar dene!');
    }
}

async function handleEcchiImage(message) {
    const isNSFWEnabled = nsfwEnabled.get(message.guild.id) || false;
    if (!isNSFWEnabled) {
        return message.reply(nsfwDeniedText());
    }

    try {
        const response = await axios.get('https://api.waifu.pics/nsfw/waifu');
        const embed = new EmbedBuilder()
            .setColor('#ff6b9d')
            .setTitle('✨ Ecchi Görsel')
            .setImage(response.data.url)
            .setFooter({ text: 'NSFW içerik - Sadece 18+ kanallar için' });
        await message.reply({ embeds: [embed] });
    } catch (error) {
        await message.reply('🚫 Ecchi görsel alınamadı, tekrar dene!');
    }
}
