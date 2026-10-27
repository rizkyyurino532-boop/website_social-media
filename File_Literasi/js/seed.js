/**
 * ==========================================================================
 * SEED.JS - Initial Dummy Data Generator
 * Creates 9 realistic Indonesian users, 22+ posts, comments, stories,
 * chat conversations, and notifications on first launch.
 * ==========================================================================
 */

// Precomputed SHA-256 hash for default password: "password123"
const DEFAULT_PASSWORD_HASH =
  "ef92b778bafe771e89245b89ecbc08a44a4e166c06659911881f383d4473e94f";

/**
 * Helper to create crisp SVG illustration DataURLs for posts, banners & stories
 * Ensures media always loads fast even offline
 */
function createIllustrationDataUrl(
  title,
  subtitle,
  colorStart,
  colorEnd,
  accentIcon = "✦",
) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="500" viewBox="0 0 800 500">
    <defs>
      <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${colorStart}"/>
        <stop offset="100%" stop-color="${colorEnd}"/>
      </linearGradient>
    </defs>
    <rect width="800" height="500" fill="url(#g)"/>
    <circle cx="680" cy="100" r="160" fill="rgba(255,255,255,0.08)"/>
    <circle cx="120" cy="420" r="210" fill="rgba(255,255,255,0.06)"/>
    <rect x="60" y="60" width="680" height="380" rx="24" fill="rgba(15,23,42,0.28)" stroke="rgba(255,255,255,0.18)" stroke-width="2"/>
    <text x="105" y="165" font-family="Poppins, Inter, sans-serif" font-size="52" fill="#ffffff" opacity="0.9">${accentIcon}</text>
    <text x="105" y="255" font-family="Poppins, Inter, sans-serif" font-weight="700" font-size="38" fill="#ffffff">${title}</text>
    <text x="105" y="305" font-family="Inter, sans-serif" font-weight="500" font-size="22" fill="rgba(255,255,255,0.85)">${subtitle}</text>
    <text x="105" y="395" font-family="Inter, sans-serif" font-weight="600" font-size="16" fill="rgba(255,255,255,0.65)">KONEKTA VISUAL STUDIO</text>
  </svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

class SeedService {
  /**
   * Initialize seed data if not already seeded
   */
  init() {
    const isSeeded = window.Storage.get(window.STORAGE_KEYS.SEEDED, false);
    const existingUsers = window.Storage.get(window.STORAGE_KEYS.USERS, []);

    const hasArifAccount = existingUsers.some(
      (u) => u.username === "arif_hidayat" || u.username === "arifhidayat123",
    );

    if (isSeeded && existingUsers.length > 0 && hasArifAccount) {
      return;
    }

    this.seedAll();
  }

