/**
 * ==========================================================================
 * CHAT.JS - Simulated Real-Time Messaging, Emoji Picker, Typing Indicator,
 * Read Receipts (✓✓) & Contextual Dummy Bot Auto-Responder
 * ==========================================================================
 */

const POPULAR_EMOJIS = [
  "😊",
  "😂",
  "🔥",
  "❤️",
  "✨",
  "👍",
  "🙌",
  "🎉",
  "🚀",
  "💡",
  "📊",
  "💻",
  "🎨",
  "☕",
  "🍜",
  "📸",
  "🎸",
  "📚",
  "🙏",
  "😎",
  "🤔",
  "💯",
  "🌟",
  "👋",
];

class ChatService {
  /**
   * Get all conversations involving a specific user sorted by recent activity
   * @param {string} userId
   * @returns {Array<Object>}
   */
  getConversationsForUser(userId) {
    if (!userId) return [];
    const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
    return all
      .filter(
        (c) => Array.isArray(c.participants) && c.participants.includes(userId),
      )
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  /**
   * Count total unread messages across all conversations for a user
   * @param {string} userId
   * @returns {number}
   */
  getUnreadCount(userId) {
    if (!userId) return 0;
    const convs = this.getConversationsForUser(userId);
    let unread = 0;
    convs.forEach((c) => {
      (c.messages || []).forEach((m) => {
        if (m.senderId !== userId && !m.read) {
          unread++;
        }
      });
    });
    return unread;
  }

  /**
   * Find existing conversation between current user and target user, or create one
   * @param {string} targetUserId
   * @returns {Object|null}
   */
  getOrCreateConversation(targetUserId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser || !targetUserId || currentUser.id === targetUserId)
      return null;

    const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
    let conv = all.find(
      (c) =>
        c.participants.includes(currentUser.id) &&
        c.participants.includes(targetUserId),
    );

    if (!conv) {
      conv = {
        id: window.Storage.generateId("conv"),
        participants: [currentUser.id, targetUserId],
        messages: [],
        updatedAt: Date.now(),
      };
      all.unshift(conv);
      window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, all);
    }

