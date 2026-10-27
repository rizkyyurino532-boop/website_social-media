/**
 * ==========================================================================
 * UI.JS - User Interface Utilities, Theme Manager, Modals, Toasts & Navigation
 * ==========================================================================
 */

class UIService {
  constructor() {
    this.activeModal = null;
    this.initTheme();
  }

  /**
   * Initialize and apply saved theme or system preference
   */
  initTheme() {
    const savedTheme = window.Storage.get(window.STORAGE_KEYS.THEME, "system");
    this.applyTheme(savedTheme, false);

    // Listen for OS theme changes when in 'system' mode
    if (window.matchMedia) {
      window
        .matchMedia("(prefers-color-scheme: dark)")
        .addEventListener("change", () => {
          const currentPref = window.Storage.get(
            window.STORAGE_KEYS.THEME,
            "system",
          );
          if (currentPref === "system") {
            this.applyTheme("system", false);
          }
        });
    }
  }

  /**
   * Apply 'light', 'dark', or 'system' theme
   * @param {'light'|'dark'|'system'} preference
   * @param {boolean} persist
   */
  applyTheme(preference = "system", persist = true) {
    if (persist) {
      window.Storage.set(window.STORAGE_KEYS.THEME, preference);
    }

    let effectiveTheme = preference;
    if (preference === "system") {
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      effectiveTheme = prefersDark ? "dark" : "light";
    }

    document.documentElement.setAttribute("data-theme", effectiveTheme);
    this.updateThemeToggleIcons(effectiveTheme);
  }

  /**
   * Toggle between dark and light theme quickly
   */
  toggleTheme() {
    const currentAttr =
      document.documentElement.getAttribute("data-theme") || "light";
    const nextTheme = currentAttr === "dark" ? "light" : "dark";
    this.applyTheme(nextTheme, true);
    this.showToast(
      `Tema diubah ke mode ${nextTheme === "dark" ? "Gelap (Dark)" : "Terang (Light)"}`,
      "info",
    );
  }

  /**
   * Update theme toggle button icons in the DOM
   * @param {string} effectiveTheme
   */
  updateThemeToggleIcons(effectiveTheme) {
    const icons = document.querySelectorAll("[data-theme-icon]");
    icons.forEach((icon) => {
      icon.className =
        effectiveTheme === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    });
  }

  /**
   * Display a floating Toast notification
   * @param {string} message
   * @param {'success'|'error'|'warning'|'info'} type
   * @param {number} duration
   */
  showToast(message, type = "info", duration = 3500) {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.className = "toast-container";
      container.setAttribute("aria-live", "polite");
      document.body.appendChild(container);
    }

    const iconMap = {
      success: "fa-solid fa-circle-check",
      error: "fa-solid fa-circle-exclamation",
      warning: "fa-solid fa-triangle-exclamation",
      info: "fa-solid fa-bell",
    };

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");

    const iconEl = document.createElement("i");
    iconEl.className = `${iconMap[type] || iconMap.info} toast-icon`;

    const contentEl = document.createElement("div");
    contentEl.className = "toast-content";
    contentEl.textContent = message;

    const closeBtn = document.createElement("button");
    closeBtn.className = "btn-icon";
    closeBtn.style.width = "26px";
    closeBtn.style.height = "26px";
    closeBtn.setAttribute("aria-label", "Tutup notifikasi");
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    closeBtn.addEventListener("click", () => toast.remove());