  /**
   * Populate all initial collections into localStorage
   */
  seedAll() {
    const now = Date.now();
    const min = 60 * 1000;
    const hour = 60 * min;

    // 1. Seed Users (Account #1: Muhammad Arif Hidayat)
    const users = [
      {
        id: "user_1",
        name: "Muhammad Arif Hidayat",
        username: "arif_hidayat",
        email: "arif@konekta.id",
        password: "arifhidayat123",
        passwordHash:
          "9c83575e1d3438170eb6fa07253509a12cef66507006c2a5dabb4f8f3d99b320",
        avatar: "https://i.pravatar.cc/150?img=11",
        banner: createIllustrationDataUrl(
          "Design & Product",
          "Membangun Pengalaman Digital Bermakna",
          "#6366f1",
          "#ec4899",
          "🎨",
        ),
        bio: "Senior UI/UX Designer & Digital Creator ✨ Berbagi tips desain antarmuka, #UIUX, dan #LiterasiData setiap minggu.",
        location: "Jakarta Selatan, ID",
        website: "https://arifhidayat.design",
        verified: true,
        isPrivate: false,
        followers: [
          "user_2",
          "user_3",
          "user_4",
          "user_5",
          "user_6",
          "user_7",
          "user_8",
          "user_10",
        ],
        following: [
          "user_2",
          "user_3",
          "user_4",
          "user_5",
          "user_6",
          "user_9",
          "user_10",
        ],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: ["post_3", "post_8"],
        createdAt: now - 90 * 24 * hour,
      },
      {
        id: "user_10",
        name: "Sulthan Rizky",
        username: "sulthan_rizky",
        email: "sulthan@konekta.id",
        password: "sulthan123",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=47",
        banner: createIllustrationDataUrl(
          "Creative Studio",
          "Visual Design & Illustration",
          "#8b5cf6",
          "#ec4899",
          "✨",
        ),
        bio: "Digital Illustrator & Visual Researcher 🎨 Kolaborasi proyek kreatif dan #UIUX.",
        location: "Jakarta, ID",
        website: "https://nadiaputri.design",
        verified: true,
        isPrivate: false,
        followers: ["user_1", "user_2", "user_3"],
        following: ["user_1", "user_2", "user_3"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 88 * 24 * hour,
      },
      {
        id: "user_2",
        name: "Bima Pratama",
        username: "bima_dev",
        email: "bima@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=12",
        banner: createIllustrationDataUrl(
          "Full-Stack Web",
          "Clean Code & Web Performance",
          "#0f172a",
          "#3b82f6",
          "⚡",
        ),
        bio: "Frontend Architect & Open Source Enthusiast 💻 Pecinta #JavaScript murni, #WebDev, dan kopi hitam pagi hari.",
        location: "Bandung, ID",
        website: "https://bimapratama.dev",
        verified: true,
        isPrivate: false,
        followers: ["user_1", "user_3", "user_4", "user_6", "user_8", "user_9"],
        following: ["user_1", "user_3", "user_4", "user_7"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: ["post_1"],
        createdAt: now - 85 * 24 * hour,
      },
      {
        id: "user_3",
        name: "Alya Rahmawati",
        username: "alya_data",
        email: "alya@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=32",
        banner: createIllustrationDataUrl(
          "Data Literacy Lab",
          "Mengubah Angka Menjadi Cerita",
          "#059669",
          "#0ea5e9",
          "📊",
        ),
        bio: "Data Scientist & Edukator #LiterasiData 📊 Membantu mahasiswa & profesional memahami statistik, visualisasi data, dan #AI.",
        location: "Yogyakarta, ID",
        website: "https://literasidata.id",
        verified: true,
        isPrivate: false,
        followers: ["user_1", "user_2", "user_4", "user_5", "user_7", "user_9"],
        following: ["user_1", "user_2", "user_5", "user_8"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 70 * 24 * hour,
      },
      {
        id: "user_4",
        name: "Reza Mahendra",
        username: "reza_lensa",
        email: "reza@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=59",
        banner: createIllustrationDataUrl(
          "Visual Storyteller",
          "Street & Landscape Photography",
          "#f59e0b",
          "#ef4444",
          "📷",
        ),
        bio: "Fotografer Jalanan & Dokumenter Nusantara 📸 Menangkap momen autentik dari Sabang sampai Merauke. #Fotografi #Nusantara",
        location: "Denpasar, Bali",
        website: "https://rezalensa.id",
        verified: false,
        isPrivate: false,
        followers: ["user_1", "user_2", "user_5", "user_6"],
        following: ["user_1", "user_2", "user_3", "user_6"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 65 * 24 * hour,
      },
      {
        id: "user_5",
        name: "Sinta Maharani",
        username: "sinta_kuliner",
        email: "sinta@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=44",
        banner: createIllustrationDataUrl(
          "Rasa Nusantara",
          "Eksplorasi Kuliner & Resep Rumahan",
          "#ea580c",
          "#facc15",
          "🍜",
        ),
        bio: "Food Blogger & Chef Rumahan 🍲 Mengulas UMKM lokal dan resep praktis setiap hari! #KulinerNusantara #UMKM",
        location: "Surabaya, ID",
        website: "https://rasasinta.com",
        verified: false,
        isPrivate: false,
        followers: ["user_1", "user_3", "user_6", "user_7"],
        following: ["user_1", "user_3", "user_4", "user_6"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 54 * 24 * hour,
      },
      {
        id: "user_6",
        name: "Dimas Anggara",
        username: "dimas_startup",
        email: "dimas@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=68",
        banner: createIllustrationDataUrl(
          "Product & Growth",
          "Building Impactful Tech in Indonesia",
          "#4f46e5",
          "#06b6d4",
          "🚀",
        ),
        bio: "Founder & Product Manager 🚀 Diskusi seputar #Startup, #Produktivitas, dan pertumbuhan produk teknologi lokal.",
        location: "Jakarta Pusat, ID",
        website: "https://dimasanggara.co",
        verified: true,
        isPrivate: false,
        followers: ["user_1", "user_2", "user_4", "user_5", "user_8"],
        following: ["user_1", "user_2", "user_3", "user_9"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 48 * 24 * hour,
      },
      {
        id: "user_7",
        name: "Clara Wijaya",
        username: "clara_reads",
        email: "clara@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=25",
        banner: createIllustrationDataUrl(
          "Pojok Literasi",
          "Buku, Esai & Jurnal Harian",
          "#8b5cf6",
          "#ec4899",
          "📚",
        ),
        bio: "Pecinta buku non-fiksi, psikologi, dan sastra Indonesia 📚 Target baca tahun ini: 50 buku! #BukuKita #Literasi",
        location: "Malang, ID",
        website: "https://clarareads.blog",
        verified: false,
        isPrivate: false,
        followers: ["user_1", "user_3", "user_5", "user_9"],
        following: ["user_1", "user_2", "user_3", "user_8"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 40 * 24 * hour,
      },
      {
        id: "user_8",
        name: "Fajar Nugroho",
        username: "fajar_fit",
        email: "fajar@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=33",
        banner: createIllustrationDataUrl(
          "Run & Wellness",
          "Sehat Fisik & Mental Setiap Hari",
          "#10b981",
          "#047857",
          "🏃",
        ),
        bio: "Marathon Runner & Certified Fitness Coach 🏃‍♂️ Berbagi jadwal latihan, nutrisi seimbang, dan #HidupSehat.",
        location: "Semarang, ID",
        website: "https://fajarfit.id",
        verified: false,
        isPrivate: false,
        followers: ["user_1", "user_2", "user_6"],
        following: ["user_1", "user_3", "user_6", "user_7"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 30 * 24 * hour,
      },
      {
        id: "user_9",
        name: "Keisya Permata",
        username: "keisya_musik",
        email: "keisya@konekta.id",
        passwordHash: DEFAULT_PASSWORD_HASH,
        avatar: "https://i.pravatar.cc/150?img=49",
        banner: createIllustrationDataUrl(
          "Indie Acoustic",
          "Melodi & Ruang Kreatif",
          "#db2777",
          "#7c3aed",
          "🎸",
        ),
        bio: "Singer-Songwriter & Bedroom Producer 🎶 Rilis single akustik baru bulan ini. #MusikIndie #KreatorLokal",
        location: "Bandung, ID",
        website: "https://keisyamusic.id",
        verified: true,
        isPrivate: false,
        followers: ["user_1", "user_2", "user_3", "user_6", "user_7"],
        following: ["user_1", "user_2", "user_4", "user_7"],
        blockedUsers: [],
        mutedUsers: [],
        bookmarks: [],
        createdAt: now - 25 * 24 * hour,
      },
    ];

    // 2. Seed 22 Rich Posts with Hashtags, Mentions, Images & Comments
    const posts = [
      {
        id: "post_1",
        userId: "user_3",
        content:
          "Banyak orang mengira #LiterasiData itu cuma soal rumus statistik rumit. Padahal intinya adalah kemampuan membaca konteks, menguji asumsi, dan tidak mudah tertipu grafik yang menyesatkan! 📊✨ Setuju nggak @arif_hidayat @bima_dev?",
        images: [
          createIllustrationDataUrl(
            "Literasi Data 101",
            "Pahami Konteks Sebelum Menyimpulkan Grafik",
            "#059669",
            "#2563eb",
            "📊",
          ),
        ],
        likes: ["user_1", "user_2", "user_4", "user_6", "user_7"],
        reposts: ["user_1", "user_2"],
        bookmarks: ["user_2"],
        comments: [
          {
            id: "c_101",
            userId: "user_1",
            content:
              "Setuju banget Kak @alya_data! Di dunia #UIUX pun pemilihan jenis chart sangat menentukan pemahaman pengguna.",
            createdAt: now - 18 * min,
            replies: [
              {
                id: "r_101",
                userId: "user_3",
                content:
                  "Betul @arif_hidayat, kolaborasi analis data dan desainer visual itu kunci banget!",
                createdAt: now - 12 * min,
              },
            ],
          },
          {
            id: "c_102",
            userId: "user_2",
            content:
              "Siap mengimplementasikan visualisasi yang aksesibel di web! 🔥",
            createdAt: now - 10 * min,
            replies: [],
          },
        ],
        createdAt: now - 25 * min,
      },
      {
        id: "post_2",
        userId: "user_1",
        content:
          "Baru selesai merancang sistem desain (Design System) untuk aplikasi sosial komunitas! Fokus utamanya: kontras warna ramah mata, Dark Mode otomatis, dan navigasi satu jempol di mobile. #UIUX #WebDev #DesainProduk",
        images: [
          createIllustrationDataUrl(
            "Konekta Design System",
            "Komponen Modular, Responsif & Aksesibel",
            "#6366f1",
            "#ec4899",
            "🎨",
          ),
        ],
        likes: ["user_2", "user_3", "user_4", "user_5", "user_6", "user_9"],
        reposts: ["user_6"],
        bookmarks: ["user_3"],
        comments: [
          {
            id: "c_103",
            userId: "user_6",
            content:
              "Keren banget @arif_hidayat! Micro-interaction di tombol like-nya terasa hidup.",
            createdAt: now - 40 * min,
            replies: [],
          },
        ],
        createdAt: now - 52 * min,
      },
      {
        id: "post_3",
        userId: "user_2",
        content:
          "Tips #JavaScript hari ini: Gunakan IntersectionObserver untuk membuat fitur infinite scroll daripada memantau event scroll secara terus-menerus. Jauh lebih hemat baterai dan performa browser tetap mulus 60fps! ⚡💻 #WebDev",
        images: [],
        likes: ["user_1", "user_3", "user_6", "user_8"],
        reposts: ["user_1"],
        bookmarks: ["user_1", "user_6"],
        comments: [
          {
            id: "c_104",
            userId: "user_1",
            content:
              "Langsung di-bookmark @bima_dev! Sangat membantu buat optimasi halaman feed.",
            createdAt: now - 1.5 * hour,
            replies: [],
          },
        ],
        createdAt: now - 2 * hour,
      },
      {
        id: "post_4",
        userId: "user_4",
        content:
          "Kabut pagi menyelimuti perbukitan Bromo pukul 05.15 WIB. Cahaya keemasan pertama selalu punya cara sendiri untuk membuat kita bersyukur. 🌄📸 #Fotografi #Nusantara #PesonaIndonesia",
        images: [
          createIllustrationDataUrl(
            "Golden Hour Bromo",
            "Tengger Semeru, Jawa Timur • 05:15 WIB",
            "#f59e0b",
            "#7c2d12",
            "🌄",
          ),
        ],
        likes: ["user_1", "user_3", "user_5", "user_7", "user_9"],
        reposts: ["user_5"],
        bookmarks: [],
        comments: [
          {
            id: "c_105",
            userId: "user_5",
            content:
              "Tone warnanya hangat sekali @reza_lensa! Jadi kangen kulineran rawon hangat di Malang.",
            createdAt: now - 2.5 * hour,
            replies: [],
          },
        ],
        createdAt: now - 3 * hour,
      },
      {
        id: "post_5",
        userId: "user_5",
        content:
          "Makan siang hari ini: Soto Betawi kuah susu rempah buatan sendiri! Rahasia gurih tanpa eneg ada di cengkeh, kayu manis, dan perasan jeruk limau segar. Siapa yang mau resep lengkapnya? 🍲🍋 #KulinerNusantara #UMKM",
        images: [
          createIllustrationDataUrl(
            "Soto Betawi Rempah",
            "Resep Warisan Keluarga • Gurih & Hangat",
            "#ea580c",
            "#b45309",
            "🍲",
          ),
        ],
        likes: ["user_1", "user_4", "user_7", "user_8"],
        reposts: [],
        bookmarks: ["user_7"],
        comments: [],
        createdAt: now - 4 * hour,
      },
      {
        id: "post_6",
        userId: "user_6",
        content:
          "Dalam membangun #Startup, fitur yang paling sering dipakai pengguna biasanya justru 20% fitur inti yang paling sederhana dan cepat. Jangan terjebak membangun terlalu banyak menu yang membingungkan! 🚀 #Produktivitas #DesainProduk",
        images: [],
        likes: ["user_1", "user_2", "user_3"],
        reposts: ["user_2"],
        bookmarks: [],
        comments: [
          {
            id: "c_106",
            userId: "user_3",
            content:
              "Prinsip Pareto 80/20 memang terbukti di data analitik produk kami juga @dimas_startup!",
            createdAt: now - 4.5 * hour,
            replies: [],
          },
        ],
        createdAt: now - 5 * hour,
      },
      {
        id: "post_7",
        userId: "user_9",
        content:
          'Sesi rekaman akustik malam ini ditemani hujan rintik di Bandung. Lagu baru berjudul "Ruang Singgah" bercerita tentang pertemuan singkat yang mengubah cara pandang kita. 🎸🌧️ #MusikIndie #KreatorLokal',
        images: [
          createIllustrationDataUrl(
            'Sesi Rekaman "Ruang Singgah"',
            "Acoustic Studio Session • Bandung",
            "#db2777",
            "#4c1d95",
            "🎸",
          ),
        ],
        likes: ["user_1", "user_2", "user_4", "user_7"],
        reposts: ["user_7"],
        bookmarks: [],
        comments: [],
        createdAt: now - 6 * hour,
      },
      {
        id: "post_8",
        userId: "user_3",
        content:
          "3 Pertanyaan wajib sebelum membagikan infografis di media sosial:\n1. Dari mana sumber datanya?\n2. Berapa ukuran sampelnya?\n3. Apakah sumbu Y dimulai dari angka 0?\nMari budayakan #LiterasiData agar ruang digital makin sehat! 💡📊",
        images: [],
        likes: [
          "user_1",
          "user_2",
          "user_5",
          "user_6",
          "user_7",
          "user_8",
          "user_9",
        ],
        reposts: ["user_1", "user_6", "user_7"],
        bookmarks: ["user_1"],
        comments: [
          {
            id: "c_107",
            userId: "user_7",
            content:
              "Poin nomor 3 sering banget dipakai buat manipulasi visual! Terima kasih pengingatnya @alya_data.",
            createdAt: now - 7 * hour,
            replies: [],
          },
        ],
        createdAt: now - 8 * hour,
      },
      {
        id: "post_9",
        userId: "user_7",
        content:
          'Baru selesai membaca buku "Thinking, Fast and Slow". Sangat membuka mata tentang bagaimana bias kognitif memengaruhi keputusan harian kita dan cara kita menilai informasi. 📚✨ #BukuKita #Literasi #LiterasiData',
        images: [],
        likes: ["user_1", "user_3", "user_6"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 10 * hour,
      },
      {
        id: "post_10",
        userId: "user_8",
        content:
          "Lari pagi 10K keliling Simpang Lima selesai! Ingat teman-teman, konsistensi jauh lebih penting daripada kecepatan di awal. Jangan lupa hidrasi dan pemanasan 10 menit! 🏃‍♂️💧 #HidupSehat #Produktivitas",
        images: [
          createIllustrationDataUrl(
            "Morning Run 10.0 KM",
            "Pace 5:35 /km • Zona Kardio Optimal",
            "#10b981",
            "#065f46",
            "🏃",
          ),
        ],
        likes: ["user_1", "user_2", "user_6"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 12 * hour,
      },
      {
        id: "post_11",
        userId: "user_2",
        content:
          'Kenapa CSS Variables (`--color-primary`, dll.) wajib dipakai di proyek modern? Karena kita bisa mengganti seluruh tema aplikasi dari Light ke Dark Mode hanya dengan mengubah satu atribut `data-theme="dark"` di elemen root! 🎨⚡ #WebDev #CSS #UIUX',
        images: [],
        likes: ["user_1", "user_3", "user_4", "user_6"],
        reposts: ["user_1"],
        bookmarks: [],
        comments: [],
        createdAt: now - 15 * hour,
      },
      {
        id: "post_12",
        userId: "user_1",
        content:
          "Eksperimen tipografi hari ini: memadukan font Poppins untuk judul yang tegas dan Inter untuk teks paragraf panjang. Keterbacaan di layar kecil meningkat drastis! Gimana menurut kalian? #UIUX #DesainProduk",
        images: [],
        likes: ["user_2", "user_3", "user_7", "user_9"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 18 * hour,
      },
      {
        id: "post_13",
        userId: "user_5",
        content:
          "Kopi susu gula aren dingin + pisang goreng hangat sore-sore sambil merapikan jadwal konten minggu depan. Dukung terus kedai kopi #UMKM di sekitar rumah kita yuk! ☕🍌 #KulinerNusantara",
        images: [],
        likes: ["user_1", "user_2", "user_4", "user_9"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 21 * hour,
      },
      {
        id: "post_14",
        userId: "user_4",
        content:
          "Tips memotret pakai kamera HP: aktifkan garis bantu (grid 3x3), bersihkan lensa sebelum memotret, dan cari arah cahaya samping untuk tekstur yang lebih berdimensi. 📸✨ #Fotografi #KreatorLokal",
        images: [],
        likes: ["user_1", "user_5", "user_7", "user_9"],
        reposts: ["user_9"],
        bookmarks: [],
        comments: [],
        createdAt: now - 24 * hour,
      },
      {
        id: "post_15",
        userId: "user_6",
        content:
          "Metode kerja Deep Work 90 menit tanpa distraksi notifikasi benar-benar meningkatkan output tim kami minggu ini. Berani coba matikan notifikasi saat jam fokus? 🎯 #Produktivitas #Startup",
        images: [],
        likes: ["user_2", "user_3", "user_8"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 28 * hour,
      },
      {
        id: "post_16",
        userId: "user_3",
        content:
          "Dataset publik Indonesia sekarang makin mudah diakses untuk latihan proyek mahasiswa! Gunakan data cuaca, transportasi, atau harga pangan untuk melatih kemampuan eksplorasi data kalian. 📈🇮🇩 #LiterasiData #AI #WebDev",
        images: [],
        likes: ["user_1", "user_2", "user_6", "user_7"],
        reposts: ["user_2"],
        bookmarks: [],
        comments: [],
        createdAt: now - 32 * hour,
      },
      {
        id: "post_17",
        userId: "user_9",
        content:
          "Terima kasih buat 10.000 pendengar pertama lagu akustik minggu lalu! Dukungan teman-teman di Konekta bikin semangat berkarya terus. 💜🎶 #MusikIndie #KreatorLokal",
        images: [],
        likes: ["user_1", "user_2", "user_4", "user_5", "user_7"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 36 * hour,
      },
      {
        id: "post_18",
        userId: "user_7",
        content:
          "Membaca 15 halaman setiap malam sebelum tidur jauh lebih menenangkan pikiran dibanding scrolling tanpa arah. Buku apa yang sedang ada di meja samping tempat tidurmu? 📖🌙 #BukuKita #HidupSehat",
        images: [],
        likes: ["user_1", "user_3", "user_8", "user_9"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 40 * hour,
      },
      {
        id: "post_19",
        userId: "user_8",
        content:
          "Duduk berjam-jam di depan laptop bikin punggung kaku? Coba berdiri dan lakukan peregangan bahu selama 2 menit setiap 1 jam kerja ya @bima_dev @arif_hidayat! 💪🧘‍♂️ #HidupSehat #Produktivitas",
        images: [],
        likes: ["user_1", "user_2", "user_3"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 45 * hour,
      },
      {
        id: "post_20",
        userId: "user_2",
        content:
          "Keamanan aplikasi Front-End itu penting! Selalu sanitasi input pengguna sebelum merender ke DOM untuk mencegah serangan XSS (Cross-Site Scripting). 🛡️🔒 #JavaScript #WebDev",
        images: [],
        likes: ["user_1", "user_3", "user_6"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 50 * hour,
      },
      {
        id: "post_21",
        userId: "user_1",
        content:
          "Senang sekali melihat komunitas #LiterasiData dan #UIUX di Konekta makin ramai berdiskusi minggu ini! Yuk perkenalkan diri kalian di kolom komentar! 👋✨",
        images: [],
        likes: [
          "user_2",
          "user_3",
          "user_4",
          "user_5",
          "user_6",
          "user_7",
          "user_8",
          "user_9",
        ],
        reposts: ["user_3"],
        bookmarks: [],
        comments: [],
        createdAt: now - 55 * hour,
      },
      {
        id: "post_22",
        userId: "user_4",
        content:
          "Senja di Pelabuhan Sunda Kelapa sore tadi. Siluet kapal pinisi yang berjajar selalu menyimpan cerita sejarah bahari yang megah. ⛵🌅 #Fotografi #Nusantara",
        images: [
          createIllustrationDataUrl(
            "Senja Sunda Kelapa",
            "Siluet Kapal Pinisi • Jakarta Utara",
            "#7c2d12",
            "#1e1b4b",
            "⛵",
          ),
        ],
        likes: ["user_1", "user_2", "user_5", "user_6"],
        reposts: [],
        bookmarks: [],
        comments: [],
        createdAt: now - 60 * hour,
      },
    ];

    // 3. Seed Active Stories (< 24 hours old)
    const stories = [
      {
        id: "story_1",
        userId: "user_3",
        image: createIllustrationDataUrl(
          "Workshop Literasi Data",
          "Live Session Pukul 19.00 WIB Malam Ini!",
          "#059669",
          "#1d4ed8",
          "📊",
        ),
        caption:
          "Jangan lupa gabung diskusi #LiterasiData malam ini ya teman-teman! 🚀",
        viewers: ["user_2"],
        createdAt: now - 2 * hour,
      },
      {
        id: "story_2",
        userId: "user_2",
        image: createIllustrationDataUrl(
          "Setup Kerja Pagi Ini",
          "Vanilla JS + Kopi Arabika Gayo ☕",
          "#1e293b",
          "#4f46e5",
          "💻",
        ),
        caption: "Menulis kode murni tanpa framework rasanya segar banget! ⚡",
        viewers: [],
        createdAt: now - 4 * hour,
      },
      {
        id: "story_3",
        userId: "user_4",
        image: createIllustrationDataUrl(
          "Menuju Puncak Ijen",
          "Pendakian Malam Mengejar Blue Fire 🔥",
          "#0f172a",
          "#0284c7",
          "🏔️",
        ),
        caption: "Suhu 11 derajat Celcius di Kawah Ijen! Doakan cuaca cerah 📸",
        viewers: ["user_1"],
        createdAt: now - 6 * hour,
      },
      {
        id: "story_4",
        userId: "user_5",
        image: createIllustrationDataUrl(
          "Eksperimen Dapur Sinta",
          "Membuat Klepon Lumer Gula Merah 🍡",
          "#15803d",
          "#ca8a04",
          "🍡",
        ),
        caption:
          "Jajanan pasar favorit sepanjang masa! Siapa yang suka klepon?",
        viewers: [],
        createdAt: now - 7 * hour,
      },
      {
        id: "story_5",
        userId: "user_9",
        image: createIllustrationDataUrl(
          "Lirik Lagu Baru",
          "Draf Akustik Malam Minggu 🎶",
          "#9d174d",
          "#4c1d95",
          "🎵",
        ),
        caption: "Masih mencari kord jembatan (bridge) yang pas nih 🎸",
        viewers: [],
        createdAt: now - 9 * hour,
      },
    ];

    // 4. Seed Chat Conversations
    const conversations = [
      {
        id: "conv_1",
        participants: ["user_1", "user_3"],
        messages: [
          {
            id: "msg_1",
            senderId: "user_3",
            text: "Halo Arif! Desain palet warna untuk infografis #LiterasiData kemarin keren banget.",
            createdAt: now - 3 * hour,
            read: true,
          },
          {
            id: "msg_2",
            senderId: "user_1",
            text: "Terima kasih Alya! Senang banget bisa bantu bikin datanya lebih mudah dibaca teman-teman 😊",
            createdAt: now - 2.8 * hour,
            read: true,
          },
          {
            id: "msg_3",
            senderId: "user_3",
            text: "Minggu depan kita kolaborasi bikin utas (thread) bareng lagi yuk tentang visualisasi data interaktif!",
            createdAt: now - 35 * min,
            read: false,
          },
        ],
        updatedAt: now - 35 * min,
      },
      {
        id: "conv_2",
        participants: ["user_1", "user_2"],
        messages: [
          {
            id: "msg_4",
            senderId: "user_2",
            text: "Hai Rif, komponen modal dan dark mode di CSS Variables sudah siap diintegrasikan nih!",
            createdAt: now - 5 * hour,
            read: true,
          },
          {
            id: "msg_5",
            senderId: "user_1",
            text: "Mantap Bima! Transisi warnanya sudah halus kan waktu pindah dari Light ke Dark?",
            createdAt: now - 4.7 * hour,
            read: true,
          },
          {
            id: "msg_6",
            senderId: "user_2",
            text: "Sudah dong, 250ms cubic-bezier sesuai spesifikasi figma kamu! ⚡",
            createdAt: now - 4.5 * hour,
            read: true,
          },
        ],
        updatedAt: now - 4.5 * hour,
      },
      {
        id: "conv_3",
        participants: ["user_1", "user_6"],
        messages: [
          {
            id: "msg_7",
            senderId: "user_6",
            text: "Halo Arif, apakah akhir pekan ini luang untuk jadi pembicara tamu di komunitas Product Design Jakarta?",
            createdAt: now - 14 * hour,
            read: false,
          },
        ],
        updatedAt: now - 14 * hour,
      },
    ];

    // 5. Seed Notifications for Default Demo User (user_1)
    const notifications = [
      {
        id: "notif_1",
        userId: "user_1",
        actorId: "user_3",
        type: "mention",
        postId: "post_1",
        text: "menyebut Anda dalam sebuah postingan tentang #LiterasiData",
        read: false,
        createdAt: now - 25 * min,
      },
      {
        id: "notif_2",
        userId: "user_1",
        actorId: "user_6",
        type: "comment",
        postId: "post_2",
        text: 'mengomentari postingan Anda: "Keren banget @arif_hidayat! Micro-interaction di tombol like-nya terasa hidup."',
        read: false,
        createdAt: now - 40 * min,
      },
      {
        id: "notif_3",
        userId: "user_1",
        actorId: "user_2",
        type: "like",
        postId: "post_2",
        text: "menyukai postingan Anda tentang Design System",
        read: false,
        createdAt: now - 48 * min,
      },
      {
        id: "notif_4",
        userId: "user_1",
        actorId: "user_9",
        type: "follow",
        postId: null,
        text: "mulai mengikuti Anda",
        read: true,
        createdAt: now - 3 * hour,
      },
      {
        id: "notif_5",
        userId: "user_1",
        actorId: "user_6",
        type: "repost",
        postId: "post_2",
        text: "membagikan ulang (repost) postingan Anda",
        read: true,
        createdAt: now - 4 * hour,
      },
    ];

    window.Storage.set(window.STORAGE_KEYS.USERS, users);
    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);
    window.Storage.set(window.STORAGE_KEYS.STORIES, stories);
    window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, conversations);
    window.Storage.set(window.STORAGE_KEYS.NOTIFICATIONS, notifications);
    window.Storage.set(window.STORAGE_KEYS.REPORTS, []);
    window.Storage.set(window.STORAGE_KEYS.SEEDED, true);
  }
}

window.Seed = new SeedService();
