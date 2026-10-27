/**
 * ==========================================================================
 * AUTH.JS - Authentication, SHA-256 Hashing, Form Validation & Session Guard
 * ==========================================================================
 */

class AuthService {
  /**
   * Hash password string using SHA-256 via Web Crypto API
   * Includes pure-JS SHA-256 fallback when opened via file:// non-secure context
   * @param {string} message
   * @returns {Promise<string>} 64-char hex digest
   */
  async hashPassword(message) {
    const text = String(message || "");
    if (window.crypto && window.crypto.subtle) {
      try {
        const msgBuffer = new TextEncoder().encode(text);
        const hashBuffer = await window.crypto.subtle.digest(
          "SHA-256",
          msgBuffer,
        );
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
      } catch {
        return this.sha256Fallback(text);
      }
    }
    return this.sha256Fallback(text);
  }

  /**
   * Standard SHA-256 implementation in pure JS for file:// compatibility
   * @param {string} ascii
   * @returns {string}
   */
  sha256Fallback(ascii) {
    const rightRotate = (value, amount) =>
      (value >>> amount) | (value << (32 - amount));
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    const lengthProperty = "length";
    let i, j;
    let result = "";

    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;

    let hash = (this.sha256Fallback.h = this.sha256Fallback.h || []);
    const k = (this.sha256Fallback.k = this.sha256Fallback.k || []);
    let primeCounter = k[lengthProperty];

    const isComposite = {};
    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (!isComposite[candidate]) {
        for (i = 0; i < 313; i += candidate) {
          isComposite[i] = candidate;
        }
        hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
      }
    }