    return conv;
  }

  /**
   * Get a conversation by ID
   * @param {string} convId
   * @returns {Object|null}
   */
  getById(convId) {
    const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
    return all.find((c) => c.id === convId) || null;
  }

  /**
   * Mark all incoming messages in a conversation as read
   * @param {string} convId
   */
  markAsRead(convId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return;

    const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
    const conv = all.find((c) => c.id === convId);
    if (!conv) return;

    let changed = false;
    (conv.messages || []).forEach((m) => {
      if (m.senderId !== currentUser.id && !m.read) {
        m.read = true;
        changed = true;
      }
    });

    if (changed) {
      window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, all);
      if (window.UI) window.UI.updateNavBadges();
    }
  }

  /**
   * Send a message in a conversation
   * @param {string} convId
   * @param {string} text
   * @returns {Object|null}
   */
  sendMessage(convId, text) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    const clean = String(text || "").trim();
    if (!currentUser || !clean) return null;

    const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
    const conv = all.find((c) => c.id === convId);
    if (!conv) return null;

    const newMsg = {
      id: window.Storage.generateId("msg"),
      senderId: currentUser.id,
      text: clean,
      createdAt: Date.now(),
      read: false,
    };

    conv.messages = conv.messages || [];
    conv.messages.push(newMsg);
    conv.updatedAt = Date.now();
    window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, all);

    return newMsg;
  }

  /**
   * Delete a conversation history
   * @param {string} convId
   */
  deleteConversation(convId) {
    const all = window.Storage.get(
      window.STORAGE_KEYS.CONVERSATIONS,
      [],
    ).filter((c) => c.id !== convId);
    window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, all);
    if (window.UI) window.UI.updateNavBadges();
  }

  /**
   * Generate a contextual Indonesian auto-reply based on the partner user's persona
   * @param {Object} partnerUser
   * @param {string} incomingText
   * @returns {string}
   */
  generateContextualReply(partnerUser, incomingText) {
    const lower = String(incomingText || "").toLowerCase();
    const uname = partnerUser ? partnerUser.username : "";

    if (
      lower.includes("halo") ||
      lower.includes("hai") ||
      lower.includes("pagi") ||
      lower.includes("malam")
    ) {
      return `Halo juga! 👋 Senang dapat pesan darimu di Konekta. Gimana kabarnya hari ini?`;
    }

    if (lower.includes("terima kasih") || lower.includes("makasih")) {
      return `Sama-sama! Senang bisa saling berbagi dan diskusi bareng kamu 😊✨`;
    }

    const personaReplies = {
      nadia_putri: [
        "Wah menarik banget! Kalau dari sisi UI/UX, kita bisa pakai hirarki tipografi yang jelas supaya pengguna langsung paham. 🎨✨",
        "Setuju! Aku juga lagi eksplorasi komponen kartu yang responsif buat layar mobile nih.",
        "Boleh banget! Nanti kirim draf desainnya ya, kita ulas bareng-bareng 😊",
      ],
      bima_dev: [
        "Siap! Kalau pakai Vanilla JavaScript murni dan CSS Variables, performanya dijamin kencang banget tanpa overhead. ⚡💻",
        "Ide bagus! Pastikan juga semua input disanitasi biar aman dari XSS ya.",
        "Mantap! Aku baru selesai refactoring modul localStorage dan IndexedDB sore ini.",
      ],
      alya_data: [
        "Kalau kita lihat dari perspektif #LiterasiData, penting banget buat cek distribusi datanya dulu sebelum ambil kesimpulan 📊💡",
        "Wah topik yang seru! Kebetulan aku lagi nyiapin materi visualisasi data buat akhir pekan ini.",
        "Betul banget! Data yang akurat + visual yang jujur itu kombinasi terbaik.",
      ],
      reza_lensa: [
        "Cahaya sore hari sekitar jam 16.30–17.30 itu waktu favoritku buat ambil foto potret maupun jalanan! 📸🌅",
        "Wah jadi pengin bawa kamera ke sana akhir bulan ini!",
        "Terima kasih apresiasinya! Yuk kapan-kapan hunting foto bareng.",
      ],
      sinta_kuliner: [
        "Wah jadi lapar nih! 🍜 Kalau ditambah sambal bawang hangat pasti makin mantap rasanya.",
        "Jangan lupa cobain resep terbaruku di beranda ya, bumbunya gampang dicari kok! 🍲✨",
        "Setuju! UMKM kuliner lokal kita memang juara soal cita rasa rempah.",
      ],
      dimas_startup: [
        "Dari kacamata produk, fokus ke masalah utama pengguna itu selalu jadi prioritas nomor satu! 🚀",
        "Menarik! Yuk kita jadwalkan sesi brainstorming singkat minggu depan.",
        "Setuju! Eksekusi yang konsisten jauh mengalahkan rencana yang cuma di atas kertas.",
      ],
      clara_reads: [
        "Aku baru aja baca bab tentang itu! Bukunya sangat membuka wawasan baru 📚✨",
        "Wah masuk daftar bacaanku bulan depan nih! Terima kasih rekomendasinya ya.",
        "Setuju banget, meluangkan 20 menit sehari buat membaca itu investasi terbaik.",
      ],
      fajar_fit: [
        "Semangat! Jangan lupa istirahat cukup dan minum air putih minimal 2 liter hari ini ya 🏃‍♂️💧",
        "Konsistensi latihan ringan setiap hari jauh lebih bagus daripada langsung berat tapi cedera! 💪",
        "Mantap! Besok pagi kita lari 5K santai yuk!",
      ],
      keisya_musik: [
        "Wah terima kasih banyak! Doakan proses mixing lagu akustik baruku lancar minggu ini ya 🎸🎶",
        "Musik memang teman paling pas buat nemenin waktu kerja atau belajar sore-sore ✨",
        "Nanti kalau lagunya udah rilis, kamu orang pertama yang kukabari ya!",
      ],
    };

    const pool = personaReplies[uname] || [
      "Wah menarik sekali! Terima kasih sudah berbagi cerita di Konekta 😊✨",
      "Setuju banget dengan pendapatmu! Yuk lanjut diskusi di beranda juga.",
      "Siap, kabar-kabari lagi ya kalau ada update terbaru! 👍",
    ];

    return pool[Math.floor(Math.random() * pool.length)];
  }

  /**
   * Simulate partner reading message (✓✓), typing indicator, and sending auto-reply
   * @param {Object} params
   * @param {string} params.convId
   * @param {Object} params.partnerUser
   * @param {string} params.userText
   * @param {Function} params.onReadReceipt
   * @param {Function} params.onTypingStart
   * @param {Function} params.onReplyArrived
   */
  simulatePartnerResponse({
    convId,
    partnerUser,
    userText,
    onReadReceipt,
    onTypingStart,
    onReplyArrived,
  }) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser || !partnerUser) return;

    // Step 1: Mark user's sent messages as read (✓✓) after 600ms
    setTimeout(() => {
      const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
      const conv = all.find((c) => c.id === convId);
      if (conv) {
        (conv.messages || []).forEach((m) => {
          if (m.senderId === currentUser.id) {
            m.read = true;
          }
        });
        window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, all);
        if (typeof onReadReceipt === "function") onReadReceipt();
      }
    }, 600);

    // Step 2: Show typing indicator after 900ms
    setTimeout(() => {
      if (typeof onTypingStart === "function") onTypingStart(partnerUser);
    }, 900);

    // Step 3: Deliver contextual reply after 2400ms
    setTimeout(() => {
      const replyText = this.generateContextualReply(partnerUser, userText);
      const all = window.Storage.get(window.STORAGE_KEYS.CONVERSATIONS, []);
      const conv = all.find((c) => c.id === convId);
      if (!conv) return;

      const isCurrentlyOnMessagesPage =
        window.location.pathname.endsWith("messages.html") &&
        window.activeChatConvId === convId;

      const botMsg = {
        id: window.Storage.generateId("msg"),
        senderId: partnerUser.id,
        text: replyText,
        createdAt: Date.now(),
        read: Boolean(isCurrentlyOnMessagesPage),
      };

      conv.messages.push(botMsg);
      conv.updatedAt = Date.now();
      window.Storage.set(window.STORAGE_KEYS.CONVERSATIONS, all);

      if (window.UI) window.UI.updateNavBadges();
      if (typeof onReplyArrived === "function") onReplyArrived(botMsg);
    }, 2400);
  }

  /**
   * Return list of emojis for emoji picker
   * @returns {Array<string>}
   */
  getEmojis() {
    return POPULAR_EMOJIS;
  }
}

window.Chat = new ChatService();