    toast.appendChild(iconEl);
    toast.appendChild(contentEl);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(30px)";
        toast.style.transition = "all 200ms ease";
        setTimeout(() => toast.remove(), 200);
      }
    }, duration);
  }

  /**
   * Open a customizable accessible modal dialog
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.bodyHtml
   * @param {string} [options.footerHtml]
   * @param {Function} [options.onMount]
   */
  openModal({ title, bodyHtml, footerHtml = "", onMount = null }) {
    this.closeModal();

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.id = "active-modal-backdrop";
    backdrop.setAttribute("role", "dialog");
    backdrop.setAttribute("aria-modal", "true");
    backdrop.setAttribute("aria-label", title || "Dialog");

    backdrop.innerHTML = `
      <div class="modal-box" id="active-modal-box">
        <div class="modal-header">
          <h3 class="modal-title">${window.Storage.escapeHtml(title)}</h3>
          <button type="button" class="btn-icon" id="modal-close-btn" aria-label="Tutup modal">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body" id="active-modal-body">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ""}
      </div>
    `;

    document.body.appendChild(backdrop);
    this.activeModal = backdrop;

    const closeBtn = backdrop.querySelector("#modal-close-btn");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => this.closeModal());
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        this.closeModal();
      }
    });

    this._escHandler = (e) => {
      if (e.key === "Escape") {
        this.closeModal();
      }
    };
    document.addEventListener("keydown", this._escHandler);

    if (typeof onMount === "function") {
      onMount(backdrop);
    }
  }

  /**
   * Close currently open modal dialog
   */
  closeModal() {
    if (this.activeModal) {
      this.activeModal.remove();
      this.activeModal = null;
    }
    if (this._escHandler) {
      document.removeEventListener("keydown", this._escHandler);
      this._escHandler = null;
    }
  }

  /**
   * Show confirmation modal before destructive action
   * @param {Object} options
   * @returns {Promise<boolean>}
   */
  confirmDialog({
    title = "Konfirmasi Tindakan",
    message = "Apakah Anda yakin ingin melanjutkan?",
    confirmText = "Ya, Lanjutkan",
    cancelText = "Batal",
    danger = true,
  }) {
    return new Promise((resolve) => {
      const bodyHtml = `<p class="text-secondary">${window.Storage.escapeHtml(message)}</p>`;
      const footerHtml = `
        <button type="button" class="btn btn-secondary" id="confirm-cancel-btn">${window.Storage.escapeHtml(cancelText)}</button>
        <button type="button" class="btn ${danger ? "btn-danger" : "btn-primary"}" id="confirm-ok-btn">${window.Storage.escapeHtml(confirmText)}</button>
      `;

      this.openModal({
        title,
        bodyHtml,
        footerHtml,
        onMount: (modalEl) => {
          const cancelBtn = modalEl.querySelector("#confirm-cancel-btn");
          const okBtn = modalEl.querySelector("#confirm-ok-btn");

          cancelBtn.addEventListener("click", () => {
            this.closeModal();
            resolve(false);
          });

          okBtn.addEventListener("click", () => {
            this.closeModal();
            resolve(true);
          });
        },
      });
    });
  }

  /**
   * Open fullscreen image lightbox
   * @param {string} src
   * @param {string} alt
   */
  openLightbox(src, alt = "Pratinjau Gambar") {
    const resolvedSrc = window.Storage.resolveMedia(src);
    const bodyHtml = `
      <div style="text-align:center;">
        <img src="${resolvedSrc}" alt="${window.Storage.escapeHtml(alt)}" style="max-height:72vh; margin:0 auto; border-radius:var(--radius-md); object-fit:contain;" />
      </div>
    `;
    this.openModal({
      title: alt,
      bodyHtml,
    });
  }

  /**
   * Format timestamp into Indonesian relative time ("5 menit lalu", "2 jam lalu")
   * @param {number} timestamp
   * @returns {string}
   */
  formatRelativeTime(timestamp) {
    if (!timestamp) return "Baru saja";
    const diffSeconds = Math.floor((Date.now() - Number(timestamp)) / 1000);

    if (diffSeconds < 45) return "Baru saja";
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes} menit lalu`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours} jam lalu`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} hari lalu`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 4) return `${diffWeeks} minggu lalu`;

    const date = new Date(Number(timestamp));
    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  /**
   * Format post/comment content safely: escapes HTML first to prevent XSS,
   * then converts #hashtags and @mentions into interactive links.
   * @param {string} rawText
   * @returns {string} Safe HTML string
   */
  formatPostText(rawText) {
    if (!rawText) return "";
    const escaped = window.Storage.escapeHtml(rawText);

    // Replace #hashtag
    const withHashtags = escaped.replace(
      /(^|\s)#([a-zA-Z0-9_]+)/g,
      '$1<a href="explore.html?q=%23$2" class="post-hashtag" data-hashtag="$2">#$2</a>',
    );

    // Replace @mention
    const withMentions = withHashtags.replace(
      /(^|\s)@([a-zA-Z0-9_]+)/g,
      '$1<a href="profile.html?user=$2" class="post-mention" data-mention="$2">@$2</a>',
    );

    return withMentions;
  }

  /**
   * Generate fallback SVG avatar DataURL when external image is offline
   * @param {string} name
   * @returns {string}
   */
  getFallbackAvatar(name = "User") {
    const initials =
      String(name)
        .trim()
        .split(/\s+/)
        .map((part) => part[0] || "")
        .join("")
        .substring(0, 2)
        .toUpperCase() || "KN";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
      <rect width="120" height="120" rx="60" fill="#6366f1"/>
      <text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" font-family="Poppins, sans-serif" font-weight="700" font-size="44" fill="#ffffff">${initials}</text>
    </svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  /**
   * Render skeleton loading cards inside a container
   * @param {HTMLElement} container
   * @param {number} count
   */
  renderSkeletons(container, count = 3) {
    if (!container) return;
    let html = "";
    for (let i = 0; i < count; i++) {
      html += `
        <div class="post-card" aria-hidden="true">
          <div class="post-header">
            <div class="post-author" style="width:100%">
              <div class="skeleton skeleton-avatar"></div>
              <div style="flex:1">
                <div class="skeleton skeleton-line" style="width:40%"></div>
                <div class="skeleton skeleton-line" style="width:25%; height:10px"></div>
              </div>
            </div>
          </div>
          <div class="skeleton skeleton-line" style="width:92%"></div>
          <div class="skeleton skeleton-line" style="width:80%"></div>
          <div class="skeleton skeleton-line" style="width:60%"></div>
        </div>
      `;
    }
    container.innerHTML = html;
  }

  /**
   * Render navigation sidebars and mobile bottom bar across pages
   * @param {string} activePage - 'home' | 'explore' | 'messages' | 'notifications' | 'profile' | 'settings'
   */
  renderNavigation(activePage) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return;

    const unreadNotifs = window.Notifications
      ? window.Notifications.getUnreadCount(currentUser.id)
      : 0;
    const unreadMessages = window.Chat
      ? window.Chat.getUnreadCount(currentUser.id)
      : 0;

    const navItems = [
      {
        id: "home",
        label: "Beranda",
        href: "home.html",
        icon: "fa-solid fa-house",
      },
      {
        id: "explore",
        label: "Eksplorasi",
        href: "explore.html",
        icon: "fa-solid fa-compass",
      },
      {
        id: "messages",
        label: "Pesan",
        href: "messages.html",
        icon: "fa-solid fa-paper-plane",
        badge: unreadMessages,
      },
      {
        id: "notifications",
        label: "Notifikasi",
        href: "notifications.html",
        icon: "fa-solid fa-bell",
        badge: unreadNotifs,
      },
      {
        id: "profile",
        label: "Profil",
        href: "profile.html",
        icon: "fa-solid fa-user",
      },
      {
        id: "settings",
        label: "Pengaturan",
        href: "settings.html",
        icon: "fa-solid fa-gear",
      },
    ];

    const avatarSrc =
      window.Storage.resolveMedia(currentUser.avatar) ||
      this.getFallbackAvatar(currentUser.name);

    // 1. Left Sidebar
    const leftSidebar = document.getElementById("sidebar-left");
    if (leftSidebar) {
      leftSidebar.innerHTML = `
        <a href="home.html" class="brand-logo" aria-label="Konekta Beranda">
          <div class="brand-logo-icon">K</div>
          <span class="brand-logo-text">Konekta</span>
        </a>

        <nav class="nav-menu" aria-label="Navigasi Utama">
          ${navItems
            .map(
              (item) => `
            <a href="${item.href}" class="nav-link ${activePage === item.id ? "active" : ""}" data-nav="${item.id}">
              <span class="nav-link-left">
                <i class="${item.icon}"></i>
                <span>${item.label}</span>
              </span>
              ${
                item.badge && item.badge > 0
                  ? `<span class="badge-count" data-badge="${item.id}">${item.badge > 99 ? "99+" : item.badge}</span>`
                  : `<span class="badge-count hidden" data-badge="${item.id}">0</span>`
              }
            </a>
          `,
            )
            .join("")}
        </nav>

        <div style="margin-top: var(--space-4); padding: 0 var(--space-2);">
          <button type="button" class="btn btn-primary btn-block" id="sidebar-new-post-btn">
            <i class="fa-solid fa-feather-pointed"></i>
            <span>Buat Postingan</span>
          </button>
        </div>

        <div class="sidebar-user-card">
          <a href="profile.html" class="sidebar-user-info">
            <img
              src="${avatarSrc}"
              alt="${window.Storage.escapeHtml(currentUser.name)}"
              class="avatar avatar-sm"
              onerror="this.onerror=null;this.src='${this.getFallbackAvatar(currentUser.name)}';"
            />
            <div class="sidebar-user-text">
              <div class="sidebar-user-name">
                ${window.Storage.escapeHtml(currentUser.name)}
                ${currentUser.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ""}
              </div>
              <div class="sidebar-user-handle">@${window.Storage.escapeHtml(currentUser.username)}</div>
            </div>
          </a>
          <div class="flex items-center">
            <button type="button" class="btn-icon" id="sidebar-theme-btn" title="Ubah Tema Gelap/Terang" aria-label="Ubah Tema">
              <i data-theme-icon class="fa-solid fa-moon"></i>
            </button>
            <button type="button" class="btn-icon text-danger" id="sidebar-logout-btn" title="Keluar (Logout)" aria-label="Keluar">
              <i class="fa-solid fa-right-from-bracket"></i>
            </button>
          </div>
        </div>
      `;

      const themeBtn = leftSidebar.querySelector("#sidebar-theme-btn");
      if (themeBtn)
        themeBtn.addEventListener("click", () => this.toggleTheme());

      const logoutBtn = leftSidebar.querySelector("#sidebar-logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
          const confirmed = await this.confirmDialog({
            title: "Keluar dari Akun?",
            message:
              "Sesi Anda akan diakhiri. Anda dapat masuk kembali kapan saja.",
            confirmText: "Ya, Keluar",
            danger: true,
          });
          if (confirmed) window.Auth.logout();
        });
      }

      const newPostBtn = leftSidebar.querySelector("#sidebar-new-post-btn");
      if (newPostBtn) {
        newPostBtn.addEventListener("click", () => {
          const composerTextarea = document.getElementById("composer-textarea");
          if (composerTextarea) {
            composerTextarea.focus();
            composerTextarea.scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
          } else {
            window.Posts.openQuickPostModal();
          }
        });
      }
    }

    // 2. Mobile Bottom Navigation
    const bottomNav = document.getElementById("bottom-nav");
    if (bottomNav) {
      const mobileItems = navItems.slice(0, 5); // Home, Explore, Messages, Notifications, Profile
      bottomNav.innerHTML = mobileItems
        .map(
          (item) => `
          <a href="${item.href}" class="bottom-nav-item ${activePage === item.id ? "active" : ""}" aria-label="${item.label}">
            <i class="${item.icon}"></i>
            <span>${item.label}</span>
            ${
              item.badge && item.badge > 0
                ? `<span class="badge-count" data-badge-mobile="${item.id}">${item.badge > 99 ? "99+" : item.badge}</span>`
                : `<span class="badge-count hidden" data-badge-mobile="${item.id}">0</span>`
            }
          </a>
        `,
        )
        .join("");
    }

    const effectiveTheme =
      document.documentElement.getAttribute("data-theme") || "light";
    this.updateThemeToggleIcons(effectiveTheme);
  }

  /**
   * Update unread badge counters in sidebar and bottom navigation
   */
  updateNavBadges() {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return;

    const unreadNotifs = window.Notifications
      ? window.Notifications.getUnreadCount(currentUser.id)
      : 0;
    const unreadMessages = window.Chat
      ? window.Chat.getUnreadCount(currentUser.id)
      : 0;

    const updateBadgeEl = (selector, count) => {
      document.querySelectorAll(selector).forEach((el) => {
        if (count > 0) {
          el.textContent = count > 99 ? "99+" : String(count);
          el.classList.remove("hidden");
        } else {
          el.textContent = "0";
          el.classList.add("hidden");
        }
      });
    };

    updateBadgeEl('[data-badge="notifications"]', unreadNotifs);
    updateBadgeEl('[data-badge-mobile="notifications"]', unreadNotifs);
    updateBadgeEl('[data-badge="messages"]', unreadMessages);
    updateBadgeEl('[data-badge-mobile="messages"]', unreadMessages);
  }

  /**
   * Render Right Sidebar Widgets (Search, Trending Hashtags & Who to Follow)
   */
  renderRightSidebar() {
    const rightSidebar = document.getElementById("sidebar-right");
    if (!rightSidebar) return;

    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return;

    const trendingTags = window.Posts
      ? window.Posts.getTrendingHashtags(6)
      : [];
    const suggestions = window.Users
      ? window.Users.getSuggestedUsers(currentUser.id, 4)
      : [];

    rightSidebar.innerHTML = `
      <div class="widget-card">
        <form id="sidebar-search-form" class="search-box" role="search">
          <i class="fa-solid fa-magnifying-glass input-icon-left"></i>
          <input
            type="search"
            id="sidebar-search-input"
            class="form-control"
            placeholder="Cari pengguna, #hashtag, topik..."
            aria-label="Cari di Konekta"
          />
        </form>
      </div>

      <div class="widget-card">
        <div class="widget-header">
          <h3 class="widget-title"><i class="fa-solid fa-fire text-primary-brand"></i> Tren untuk Anda</h3>
          <a href="explore.html" class="text-xs font-semibold">Lihat semua</a>
        </div>
        <div class="trending-list">
          ${
            trendingTags.length > 0
              ? trendingTags
                  .map(
                    (item, idx) => `
                <a href="explore.html?q=%23${encodeURIComponent(item.tag)}" class="trending-item">
                  <div>
                    <div class="text-xs text-muted">Populer #${idx + 1} di Indonesia</div>
                    <div class="trending-tag">#${window.Storage.escapeHtml(item.tag)}</div>
                  </div>
                  <span class="trending-count">${item.count} postingan</span>
                </a>
              `,
                  )
                  .join("")
              : '<p class="text-xs text-muted">Belum ada hashtag populer.</p>'
          }
        </div>
      </div>

      <div class="widget-card">
        <div class="widget-header">
          <h3 class="widget-title"><i class="fa-solid fa-user-plus text-primary-brand"></i> Siapa yang diikuti</h3>
          <a href="explore.html?tab=users" class="text-xs font-semibold">Lainnya</a>
        </div>
        <div class="suggestion-list" id="widget-suggestions-list">
          ${
            suggestions.length > 0
              ? suggestions
                  .map((u) => {
                    const av =
                      window.Storage.resolveMedia(u.avatar) ||
                      this.getFallbackAvatar(u.name);
                    return `
                  <div class="suggestion-item">
                    <a href="profile.html?user=${encodeURIComponent(u.username)}" class="suggestion-user">
                      <img
                        src="${av}"
                        alt="${window.Storage.escapeHtml(u.name)}"
                        class="avatar avatar-sm"
                        onerror="this.onerror=null;this.src='${this.getFallbackAvatar(u.name)}';"
                      />
                      <div class="suggestion-meta">
                        <span class="suggestion-name">
                          ${window.Storage.escapeHtml(u.name)}
                          ${u.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ""}
                        </span>
                        <span class="suggestion-handle">@${window.Storage.escapeHtml(u.username)}</span>
                      </div>
                    </a>
                    <button
                      type="button"
                      class="btn btn-outline btn-sm widget-follow-btn"
                      data-user-id="${u.id}"
                    >
                      Ikuti
                    </button>
                  </div>
                `;
                  })
                  .join("")
              : '<p class="text-xs text-muted">Anda telah mengikuti semua pengguna yang disarankan!</p>'
          }
        </div>
      </div>

      <footer class="text-xs text-muted" style="padding: 0 var(--space-2); line-height: 1.6;">
        &copy; 2026 Konekta Indonesia &bull; Platform Sosial Lokal Tanpa Server &bull;
        <a href="settings.html">Pengaturan</a>
      </footer>
    `;

    // Bind search submit
    const searchForm = rightSidebar.querySelector("#sidebar-search-form");
    if (searchForm) {
      searchForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const q = rightSidebar
          .querySelector("#sidebar-search-input")
          .value.trim();
        if (q) {
          window.location.href = `explore.html?q=${encodeURIComponent(q)}`;
        }
      });
    }

    // Bind follow buttons inside widget
    rightSidebar.querySelectorAll(".widget-follow-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const targetId = btn.getAttribute("data-user-id");
        if (targetId && window.Users) {
          window.Users.toggleFollow(targetId);
          this.renderRightSidebar();
          if (typeof window.onSocialGraphUpdated === "function") {
            window.onSocialGraphUpdated();
          }
        }
      });
    });
  }
}

window.UI = new UIService();
