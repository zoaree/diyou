const { EmbedBuilder } = require('discord.js');
const axios = require('axios');

// Gelişmiş oyun önerileri fonksiyonları
async function handleOyunKesfet(message, args) {
    const keyword = args.join(' ');
    
    const games = {
        action: ['Call of Duty', 'Valorant', 'Apex Legends', 'Cyberpunk 2077', 'Doom Eternal'],
        rpg: ['The Witcher 3', 'Elden Ring', 'Skyrim', 'Final Fantasy XIV', 'Baldur\'s Gate 3'],
        strategy: ['Age of Empires IV', 'Civilization VI', 'Total War', 'StarCraft II', 'Europa Universalis'],
        indie: ['Hollow Knight', 'Celeste', 'Hades', 'Stardew Valley', 'Undertale'],
        multiplayer: ['Among Us', 'Fall Guys', 'Rocket League', 'Overwatch 2', 'CS2'],
        mobile: ['Genshin Impact', 'PUBG Mobile', 'Mobile Legends', 'Clash Royale', 'Brawl Stars']
    };

    let suggestions = [];
    if (keyword) {
        const searchTerm = keyword.toLowerCase();
        Object.entries(games).forEach(([genre, gameList]) => {
            if (genre.includes(searchTerm) || searchTerm.includes(genre)) {
                suggestions = gameList;
            }
        });
        
        if (suggestions.length === 0) {
            suggestions = Object.values(games).flat();
        }
    } else {
        const genres = Object.keys(games);
        const randomGenre = genres[Math.floor(Math.random() * genres.length)];
        suggestions = games[randomGenre];
    }

    const randomGame = suggestions[Math.floor(Math.random() * suggestions.length)];
    
    const embed = new EmbedBuilder()
        .setColor('#00FF7F')
        .setTitle('🎮 Oyun Önerisi')
        .setDescription(`**${randomGame}**`)
        .addFields([
            { name: '🔍 Arama', value: keyword || 'Rastgele', inline: true },
            { name: '📱 Platform', value: 'PC/Console/Mobile', inline: true }
        ])
        .setFooter({ text: 'İyi oyunlar!' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function handleOyunPuan(message, args) {
    const gameName = args.join(' ');
    if (!gameName) {
        return message.reply('🎮 Oyun adı belirt! Örnek: `!oyunpuan Valorant`');
    }

    const rating = Math.floor(Math.random() * 5) + 6; // 6-10 arası
    const reviews = Math.floor(Math.random() * 50000) + 1000;
    
    const comments = [
        'Harika bir oyun!', 'Çok bağımlılık yapıyor', 'Grafikleri muhteşem',
        'Hikayesi çok güzel', 'Multiplayer çok eğlenceli', 'Teknik olarak mükemmel'
    ];
    
    const embed = new EmbedBuilder()
        .setColor('#FFD700')
        .setTitle('⭐ Oyun Puanı')
        .setDescription(`**${gameName}**`)
        .addFields([
            { name: '📊 Puan', value: `${rating}/10`, inline: true },
            { name: '👥 İnceleme', value: `${reviews.toLocaleString()}`, inline: true },
            { name: '💬 Yorum', value: comments[Math.floor(Math.random() * comments.length)], inline: false }
        ])
        .setFooter({ text: 'Topluluk puanı' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function handleOyunTur(message, args) {
    const requestedGenre = args.join(' ').toLowerCase();
    
    const genres = {
        'aksiyon': ['FPS', 'Platformer', 'Beat\'em up', 'Savaş'],
        'rpg': ['JRPG', 'Western RPG', 'Action RPG', 'MMORPG'],
        'strateji': ['RTS', 'Turn-based', 'Grand Strategy', '4X'],
        'spor': ['Futbol', 'Basketbol', 'Yarış', 'Fitness'],
        'korku': ['Survival Horror', 'Psychological Horror', 'Action Horror'],
        'bulmaca': ['Logic Puzzle', 'Physics Puzzle', 'Hidden Object']
    };

    let selectedGenre, subGenres;
    
    if (requestedGenre && genres[requestedGenre]) {
        selectedGenre = requestedGenre;
        subGenres = genres[requestedGenre];
    } else {
        const genreKeys = Object.keys(genres);
        selectedGenre = genreKeys[Math.floor(Math.random() * genreKeys.length)];
        subGenres = genres[selectedGenre];
    }

    const embed = new EmbedBuilder()
        .setColor('#8B008B')
        .setTitle('🎯 Oyun Türü Rehberi')
        .setDescription(`**${selectedGenre.toUpperCase()}** türü alt kategorileri:`)
        .addFields([
            { name: '📋 Alt Türler', value: subGenres.map(sub => `• ${sub}`).join('\n'), inline: false },
            { name: '🎮 Öneri', value: `Bu türde oyun arıyorsan **${subGenres[0]}** tarzını dene!`, inline: false }
        ])
        .setFooter({ text: 'Favori türünü keşfet!' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

// Gelişmiş müzik fonksiyonları
async function handleMusicQueue(message, serverQueue) {
    if (!serverQueue || serverQueue.songs.length === 0) {
        return message.reply('📭 Müzik kuyruğu boş!');
    }

    const songs = serverQueue.songs.slice(0, 10); // İlk 10 şarkı
    const queueText = songs.map((song, index) => {
        const status = index === 0 ? '🎵 **Çalıyor**' : `${index}.`;
        return `${status} ${song.title} - *${song.requester.username}*`;
    }).join('\n');

    const embed = new EmbedBuilder()
        .setColor('#9932CC')
        .setTitle('🎵 Müzik Kuyruğu')
        .setDescription(queueText)
        .addFields([
            { name: '📊 Toplam', value: `${serverQueue.songs.length} şarkı`, inline: true },
            { name: '🔊 Ses', value: `${serverQueue.volume}/10`, inline: true }
        ])
        .setFooter({ text: 'Müzik sistemi aktif' })
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function handleShuffle(message, serverQueue) {
    if (!serverQueue || serverQueue.songs.length <= 1) {
        return message.reply('🔀 Karıştırmak için en az 2 şarkı gerekli!');
    }

    // İlk şarkıyı koruyarak diğerlerini karıştır
    const currentSong = serverQueue.songs.shift();
    
    for (let i = serverQueue.songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [serverQueue.songs[i], serverQueue.songs[j]] = [serverQueue.songs[j], serverQueue.songs[i]];
    }
    
    serverQueue.songs.unshift(currentSong);

    const embed = new EmbedBuilder()
        .setColor('#FF1493')
        .setTitle('🔀 Kuyruk Karıştırıldı')
        .setDescription('Şarkı sırası rastgele karıştırıldı!')
        .addFields([
            { name: '🎵 Şu an çalan', value: currentSong.title, inline: false },
            { name: '📊 Kuyruk', value: `${serverQueue.songs.length} şarkı`, inline: true }
        ])
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function handleRepeat(message, serverQueue) {
    if (!serverQueue) {
        return message.reply('🔁 Aktif müzik yok!');
    }

    serverQueue.repeat = !serverQueue.repeat;
    const status = serverQueue.repeat ? 'Açık' : 'Kapalı';
    const emoji = serverQueue.repeat ? '🔁' : '▶️';

    const embed = new EmbedBuilder()
        .setColor(serverQueue.repeat ? '#32CD32' : '#FF6347')
        .setTitle(`${emoji} Tekrar Modu`)
        .setDescription(`Tekrar modu **${status}**`)
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function handleVolume(message, args, serverQueue) {
    if (!serverQueue) {
        return message.reply('🔊 Aktif müzik yok!');
    }

    if (!args[0]) {
        return message.reply(`🔊 Mevcut ses seviyesi: **${serverQueue.volume}/10**`);
    }

    const volume = parseInt(args[0]);
    if (isNaN(volume) || volume < 0 || volume > 10) {
        return message.reply('🔊 Ses seviyesi 0-10 arası olmalı!');
    }

    serverQueue.volume = volume;
    
    // Mevcut resource varsa ses seviyesini uygula
    if (serverQueue.currentResource && serverQueue.currentResource.volume) {
        serverQueue.currentResource.volume.setVolume(volume / 10);
    }
    
    const embed = new EmbedBuilder()
        .setColor('#1E90FF')
        .setTitle('🔊 Ses Seviyesi')
        .setDescription(`Ses seviyesi **${volume}/10** olarak ayarlandı`)
        .setTimestamp();

    message.reply({ embeds: [embed] });
}

async function handleNowPlaying(message, serverQueue) {
    if (!serverQueue || !serverQueue.songs[0]) {
        return message.reply('🎵 Şu anda çalan şarkı yok!');
    }

    const song = serverQueue.songs[0];
    const embed = new EmbedBuilder()
        .setColor('#FF69B4')
        .setTitle('🎵 Şu An Çalıyor')
        .setDescription(`**${song.title}**`)
        .addFields([
            { name: '⏱️ Süre', value: song.duration || 'Bilinmiyor', inline: true },
            { name: '👤 İsteyen', value: song.requester.username, inline: true },
            { name: '🔊 Ses', value: `${serverQueue.volume}/10`, inline: true },
            { name: '📊 Kuyruk', value: `${serverQueue.songs.length} şarkı`, inline: true }
        ]);

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    message.reply({ embeds: [embed] });
}

// Yeni görsel kategorileri
async function handleAnimalPic(message, animal) {
    try {
        let apiUrl, title, color;
        
        switch(animal) {
            case 'panda':
                apiUrl = 'https://some-random-api.ml/animal/panda';
                title = '🐼 Panda';
                color = '#000000';
                break;
            case 'fox':
                apiUrl = 'https://randomfox.ca/floof/';
                title = '🦊 Tilki';
                color = '#FF8C00';
                break;
            case 'bird':
                apiUrl = 'https://some-random-api.ml/animal/bird';
                title = '🐦 Kuş';
                color = '#87CEEB';
                break;
        }

        const { data } = await axios.get(apiUrl, { timeout: 8000 });
        let imageUrl;
        
        if (animal === 'fox') {
            imageUrl = data.image;
        } else {
            imageUrl = data.image;
        }

        if (!imageUrl) throw new Error('no_image');

        const embed = new EmbedBuilder()
            .setColor(color)
            .setTitle(title)
            .setImage(imageUrl)
            .setFooter({ text: 'Doğal yaşam' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply(`❌ ${animal} resmi bulunamadı, tekrar dene!`);
    }
}

async function handleSpacePic(message) {
    try {
        const { data } = await axios.get('https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY', { timeout: 8000 });
        
        const embed = new EmbedBuilder()
            .setColor('#191970')
            .setTitle('🌌 Uzay Görüntüsü')
            .setDescription(data.title || 'Günün Astronomik Fotoğrafı')
            .setImage(data.url)
            .setFooter({ text: 'NASA APOD' })
            .setTimestamp();

        if (data.explanation) {
            embed.addFields([{ name: '📝 Açıklama', value: data.explanation.substring(0, 1000) + '...', inline: false }]);
        }

        await message.reply({ embeds: [embed] });
    } catch (e) {
        // Fallback: rastgele uzay görüntüsü
        const spaceImages = [
            'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06',
            'https://images.unsplash.com/photo-1614728263952-84ea256f9679',
            'https://images.unsplash.com/photo-1581833971358-2c8b550f87b3'
        ];
        
        const randomImage = spaceImages[Math.floor(Math.random() * spaceImages.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#191970')
            .setTitle('🌌 Uzay Görüntüsü')
            .setImage(randomImage)
            .setFooter({ text: 'Uzayın derinlikleri' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    }
}

async function handleNaturePic(message) {
    try {
        const natureKeywords = ['nature', 'landscape', 'forest', 'mountain', 'ocean', 'sunset'];
        const keyword = natureKeywords[Math.floor(Math.random() * natureKeywords.length)];
        
        // Unsplash API alternatifi
        const natureImages = [
            'https://images.unsplash.com/photo-1441974231531-c6227db76b6e',
            'https://images.unsplash.com/photo-1506905925346-21bda4d32df4',
            'https://images.unsplash.com/photo-1473448912268-2022ce9509d8',
            'https://images.unsplash.com/photo-1506893421012-aef00c3b0d75'
        ];
        
        const randomImage = natureImages[Math.floor(Math.random() * natureImages.length)];
        
        const embed = new EmbedBuilder()
            .setColor('#228B22')
            .setTitle('🌿 Doğa Manzarası')
            .setDescription(`Güzel bir ${keyword} görüntüsü`)
            .setImage(randomImage)
            .setFooter({ text: 'Doğanın güzellikleri' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply('🌿 Doğa resmi bulunamadı, tekrar dene!');
    }
}

async function handleMangaPic(message) {
    try {
        const { data } = await axios.get('https://api.waifu.pics/sfw/waifu', { timeout: 8000 });
        const url = data && data.url;
        if (!url) throw new Error('no_image');
        
        const embed = new EmbedBuilder()
            .setColor('#FF6347')
            .setTitle('📚 Manga Stili')
            .setImage(url)
            .setFooter({ text: 'Manga sanatı' })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    } catch (e) {
        await message.reply('📚 Manga resmi bulunamadı, tekrar dene!');
    }
}

module.exports = {
    handleOyunKesfet,
    handleOyunPuan,
    handleOyunTur,
    handleMusicQueue,
    handleShuffle,
    handleRepeat,
    handleVolume,
    handleNowPlaying,
    handleAnimalPic,
    handleSpacePic,
    handleNaturePic,
    handleMangaPic
};