    ascii += "\x80";
    while ((ascii[lengthProperty] % 64) - 56) ascii += "\x00";
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      if (j >> 8) return "";
      words[i >> 2] |= j << ((3 - (i % 4)) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;

    for (j = 0; j < words[lengthProperty]; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        const i2 = i + j;
        const w15 = w[i - 15],
          w2 = w[i - 2];

        const a = hash[0],
          e = hash[4];
        const temp1 =
          hash[7] +
          (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
          ((e & hash[5]) ^ (~e & hash[6])) +
          k[i] +
          (w[i] =
            i < 16
              ? w[i]
              : (w[i - 16] +
                  (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                  w[i - 7] +
                  (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
                0);
        const temp2 =
          (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
          ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (j = 3; j + 1; j--) {
        const b = (hash[i] >> (j * 8)) & 255;
        result += (b < 16 ? 0 : "") + b.toString(16);
      }
    }
    return result;
  }

  /**
   * Retrieve currently logged-in user object from storage
   * @returns {Object|null}
   */
  getCurrentUser() {
    const session = window.Storage.get(window.STORAGE_KEYS.SESSION, null);
    if (!session || !session.userId) return null;

    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []);
    return users.find((u) => u.id === session.userId) || null;
  }

  /**
   * Save active user session
   * @param {string} userId
   */
  setSession(userId) {
    window.Storage.set(window.STORAGE_KEYS.SESSION, {
      userId,
      loginAt: Date.now(),
    });
  }

  /**
   * Redirect to index.html if user is not logged in
   * @returns {Object|null}
   */
  requireAuth() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = "index.html";
      return null;
    }
    return user;
  }

  /**
   * Redirect to home.html if user is already logged in (used on index.html)
   */
  redirectIfAuthenticated() {
    const user = this.getCurrentUser();
    if (user) {
      window.location.href = "home.html";
    }
  }

  /**
   * Validate and register a new user account
   * @param {Object} payload
   * @returns {Promise<{ok: boolean, errors?: Object, user?: Object}>}
   */
  async register({ name, username, email, password, confirmPassword }) {
    const errors = {};
    const cleanName = String(name || "").trim();
    const cleanUsername = String(username || "")
      .trim()
      .toLowerCase();
    const cleanEmail = String(email || "")
      .trim()
      .toLowerCase();

    if (cleanName.length < 3) {
      errors.name = "Nama lengkap minimal 3 karakter.";
    }

    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) {
      errors.username =
        "Username harus 3-20 karakter dan hanya boleh huruf kecil, angka, atau garis bawah (_).";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      errors.email = "Format alamat email tidak valid.";
    }

    if (!password || password.length < 6) {
      errors.password = "Password minimal 6 karakter.";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Konfirmasi password tidak cocok.";
    }

    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []);
    if (
      !errors.username &&
      users.some((u) => u.username.toLowerCase() === cleanUsername)
    ) {
      errors.username = "Username ini sudah digunakan oleh pengguna lain.";
    }

    if (
      !errors.email &&
      users.some((u) => u.email.toLowerCase() === cleanEmail)
    ) {
      errors.email = "Alamat email ini sudah terdaftar.";
    }

    if (Object.keys(errors).length > 0) {
      return { ok: false, errors };
    }

    const passwordHash = await this.hashPassword(password);
    const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(
      cleanName,
    )}&background=6366f1&color=fff&bold=true&size=150`;

    const newUser = {
      id: window.Storage.generateId("user"),
      name: cleanName,
      username: cleanUsername,
      email: cleanEmail,
      passwordHash,
      avatar: avatarUrl,
      banner: "",
      bio: "Halo! Saya baru bergabung di komunitas Konekta ✨",
      location: "Indonesia",
      website: "",
      verified: false,
      isPrivate: false,
      followers: ["user_1"],
      following: ["user_1", "user_2", "user_3"],
      blockedUsers: [],
      mutedUsers: [],
      bookmarks: [],
      createdAt: Date.now(),
    };

    // Also add newUser to user_1, user_2, user_3 followers list
    users.forEach((u) => {
      if (["user_1", "user_2", "user_3"].includes(u.id)) {
        if (!u.followers.includes(newUser.id)) {
          u.followers.push(newUser.id);
        }
      }
      if (u.id === "user_1" && !u.following.includes(newUser.id)) {
        u.following.push(newUser.id);
      }
    });

    users.push(newUser);
    window.Storage.set(window.STORAGE_KEYS.USERS, users);
    this.setSession(newUser.id);

    // Send a welcome notification from Nadia Putri
    if (window.Notifications) {
      window.Notifications.create({
        userId: newUser.id,
        actorId: "user_1",
        type: "follow",
        text: "mulai mengikuti Anda. Selamat datang di Konekta!",
      });
    }

    return { ok: true, user: newUser };
  }

  /**
   * Authenticate user with username/email and password
   * @param {Object} credentials
   * @returns {Promise<{ok: boolean, error?: string, user?: Object}>}
   */
  async login({ identifier, password }) {
    const cleanId = String(identifier || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");

    if (!cleanId || !password) {
      return { ok: false, error: "Masukkan username/email dan password Anda." };
    }

    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []);
    const user = users.find(
      (u) =>
        u.username.toLowerCase() === cleanId ||
        u.email.toLowerCase() === cleanId ||
        u.name.toLowerCase() === cleanId ||
        (u.username === "arif_hidayat" &&
          (cleanId === "arif hidayat" || cleanId === "arifhidayat123")),
    );

    if (!user) {
      return {
        ok: false,
        error:
          "Akun tidak ditemukan. Periksa kembali username atau email Anda.",
      };
    }

    const inputHash = await this.hashPassword(password);
    const isPasswordValid =
      user.passwordHash === inputHash ||
      (user.password && user.password === password);

    if (!isPasswordValid) {
      return { ok: false, error: "Password yang Anda masukkan salah." };
    }

    // Upgrade plain password from seed config to SHA-256 hash automatically
    if (user.password) {
      user.passwordHash = inputHash;
      delete user.password;
      window.Storage.set(window.STORAGE_KEYS.USERS, users);
    }

    this.setSession(user.id);
    return { ok: true, user };
  }

  /**
   * Quick 1-click login for demo accounts on index.html
   * @param {string} username
   */
  loginDemo(username) {
    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []);
    const user = users.find((u) => u.username === username);
    if (user) {
      this.setSession(user.id);
      window.location.href = "home.html";
    }
  }

  /**
   * End current user session and redirect to login page
   */
  logout() {
    window.Storage.remove(window.STORAGE_KEYS.SESSION);
    window.location.href = "index.html";
  }

  /**
   * Bind show/hide password toggle buttons across a container or document
   * @param {HTMLElement|Document} root
   */
  bindPasswordToggles(root = document) {
    root.querySelectorAll("[data-toggle-password]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-toggle-password");
        const input = document.getElementById(targetId);
        if (!input) return;

        const isPassword = input.type === "password";
        input.type = isPassword ? "text" : "password";

        const icon = btn.querySelector("i");
        if (icon) {
          icon.className = isPassword
            ? "fa-regular fa-eye-slash"
            : "fa-regular fa-eye";
        }
        btn.setAttribute(
          "aria-label",
          isPassword ? "Sembunyikan password" : "Tampilkan password",
        );
      });
    });
  }

  /**
   * Update password for current user
   * @param {string} currentPassword
   * @param {string} newPassword
   * @returns {Promise<{ok: boolean, message: string}>}
   */
  async updatePassword(currentPassword, newPassword) {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return { ok: false, message: "Sesi tidak ditemukan." };

    const currentHash = await this.hashPassword(currentPassword);
    const matchesCurrent =
      currentHash === currentUser.passwordHash ||
      (currentUser.password && currentPassword === currentUser.password);
    if (!matchesCurrent) {
      return { ok: false, message: "Password saat ini tidak sesuai." };
    }

    if (!newPassword || newPassword.length < 6) {
      return { ok: false, message: "Password baru minimal harus 6 karakter." };
    }

    const newHash = await this.hashPassword(newPassword);
    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []);
    const idx = users.findIndex((u) => u.id === currentUser.id);
    if (idx !== -1) {
      users[idx].passwordHash = newHash;
      window.Storage.set(window.STORAGE_KEYS.USERS, users);
    }

    return { ok: true, message: "Password berhasil diperbarui!" };
  }

  /**
   * Delete current user's account and associated content
   */
  deleteCurrentAccount() {
    const currentUser = this.getCurrentUser();
    if (!currentUser) return;

    const uid = currentUser.id;

    // 1. Remove user and clean followers/following references
    const users = window.Storage.get(window.STORAGE_KEYS.USERS, [])
      .filter((u) => u.id !== uid)
      .map((u) => ({
        ...u,
        followers: (u.followers || []).filter((id) => id !== uid),
        following: (u.following || []).filter((id) => id !== uid),
      }));
    window.Storage.set(window.STORAGE_KEYS.USERS, users);

    // 2. Remove user's posts and comments
    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, [])
      .filter((p) => p.userId !== uid)
      .map((p) => ({
        ...p,
        likes: (p.likes || []).filter((id) => id !== uid),
        reposts: (p.reposts || []).filter((id) => id !== uid),
        bookmarks: (p.bookmarks || []).filter((id) => id !== uid),
        comments: (p.comments || []).filter((c) => c.userId !== uid),
      }));
    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);

    // 3. Remove user's stories
    const stories = window.Storage.get(window.STORAGE_KEYS.STORIES, []).filter(
      (s) => s.userId !== uid,
    );
    window.Storage.set(window.STORAGE_KEYS.STORIES, stories);

    // 4. Logout
    this.logout();
  }
}

window.Auth = new AuthService();
