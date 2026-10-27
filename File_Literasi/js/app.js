/**
 * ==========================================================================
 * APP.JS - Main Application Controller & Page Routers
 * Connects Storage, Seed, Auth, UI, Users, Posts, Chat & Notifications
 * ==========================================================================
 */

class AppController {
  async init() {
    // Wait for IndexedDB media cache preload before rendering
    await window.Storage.initIndexedDB();

    // Ensure initial dummy seed data is loaded
    window.Seed.init();

    // Apply saved theme or OS preference
    window.UI.initTheme();

    // Route based on data-page attribute on <body>
    const page = document.body.getAttribute("data-page") || "auth";

    if (page === "auth") {
      this.initAuthPage();
      return;
    }

    // All other pages require authentication
    const currentUser = window.Auth.requireAuth();
    if (!currentUser) return;

    // Render common navigation & right sidebar
    window.UI.renderNavigation(page);
    window.UI.renderRightSidebar();

    // Bind mobile header theme toggle if present
    document.querySelectorAll('[data-action="toggle-theme"]').forEach((btn) => {
      btn.addEventListener("click", () => window.UI.toggleTheme());
    });

    switch (page) {
      case "home":
        this.initHomePage();
        break;
      case "explore":
        this.initExplorePage();
        break;
      case "profile":
        this.initProfilePage();
        break;
      case "messages":
        this.initMessagesPage();
        break;
      case "notifications":
        this.initNotificationsPage();
        break;
      case "settings":
        this.initSettingsPage();
        break;
      default:
        break;
    }
  }

  /* ==========================================================================
     1. AUTH PAGE (index.html)
     ========================================================================== */
  initAuthPage() {
    window.Auth.redirectIfAuthenticated();
    window.Auth.bindPasswordToggles(document);

    const tabLogin = document.getElementById("tab-login");
    const tabRegister = document.getElementById("tab-register");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const themeBtn = document.getElementById("auth-theme-btn");

    if (themeBtn) {
      themeBtn.addEventListener("click", () => window.UI.toggleTheme());
    }

    const switchAuthTab = (mode) => {
      const isLogin = mode === "login";
      tabLogin.classList.toggle("active", isLogin);
      tabRegister.classList.toggle("active", !isLogin);
      loginForm.classList.toggle("hidden", !isLogin);
      registerForm.classList.toggle("hidden", isLogin);
    };

    if (tabLogin && tabRegister) {
      tabLogin.addEventListener("click", () => switchAuthTab("login"));
      tabRegister.addEventListener("click", () => switchAuthTab("register"));
    }

    // Render Demo Accounts Chips for 1-Click Testing
    const demoChipsContainer = document.getElementById("demo-accounts-chips");
    if (demoChipsContainer) {
      const demoUsers = window.Users.getAll().slice(0, 5);
      demoChipsContainer.innerHTML = demoUsers
        .map((u) => {
          const av =
            window.Storage.resolveMedia(u.avatar) ||
            window.UI.getFallbackAvatar(u.name);
          return `
            <button type="button" class="demo-chip" data-demo-user="${u.username}" title="Masuk instan sebagai ${window.Storage.escapeHtml(u.name)}">
              <img src="${av}" alt="${window.Storage.escapeHtml(u.name)}" onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(u.name)}';" />
              <span>@${window.Storage.escapeHtml(u.username)}</span>
            </button>
          `;
        })
        .join("");

      demoChipsContainer
        .querySelectorAll("[data-demo-user]")
        .forEach((chip) => {
          chip.addEventListener("click", () => {
            const uname = chip.getAttribute("data-demo-user");
            window.Auth.loginDemo(uname);
          });
        });
    }

    // Login Form Submit
    if (loginForm) {
      loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const identifier = document.getElementById("login-identifier").value;
        const password = document.getElementById("login-password").value;
        const errorEl = document.getElementById("login-error");
        errorEl.textContent = "";

        const res = await window.Auth.login({ identifier, password });
        if (!res.ok) {
          errorEl.textContent = res.error;
          window.UI.showToast(res.error, "error");
          return;
        }

        window.location.href = "home.html";
      });
    }

    // Register Form Submit
    if (registerForm) {
      registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        ["name", "username", "email", "password", "confirmPassword"].forEach(
          (field) => {
            const errEl = document.getElementById(`reg-error-${field}`);
            if (errEl) errEl.textContent = "";
          },
        );

        const payload = {
          name: document.getElementById("reg-name").value,
          username: document.getElementById("reg-username").value,
          email: document.getElementById("reg-email").value,
          password: document.getElementById("reg-password").value,
          confirmPassword: document.getElementById("reg-confirm-password")
            .value,
        };

        const res = await window.Auth.register(payload);
        if (!res.ok && res.errors) {
          Object.entries(res.errors).forEach(([field, msg]) => {
            const errEl = document.getElementById(`reg-error-${field}`);
            if (errEl) errEl.textContent = msg;
          });
          window.UI.showToast(
            "Periksa kembali data pendaftaran Anda.",
            "error",
          );
          return;
        }

        window.location.href = "home.html";
      });
    }
  }

  /* ==========================================================================
     2. HOME PAGE (home.html) - Stories, Composer, Feed Tabs & Infinite Scroll
     ========================================================================== */
  initHomePage() {
    const currentUser = window.Auth.getCurrentUser();
    const storiesContainer = document.getElementById("stories-bar");
    const feedContainer = document.getElementById("feed-posts-container");
    const sentinel = document.getElementById("feed-sentinel");
    const loadMoreBtn = document.getElementById("load-more-btn");

    // 1. Render Stories Bar
    window.Posts.renderStoriesBar(storiesContainer);

    // 2. Setup Post Composer
    const composerAvatar = document.getElementById("composer-user-avatar");
    if (composerAvatar) {
      composerAvatar.src =
        window.Storage.resolveMedia(currentUser.avatar) ||
        window.UI.getFallbackAvatar(currentUser.name);
      composerAvatar.onerror = () => {
        composerAvatar.src = window.UI.getFallbackAvatar(currentUser.name);
      };
    }

    const textarea = document.getElementById("composer-textarea");
    const charCounter = document.getElementById("composer-char-counter");
    const imageInput = document.getElementById("composer-image-input");
    const previewGrid = document.getElementById("composer-preview-grid");
    const composerForm = document.getElementById("composer-form");
    const emojiTrigger = document.getElementById("composer-emoji-trigger");
    const emojiPopover = document.getElementById("composer-emoji-popover");

    let selectedImages = [];

    const renderComposerPreviews = () => {
      if (!previewGrid) return;
      if (selectedImages.length === 0) {
        previewGrid.innerHTML = "";
        previewGrid.classList.add("hidden");
        return;
      }

      previewGrid.classList.remove("hidden");
      previewGrid.innerHTML = selectedImages
        .map(
          (src, idx) => `
          <div class="composer-preview-item">
            <img src="${src}" alt="Pratinjau lampiran ${idx + 1}" />
            <button type="button" class="composer-preview-remove" data-remove-img="${idx}" aria-label="Hapus gambar">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
        `,
        )
        .join("");

      previewGrid.querySelectorAll("[data-remove-img]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const index = Number(btn.getAttribute("data-remove-img"));
          selectedImages.splice(index, 1);
          renderComposerPreviews();
        });
      });
    };

    if (textarea && charCounter) {
      textarea.addEventListener("input", () => {
        const len = textarea.value.length;
        charCounter.textContent = `${len}/280`;
        charCounter.classList.toggle("warning", len >= 240 && len < 280);
        charCounter.classList.toggle("danger", len >= 280);
      });
    }

    if (imageInput) {
      imageInput.addEventListener("change", async (e) => {
        const files = Array.from(e.target.files || []);
        if (selectedImages.length + files.length > 4) {
          window.UI.showToast(
            "Maksimal 4 gambar dalam satu postingan.",
            "warning",
          );
        }
        const allowedFiles = files.slice(0, 4 - selectedImages.length);
        for (const file of allowedFiles) {
          try {
            const compressed = await window.Storage.compressImage(
              file,
              1080,
              0.82,
            );
            selectedImages.push(compressed);
          } catch (err) {
            window.UI.showToast(err.message, "error");
          }
        }
        imageInput.value = "";
        renderComposerPreviews();
      });
    }

    if (emojiTrigger && emojiPopover && textarea) {
      emojiPopover.innerHTML = window.Chat.getEmojis()
        .map(
          (em) =>
            `<button type="button" class="emoji-btn" data-emoji="${em}">${em}</button>`,
        )
        .join("");

      emojiTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        emojiPopover.classList.toggle("hidden");
      });

      emojiPopover.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-emoji]");
        if (!btn) return;
        textarea.value += btn.getAttribute("data-emoji");
        textarea.dispatchEvent(new Event("input"));
        textarea.focus();
      });

      document.addEventListener("click", (e) => {
        if (
          !e.target.closest("#composer-emoji-popover") &&
          e.target !== emojiTrigger
        ) {
          emojiPopover.classList.add("hidden");
        }
      });
    }

    // 3. Feed Pagination & Infinite Scroll
    let activeFeedMode = "following";
    let currentBatch = 1;
    const BATCH_SIZE = 6;

    const renderFeed = (resetBatch = false) => {
      if (resetBatch) currentBatch = 1;

      const allMatching = window.Posts.getFeedPosts(activeFeedMode);
      const visiblePosts = allMatching.slice(0, currentBatch * BATCH_SIZE);

      if (allMatching.length === 0) {
        feedContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-newspaper"></i></div>
            <h3 class="empty-state-title">Belum Ada Postingan</h3>
            <p class="empty-state-desc">
              ${
                activeFeedMode === "following"
                  ? 'Ikuti lebih banyak pengguna di Eksplorasi atau beralih ke tab "Untuk Anda" untuk melihat diskusi komunitas.'
                  : "Belum ada postingan tersimpan di daftar ini."
              }
            </p>
            <a href="explore.html" class="btn btn-primary btn-sm">Jelajahi Komunitas</a>
          </div>
        `;
        if (loadMoreBtn) loadMoreBtn.classList.add("hidden");
        return;
      }

      feedContainer.innerHTML = visiblePosts
        .map((p) => window.Posts.renderPostCardHtml(p))
        .join("");

      const hasMore = visiblePosts.length < allMatching.length;
      if (loadMoreBtn) {
        loadMoreBtn.classList.toggle("hidden", !hasMore);
      }
    };

    window.Posts.bindFeedEvents(feedContainer, () => {
      renderFeed(false);
      window.UI.renderRightSidebar();
    });

    window.onPostCreatedGlobal = () => {
      renderFeed(true);
      window.UI.renderRightSidebar();
    };
    window.onSocialGraphUpdated = () => {
      renderFeed(false);
    };

    if (composerForm) {
      composerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const res = await window.Posts.createPost({
          content: textarea.value,
          imageDataUrls: selectedImages,
        });

        if (!res.ok) {
          window.UI.showToast(res.error, "error");
          return;
        }

        textarea.value = "";
        charCounter.textContent = "0/280";
        charCounter.className = "char-counter";
        selectedImages = [];
        renderComposerPreviews();
        window.UI.showToast("Postingan Anda berhasil diterbitkan!", "success");

        renderFeed(true);
        window.UI.renderRightSidebar();
      });
    }

    // Feed Mode Tabs
    document.querySelectorAll("[data-feed-tab]").forEach((tabBtn) => {
      tabBtn.addEventListener("click", () => {
        document
          .querySelectorAll("[data-feed-tab]")
          .forEach((b) => b.classList.remove("active"));
        tabBtn.classList.add("active");
        activeFeedMode = tabBtn.getAttribute("data-feed-tab");
        renderFeed(true);
      });
    });

    if (loadMoreBtn) {
      loadMoreBtn.addEventListener("click", () => {
        currentBatch++;
        renderFeed(false);
      });
    }

    // IntersectionObserver for Infinite Scroll
    if ("IntersectionObserver" in window && sentinel) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const allMatching = window.Posts.getFeedPosts(activeFeedMode);
              if (currentBatch * BATCH_SIZE < allMatching.length) {
                currentBatch++;
                renderFeed(false);
              }
            }
          });
        },
        { rootMargin: "220px" },
      );
      observer.observe(sentinel);
    }

    // Initial Skeleton brief flash on very first load for polish, then render
    renderFeed(true);
  }

  /* ==========================================================================
     3. EXPLORE PAGE (explore.html) - Debounced Search, Trending & Users
     ========================================================================== */
  initExplorePage() {
    const searchInput = document.getElementById("explore-search-input");
    const clearSearchBtn = document.getElementById("explore-search-clear");
    const chipsContainer = document.getElementById("explore-hashtag-chips");
    const resultsContainer = document.getElementById(
      "explore-results-container",
    );
    const currentUser = window.Auth.getCurrentUser();

    const params = new URLSearchParams(window.location.search);
    let currentQuery = params.get("q") || "";
    let activeTab = params.get("tab") || "popular";

    if (searchInput && currentQuery) {
      searchInput.value = currentQuery;
      if (clearSearchBtn) clearSearchBtn.classList.remove("hidden");
    }

    // Render Trending Hashtag Chips
    const trendingTags = window.Posts.getTrendingHashtags(10);
    if (chipsContainer) {
      chipsContainer.innerHTML = `
        <button type="button" class="hashtag-chip ${!currentQuery ? "active" : ""}" data-tag-chip="">
          Semua Topik
        </button>
        ${trendingTags
          .map(
            (t) => `
          <button
            type="button"
            class="hashtag-chip ${currentQuery.toLowerCase() === `#${t.tag.toLowerCase()}` ? "active" : ""}"
            data-tag-chip="#${window.Storage.escapeHtml(t.tag)}"
          >
            #${window.Storage.escapeHtml(t.tag)} (${t.count})
          </button>
        `,
          )
          .join("")}
      `;

      chipsContainer.querySelectorAll("[data-tag-chip]").forEach((chip) => {
        chip.addEventListener("click", () => {
          chipsContainer
            .querySelectorAll("[data-tag-chip]")
            .forEach((c) => c.classList.remove("active"));
          chip.classList.add("active");
          currentQuery = chip.getAttribute("data-tag-chip");
          if (searchInput) searchInput.value = currentQuery;
          if (clearSearchBtn)
            clearSearchBtn.classList.toggle("hidden", !currentQuery);
          renderExploreResults();
        });
      });
    }

    const renderExploreResults = () => {
      if (!resultsContainer) return;

      if (activeTab === "users") {
        const users = window.Users.search(currentQuery);
        if (users.length === 0) {
          resultsContainer.innerHTML = `
            <div class="empty-state">
              <div class="empty-state-icon"><i class="fa-solid fa-users-slash"></i></div>
              <h3 class="empty-state-title">Pengguna Tidak Ditemukan</h3>
              <p class="empty-state-desc">Tidak ada pengguna yang cocok dengan kata kunci "${window.Storage.escapeHtml(currentQuery)}".</p>
            </div>
          `;
          return;
        }

        const freshMe = window.Auth.getCurrentUser();
        resultsContainer.innerHTML = `
          <div class="user-directory-grid">
            ${users
              .map((u) => {
                const av =
                  window.Storage.resolveMedia(u.avatar) ||
                  window.UI.getFallbackAvatar(u.name);
                const isMe = u.id === freshMe.id;
                const isFollowing = (freshMe.following || []).includes(u.id);
                return `
                  <div class="user-card">
                    <div class="flex items-center justify-between gap-2">
                      <a href="profile.html?user=${encodeURIComponent(u.username)}" class="suggestion-user">
                        <img
                          src="${av}"
                          alt="${window.Storage.escapeHtml(u.name)}"
                          class="avatar avatar-md"
                          onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(u.name)}';"
                        />
                        <div class="suggestion-meta">
                          <span class="suggestion-name">
                            ${window.Storage.escapeHtml(u.name)}
                            ${u.verified ? '<i class="fa-solid fa-circle-check verified-badge"></i>' : ""}
                          </span>
                          <span class="suggestion-handle">@${window.Storage.escapeHtml(u.username)}</span>
                        </div>
                      </a>
                      ${
                        !isMe
                          ? `<button
                              type="button"
                              class="btn btn-sm btn-follow ${isFollowing ? "is-following" : "btn-primary"}"
                              data-explore-follow="${u.id}"
                            >
                              ${isFollowing ? "Mengikuti" : "Ikuti"}
                            </button>`
                          : '<span class="text-xs text-muted">Akun Anda</span>'
                      }
                    </div>
                    <p class="text-xs text-secondary">${window.Storage.escapeHtml(u.bio || "")}</p>
                    <div class="text-xs text-muted">
                      <strong>${(u.followers || []).length}</strong> Pengikut &bull;
                      ${window.Storage.escapeHtml(u.location || "Indonesia")}
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;

        resultsContainer
          .querySelectorAll("[data-explore-follow]")
          .forEach((btn) => {
            btn.addEventListener("click", () => {
              const uid = btn.getAttribute("data-explore-follow");
              window.Users.toggleFollow(uid);
              renderExploreResults();
              window.UI.renderRightSidebar();
            });
          });
        return;
      }

      if (activeTab === "tags") {
        const tags = window.Posts.getTrendingHashtags(20).filter((t) =>
          !currentQuery
            ? true
            : t.tag
                .toLowerCase()
                .includes(currentQuery.replace(/^#/, "").toLowerCase()),
        );

        resultsContainer.innerHTML = `
          <div class="card" style="padding:var(--space-4);">
            <h3 class="widget-title" style="margin-bottom:var(--space-3);">Daftar Hashtag Terpopuler</h3>
            <div class="trending-list">
              ${tags
                .map(
                  (t, i) => `
                  <div class="trending-item" data-jump-tag="#${window.Storage.escapeHtml(t.tag)}">
                    <div>
                      <span class="text-xs text-muted">Peringkat #${i + 1}</span>
                      <div class="trending-tag">#${window.Storage.escapeHtml(t.tag)}</div>
                    </div>
                    <span class="btn btn-secondary btn-sm">${t.count} postingan</span>
                  </div>
                `,
                )
                .join("")}
            </div>
          </div>
        `;

        resultsContainer.querySelectorAll("[data-jump-tag]").forEach((row) => {
          row.addEventListener("click", () => {
            currentQuery = row.getAttribute("data-jump-tag");
            if (searchInput) searchInput.value = currentQuery;
            activeTab = "popular";
            updateTabActiveUI();
            renderExploreResults();
          });
        });
        return;
      }

      // 'popular' or 'latest' posts
      const posts = window.Posts.searchPosts(currentQuery, activeTab);
      if (posts.length === 0) {
        resultsContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-magnifying-glass"></i></div>
            <h3 class="empty-state-title">Tidak Ada Postingan yang Cocok</h3>
            <p class="empty-state-desc">Coba gunakan kata kunci, @username, atau #hashtag lain.</p>
          </div>
        `;
        return;
      }

      resultsContainer.innerHTML = posts
        .map((p) => window.Posts.renderPostCardHtml(p))
        .join("");
    };

    window.Posts.bindFeedEvents(resultsContainer, () => {
      renderExploreResults();
      window.UI.renderRightSidebar();
    });

    const updateTabActiveUI = () => {
      document.querySelectorAll("[data-explore-tab]").forEach((btn) => {
        btn.classList.toggle(
          "active",
          btn.getAttribute("data-explore-tab") === activeTab,
        );
      });
    };

    document.querySelectorAll("[data-explore-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        activeTab = btn.getAttribute("data-explore-tab");
        updateTabActiveUI();
        renderExploreResults();
      });
    });

    // Real-time Search with 280ms Debounce
    let debounceTimer = null;
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        currentQuery = searchInput.value.trim();
        if (clearSearchBtn)
          clearSearchBtn.classList.toggle("hidden", !currentQuery);
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          renderExploreResults();
        }, 280);
      });
    }

    if (clearSearchBtn) {
      clearSearchBtn.addEventListener("click", () => {
        currentQuery = "";
        if (searchInput) searchInput.value = "";
        clearSearchBtn.classList.add("hidden");
        renderExploreResults();
      });
    }

    updateTabActiveUI();
    renderExploreResults();
  }

  /* ==========================================================================
     4. PROFILE PAGE (profile.html) - Header, Stats, Edit Modal & Tabs
     ========================================================================== */
  initProfilePage() {
    const params = new URLSearchParams(window.location.search);
    const requestedUsername = params.get("user");
    const currentUser = window.Auth.getCurrentUser();

    let profileUser = requestedUsername
      ? window.Users.getByUsername(requestedUsername)
      : currentUser;

    const headerContainer = document.getElementById("profile-header-container");
    const contentContainer = document.getElementById("profile-tab-content");
    const titleEl = document.getElementById("profile-page-title");

    if (!profileUser) {
      if (headerContainer) {
        headerContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-user-Large-slash"></i></div>
            <h3 class="empty-state-title">Akun Tidak Ditemukan</h3>
            <p class="empty-state-desc">Pengguna @${window.Storage.escapeHtml(requestedUsername || "")} tidak ditemukan atau telah dihapus.</p>
            <a href="home.html" class="btn btn-primary btn-sm">Kembali ke Beranda</a>
          </div>
        `;
      }
      return;
    }

    let activeProfileTab = "posts";

    const renderProfileHeader = () => {
      // Refresh user objects from storage
      const freshMe = window.Auth.getCurrentUser();
      profileUser = window.Users.getById(profileUser.id) || freshMe;

      const isOwnProfile = profileUser.id === freshMe.id;
      const isFollowing = (freshMe.following || []).includes(profileUser.id);
      const isBlocked = (freshMe.blockedUsers || []).includes(profileUser.id);
      const isMuted = (freshMe.mutedUsers || []).includes(profileUser.id);

      const userPosts = window.Posts.getProfilePosts(profileUser.id, "posts");
      const avatarSrc =
        window.Storage.resolveMedia(profileUser.avatar) ||
        window.UI.getFallbackAvatar(profileUser.name);
      const bannerSrc = window.Storage.resolveMedia(profileUser.banner) || "";

      if (titleEl) {
        titleEl.textContent = profileUser.name;
      }

      const joinedDate = new Date(
        profileUser.createdAt || Date.now(),
      ).toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });

      headerContainer.innerHTML = `
        <div class="profile-card">
          <div class="profile-banner">
            ${bannerSrc ? `<img src="${bannerSrc}" alt="Banner ${window.Storage.escapeHtml(profileUser.name)}" />` : ""}
          </div>

          <div class="profile-body">
            <div class="profile-top-row">
              <div class="profile-avatar-wrap">
                <img
                  src="${avatarSrc}"
                  alt="${window.Storage.escapeHtml(profileUser.name)}"
                  class="avatar avatar-xl"
                  id="profile-main-avatar"
                  style="cursor:zoom-in;"
                  onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(profileUser.name)}';"
                />
              </div>

              <div class="profile-actions">
                ${
                  isOwnProfile
                    ? `
                      <button type="button" class="btn btn-outline" id="btn-edit-profile">
                        <i class="fa-regular fa-pen-to-square"></i> Edit Profil
                      </button>
                      <a href="settings.html" class="btn btn-secondary btn-icon" title="Pengaturan Akun" aria-label="Pengaturan Akun">
                        <i class="fa-solid fa-gear"></i>
                      </a>
                    `
                    : `
                      <a
                        href="messages.html?user=${encodeURIComponent(profileUser.username)}"
                        class="btn btn-secondary btn-icon"
                        title="Kirim Pesan"
                        aria-label="Kirim Pesan"
                      >
                        <i class="fa-regular fa-envelope"></i>
                      </a>
                      <button
                        type="button"
                        class="btn btn-secondary btn-icon"
                        id="btn-mute-profile"
                        title="${isMuted ? "Bunyikan Pengguna" : "Bisukan Pengguna"}"
                        aria-label="Bisukan Pengguna"
                      >
                        <i class="fa-solid ${isMuted ? "fa-volume-high text-primary-brand" : "fa-volume-xmark"}"></i>
                      </button>
                      <button
                        type="button"
                        class="btn btn-secondary btn-icon"
                        id="btn-block-profile"
                        title="${isBlocked ? "Buka Blokir" : "Blokir Pengguna"}"
                        aria-label="Blokir Pengguna"
                      >
                        <i class="fa-solid fa-ban ${isBlocked ? "text-danger" : ""}"></i>
                      </button>
                      ${
                        !isBlocked
                          ? `<button
                              type="button"
                              class="btn btn-follow ${isFollowing ? "is-following" : "btn-primary"}"
                              id="btn-follow-profile"
                            >
                              ${isFollowing ? "Mengikuti" : "Ikuti"}
                            </button>`
                          : `<button type="button" class="btn btn-danger" id="btn-unblock-main">Diblokir (Buka)</button>`
                      }
                    `
                }
              </div>
            </div>

            <div class="profile-name">
              <span>${window.Storage.escapeHtml(profileUser.name)}</span>
              ${profileUser.verified ? '<i class="fa-solid fa-circle-check verified-badge" title="Akun Terverifikasi"></i>' : ""}
              ${profileUser.isPrivate ? '<i class="fa-solid fa-lock text-muted text-sm" title="Akun Privat"></i>' : ""}
            </div>
            <div class="profile-handle">@${window.Storage.escapeHtml(profileUser.username)}</div>

            ${
              profileUser.bio
                ? `<div class="profile-bio">${window.UI.formatPostText(profileUser.bio)}</div>`
                : ""
            }

            <div class="profile-meta-list">
              ${
                profileUser.location
                  ? `<span class="profile-meta-item">
                      <i class="fa-solid fa-location-dot"></i>
                      ${window.Storage.escapeHtml(profileUser.location)}
                    </span>`
                  : ""
              }
              ${
                profileUser.website
                  ? `<span class="profile-meta-item">
                      <i class="fa-solid fa-link"></i>
                      <a href="${window.Storage.escapeHtml(profileUser.website)}" target="_blank" rel="noopener noreferrer">
                        ${window.Storage.escapeHtml(profileUser.website.replace(/^https?:\/\//, ""))}
                      </a>
                    </span>`
                  : ""
              }
              <span class="profile-meta-item">
                <i class="fa-regular fa-calendar"></i>
                Bergabung ${joinedDate}
              </span>
            </div>

            <div class="profile-stats">
              <div class="profile-stat-btn" style="cursor:default;">
                <span class="profile-stat-value">${userPosts.length}</span>
                <span>Postingan</span>
              </div>
              <button type="button" class="profile-stat-btn" id="btn-show-followers">
                <span class="profile-stat-value">${(profileUser.followers || []).length}</span>
                <span>Pengikut</span>
              </button>
              <button type="button" class="profile-stat-btn" id="btn-show-following">
                <span class="profile-stat-value">${(profileUser.following || []).length}</span>
                <span>Mengikuti</span>
              </button>
            </div>
          </div>
        </div>
      `;

      // Bind Avatar Lightbox
      const mainAv = headerContainer.querySelector("#profile-main-avatar");
      if (mainAv) {
        mainAv.addEventListener("click", () => {
          window.UI.openLightbox(avatarSrc, profileUser.name);
        });
      }

      // Bind Edit Profile
      const editBtn = headerContainer.querySelector("#btn-edit-profile");
      if (editBtn) {
        editBtn.addEventListener("click", () => {
          window.Users.openEditProfileModal(() => {
            renderProfileHeader();
            renderProfileTabContent();
          });
        });
      }

      // Bind Follow / Mute / Block
      const followBtn = headerContainer.querySelector("#btn-follow-profile");
      if (followBtn) {
        followBtn.addEventListener("click", () => {
          window.Users.toggleFollow(profileUser.id);
          renderProfileHeader();
          window.UI.renderRightSidebar();
        });
      }

      const muteBtn = headerContainer.querySelector("#btn-mute-profile");
      if (muteBtn) {
        muteBtn.addEventListener("click", () => {
          window.Users.toggleMute(profileUser.id);
          renderProfileHeader();
        });
      }

      const blockBtn = headerContainer.querySelector("#btn-block-profile");
      const unblockMainBtn = headerContainer.querySelector("#btn-unblock-main");
      const handleBlockClick = () => {
        window.Users.toggleBlock(profileUser.id);
        renderProfileHeader();
        renderProfileTabContent();
        window.UI.renderRightSidebar();
      };
      if (blockBtn) blockBtn.addEventListener("click", handleBlockClick);
      if (unblockMainBtn)
        unblockMainBtn.addEventListener("click", handleBlockClick);

      // Bind Followers / Following Modals
      const followersBtn = headerContainer.querySelector("#btn-show-followers");
      if (followersBtn) {
        followersBtn.addEventListener("click", () => {
          window.Users.openFollowListModal(profileUser.id, "followers", () => {
            renderProfileHeader();
            window.UI.renderRightSidebar();
          });
        });
      }

      const followingBtn = headerContainer.querySelector("#btn-show-following");
      if (followingBtn) {
        followingBtn.addEventListener("click", () => {
          window.Users.openFollowListModal(profileUser.id, "following", () => {
            renderProfileHeader();
            window.UI.renderRightSidebar();
          });
        });
      }
    };

    const renderProfileTabContent = () => {
      if (!contentContainer) return;
      const freshMe = window.Auth.getCurrentUser();
      if ((freshMe.blockedUsers || []).includes(profileUser.id)) {
        contentContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-solid fa-ban"></i></div>
            <h3 class="empty-state-title">Anda Memblokir @${window.Storage.escapeHtml(profileUser.username)}</h3>
            <p class="empty-state-desc">Buka blokir jika Anda ingin melihat postingan dari pengguna ini.</p>
          </div>
        `;
        return;
      }

      const posts = window.Posts.getProfilePosts(
        profileUser.id,
        activeProfileTab,
      );

      if (posts.length === 0) {
        const emptyMessages = {
          posts: "Belum ada postingan yang diterbitkan.",
          media: "Belum ada foto atau media yang diunggah.",
          likes: "Belum ada postingan yang disukai.",
        };
        contentContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-regular fa-folder-open"></i></div>
            <h3 class="empty-state-title">Kosong</h3>
            <p class="empty-state-desc">${emptyMessages[activeProfileTab]}</p>
          </div>
        `;
        return;
      }

      if (activeProfileTab === "media") {
        const allMediaItems = [];
        posts.forEach((p) => {
          (p.images || []).forEach((imgRef) => {
            const resolved = window.Storage.resolveMedia(imgRef);
            if (resolved) {
              allMediaItems.push({
                src: resolved,
                caption: p.content || profileUser.name,
              });
            }
          });
        });

        contentContainer.innerHTML = `
          <div class="media-gallery-grid" style="margin-bottom:var(--space-4);">
            ${allMediaItems
              .map(
                (item) => `
              <div class="media-gallery-item" data-lightbox-src="${item.src}" data-lightbox-alt="${window.Storage.escapeHtml(item.caption)}">
                <img src="${item.src}" alt="Media galeri" loading="lazy" />
              </div>
            `,
              )
              .join("")}
          </div>
          ${posts.map((p) => window.Posts.renderPostCardHtml(p)).join("")}
        `;
        return;
      }

      contentContainer.innerHTML = posts
        .map((p) => window.Posts.renderPostCardHtml(p))
        .join("");
    };

    window.Posts.bindFeedEvents(contentContainer, () => {
      renderProfileHeader();
      renderProfileTabContent();
    });

    document.querySelectorAll("[data-profile-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("[data-profile-tab]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeProfileTab = btn.getAttribute("data-profile-tab");
        renderProfileTabContent();
      });
    });

    renderProfileHeader();
    renderProfileTabContent();
  }

  /* ==========================================================================
     5. MESSAGES / CHAT PAGE (messages.html)
     ========================================================================== */
  initMessagesPage() {
    const currentUser = window.Auth.getCurrentUser();
    const chatContainer = document.getElementById("chat-container");
    const convListEl = document.getElementById("chat-conversation-list");
    const chatWindowEl = document.getElementById("chat-window");
    const searchInput = document.getElementById("chat-search-input");
    const newChatBtn = document.getElementById("btn-new-chat");

    const params = new URLSearchParams(window.location.search);
    const targetUsername = params.get("user");

    let activeConvId = null;
    let searchFilter = "";

    if (targetUsername) {
      const targetUser = window.Users.getByUsername(targetUsername);
      if (targetUser && targetUser.id !== currentUser.id) {
        const conv = window.Chat.getOrCreateConversation(targetUser.id);
        if (conv) {
          activeConvId = conv.id;
          if (chatContainer) chatContainer.classList.add("mobile-chat-open");
        }
      }
    }

    const allConvsInitial = window.Chat.getConversationsForUser(currentUser.id);
    if (!activeConvId && allConvsInitial.length > 0) {
      activeConvId = allConvsInitial[0].id;
    }
    window.activeChatConvId = activeConvId;

    const getPartner = (conv) => {
      const partnerId = (conv.participants || []).find(
        (id) => id !== currentUser.id,
      );
      return window.Users.getById(partnerId);
    };

    const renderConversationList = () => {
      if (!convListEl) return;
      const convs = window.Chat.getConversationsForUser(currentUser.id).filter(
        (c) => {
          const partner = getPartner(c);
          if (!partner) return false;
          if (!searchFilter) return true;
          return (
            partner.name.toLowerCase().includes(searchFilter) ||
            partner.username.toLowerCase().includes(searchFilter)
          );
        },
      );

      if (convs.length === 0) {
        convListEl.innerHTML = `
          <div style="padding:var(--space-6) var(--space-4); text-align:center;">
            <p class="text-xs text-muted">Tidak ada percakapan ditemukan.</p>
          </div>
        `;
        return;
      }

      convListEl.innerHTML = convs
        .map((c) => {
          const partner = getPartner(c);
          if (!partner) return "";
          const av =
            window.Storage.resolveMedia(partner.avatar) ||
            window.UI.getFallbackAvatar(partner.name);
          const msgs = c.messages || [];
          const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null;
          const unreadCount = msgs.filter(
            (m) => m.senderId !== currentUser.id && !m.read,
          ).length;

          return `
            <div
              class="chat-conv-item ${c.id === activeConvId ? "active" : ""}"
              data-conv-id="${c.id}"
              role="button"
              tabindex="0"
            >
              <div class="avatar-wrapper">
                <img
                  src="${av}"
                  alt="${window.Storage.escapeHtml(partner.name)}"
                  class="avatar avatar-md"
                  onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(partner.name)}';"
                />
                <span class="status-dot" title="Online"></span>
              </div>
              <div class="chat-conv-info">
                <div class="chat-conv-top">
                  <span class="chat-conv-name">${window.Storage.escapeHtml(partner.name)}</span>
                  <span class="chat-conv-time">
                    ${lastMsg ? window.UI.formatRelativeTime(lastMsg.createdAt) : ""}
                  </span>
                </div>
                <div class="flex items-center justify-between gap-2">
                  <span class="chat-conv-preview">
                    ${
                      lastMsg
                        ? `${lastMsg.senderId === currentUser.id ? "Anda: " : ""}${window.Storage.escapeHtml(lastMsg.text)}`
                        : "Mulai percakapan baru..."
                    }
                  </span>
                  ${
                    unreadCount > 0
                      ? `<span class="badge-count">${unreadCount}</span>`
                      : ""
                  }
                </div>
              </div>
            </div>
          `;
        })
        .join("");

      convListEl.querySelectorAll("[data-conv-id]").forEach((item) => {
        item.addEventListener("click", () => {
          activeConvId = item.getAttribute("data-conv-id");
          window.activeChatConvId = activeConvId;
          window.Chat.markAsRead(activeConvId);
          if (chatContainer) chatContainer.classList.add("mobile-chat-open");
          renderConversationList();
          renderActiveChatWindow();
        });
      });
    };

    const renderActiveChatWindow = () => {
      if (!chatWindowEl) return;
      const conv = activeConvId ? window.Chat.getById(activeConvId) : null;
      if (!conv) {
        chatWindowEl.innerHTML = `
          <div class="empty-state" style="margin:auto; border:none; background:transparent;">
            <div class="empty-state-icon"><i class="fa-regular fa-comments"></i></div>
            <h3 class="empty-state-title">Pilih Percakapan</h3>
            <p class="empty-state-desc">Pilih salah satu kontak di sebelah kiri atau mulai obrolan baru.</p>
          </div>
        `;
        return;
      }

      window.Chat.markAsRead(conv.id);
      const partner = getPartner(conv);
      if (!partner) return;

      const partnerAv =
        window.Storage.resolveMedia(partner.avatar) ||
        window.UI.getFallbackAvatar(partner.name);

      chatWindowEl.innerHTML = `
        <header class="chat-window-header">
          <div class="flex items-center gap-3">
            <button type="button" class="btn-icon" id="chat-mobile-back" aria-label="Kembali ke daftar pesan">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <a href="profile.html?user=${encodeURIComponent(partner.username)}" class="flex items-center gap-2">
              <div class="avatar-wrapper">
                <img
                  src="${partnerAv}"
                  alt="${window.Storage.escapeHtml(partner.name)}"
                  class="avatar avatar-sm"
                  onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(partner.name)}';"
                />
                <span class="status-dot"></span>
              </div>
              <div>
                <div class="text-sm font-bold" style="color:var(--text-primary);">
                  ${window.Storage.escapeHtml(partner.name)}
                </div>
                <div class="text-xs text-success" id="chat-partner-status">Online &bull; Aktif sekarang</div>
              </div>
            </a>
          </div>

          <button type="button" class="btn-icon text-danger" id="btn-delete-conv" title="Hapus Percakapan" aria-label="Hapus Percakapan">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </header>

        <div class="chat-messages-area" id="chat-messages-scroll">
          ${this.renderMessagesBubblesHtml(conv, currentUser, partner)}
        </div>

        <form class="chat-input-bar" id="chat-send-form">
          <div class="emoji-picker-popover hidden" id="chat-emoji-popover">
            ${window.Chat.getEmojis()
              .map(
                (em) =>
                  `<button type="button" class="emoji-btn" data-chat-emoji="${em}">${em}</button>`,
              )
              .join("")}
          </div>
          <button type="button" class="btn-icon" id="chat-emoji-btn" aria-label="Pilih Emoji">
            <i class="fa-regular fa-face-smile"></i>
          </button>
          <input
            type="text"
            id="chat-message-input"
            class="form-control"
            placeholder="Tulis pesan untuk @${window.Storage.escapeHtml(partner.username)}..."
            autocomplete="off"
            required
          />
          <button type="submit" class="btn btn-primary" aria-label="Kirim Pesan">
            <i class="fa-solid fa-paper-plane"></i>
          </button>
        </form>
      `;

      const scrollArea = chatWindowEl.querySelector("#chat-messages-scroll");
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }

      const backBtn = chatWindowEl.querySelector("#chat-mobile-back");
      if (backBtn) {
        backBtn.addEventListener("click", () => {
          if (chatContainer) chatContainer.classList.remove("mobile-chat-open");
        });
      }

      const delBtn = chatWindowEl.querySelector("#btn-delete-conv");
      if (delBtn) {
        delBtn.addEventListener("click", async () => {
          const ok = await window.UI.confirmDialog({
            title: "Hapus Percakapan?",
            message: `Seluruh riwayat pesan dengan @${partner.username} akan dihapus.`,
            confirmText: "Hapus",
            danger: true,
          });
          if (ok) {
            window.Chat.deleteConversation(conv.id);
            activeConvId = null;
            if (chatContainer)
              chatContainer.classList.remove("mobile-chat-open");
            renderConversationList();
            renderActiveChatWindow();
          }
        });
      }

      const emojiBtn = chatWindowEl.querySelector("#chat-emoji-btn");
      const emojiPopover = chatWindowEl.querySelector("#chat-emoji-popover");
      const msgInput = chatWindowEl.querySelector("#chat-message-input");

      if (emojiBtn && emojiPopover && msgInput) {
        emojiBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          emojiPopover.classList.toggle("hidden");
        });

        emojiPopover.addEventListener("click", (e) => {
          const btn = e.target.closest("[data-chat-emoji]");
          if (!btn) return;
          msgInput.value += btn.getAttribute("data-chat-emoji");
          msgInput.focus();
        });
      }

      const sendForm = chatWindowEl.querySelector("#chat-send-form");
      if (sendForm) {
        sendForm.addEventListener("submit", (e) => {
          e.preventDefault();
          const text = msgInput.value.trim();
          if (!text) return;

          window.Chat.sendMessage(conv.id, text);
          msgInput.value = "";
          if (emojiPopover) emojiPopover.classList.add("hidden");

          // Re-render bubbles & conversation sidebar preview
          const updatedConv = window.Chat.getById(conv.id);
          scrollArea.innerHTML = this.renderMessagesBubblesHtml(
            updatedConv,
            currentUser,
            partner,
          );
          scrollArea.scrollTop = scrollArea.scrollHeight;
          renderConversationList();

          // Trigger simulated partner read receipt, typing indicator & contextual bot reply
          window.Chat.simulatePartnerResponse({
            convId: conv.id,
            partnerUser: partner,
            userText: text,
            onReadReceipt: () => {
              if (activeConvId === conv.id && scrollArea) {
                const cNow = window.Chat.getById(conv.id);
                scrollArea.innerHTML = this.renderMessagesBubblesHtml(
                  cNow,
                  currentUser,
                  partner,
                );
                scrollArea.scrollTop = scrollArea.scrollHeight;
              }
            },
            onTypingStart: () => {
              if (activeConvId === conv.id && scrollArea) {
                const statusEl = document.getElementById("chat-partner-status");
                if (statusEl) statusEl.textContent = "sedang mengetik...";

                const typingRow = document.createElement("div");
                typingRow.id = "typing-indicator-row";
                typingRow.className = "message-row theirs";
                typingRow.innerHTML = `
                  <div class="typing-indicator" aria-label="${window.Storage.escapeHtml(partner.name)} sedang mengetik">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                  </div>
                `;
                scrollArea.appendChild(typingRow);
                scrollArea.scrollTop = scrollArea.scrollHeight;
              }
            },
            onReplyArrived: () => {
              renderConversationList();
              if (activeConvId === conv.id && scrollArea) {
                const statusEl = document.getElementById("chat-partner-status");
                if (statusEl)
                  statusEl.innerHTML = "Online &bull; Aktif sekarang";

                const cNow = window.Chat.getById(conv.id);
                scrollArea.innerHTML = this.renderMessagesBubblesHtml(
                  cNow,
                  currentUser,
                  partner,
                );
                scrollArea.scrollTop = scrollArea.scrollHeight;
              }
            },
          });
        });
      }
    };

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchFilter = searchInput.value.trim().toLowerCase();
        renderConversationList();
      });
    }

    if (newChatBtn) {
      newChatBtn.addEventListener("click", () => {
        const others = window.Users.getAll().filter(
          (u) => u.id !== currentUser.id,
        );
        const bodyHtml = `
          <div class="suggestion-list">
            ${others
              .map((u) => {
                const av =
                  window.Storage.resolveMedia(u.avatar) ||
                  window.UI.getFallbackAvatar(u.name);
                return `
                  <div class="suggestion-item" style="padding:var(--space-2) 0; border-bottom:1px solid var(--border-color);">
                    <div class="suggestion-user">
                      <img src="${av}" alt="${window.Storage.escapeHtml(u.name)}" class="avatar avatar-md" onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(u.name)}';" />
                      <div class="suggestion-meta">
                        <span class="suggestion-name">${window.Storage.escapeHtml(u.name)}</span>
                        <span class="suggestion-handle">@${window.Storage.escapeHtml(u.username)}</span>
                      </div>
                    </div>
                    <button type="button" class="btn btn-primary btn-sm" data-start-chat="${u.id}">
                      <i class="fa-regular fa-paper-plane"></i> Mulai Chat
                    </button>
                  </div>
                `;
              })
              .join("")}
          </div>
        `;
        window.UI.openModal({
          title: "Mulai Percakapan Baru",
          bodyHtml,
          onMount: (modalEl) => {
            modalEl.querySelectorAll("[data-start-chat]").forEach((btn) => {
              btn.addEventListener("click", () => {
                const uid = btn.getAttribute("data-start-chat");
                const conv = window.Chat.getOrCreateConversation(uid);
                window.UI.closeModal();
                if (conv) {
                  activeConvId = conv.id;
                  window.activeChatConvId = activeConvId;
                  if (chatContainer)
                    chatContainer.classList.add("mobile-chat-open");
                  renderConversationList();
                  renderActiveChatWindow();
                }
              });
            });
          },
        });
      });
    }

    renderConversationList();
    renderActiveChatWindow();
  }

  /**
   * Render message bubbles inside the active chat window
   */
  renderMessagesBubblesHtml(conv, currentUser, partner) {
    const msgs = conv.messages || [];
    if (msgs.length === 0) {
      return `
        <div style="text-align:center; margin:auto; padding:var(--space-6);">
          <p class="text-sm text-muted">Belum ada pesan. Kirim sapaan pertama ke <strong>${window.Storage.escapeHtml(partner.name)}</strong>! 👋</p>
        </div>
      `;
    }

    return msgs
      .map((m) => {
        const isMine = m.senderId === currentUser.id;
        const timeStr = new Date(m.createdAt).toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
        });
        return `
          <div class="message-row ${isMine ? "mine" : "theirs"}">
            <div class="message-bubble">
              <div>${window.Storage.escapeHtml(m.text)}</div>
              <div class="message-meta">
                <span>${timeStr}</span>
                ${
                  isMine
                    ? `<span class="read-receipt ${m.read ? "read" : ""}" title="${m.read ? "Dibaca" : "Terkirim"}">
                        <i class="fa-solid ${m.read ? "fa-check-double" : "fa-check"}"></i>
                      </span>`
                    : ""
                }
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  /* ==========================================================================
     6. NOTIFICATIONS PAGE (notifications.html)
     ========================================================================== */
  initNotificationsPage() {
    const currentUser = window.Auth.getCurrentUser();
    const listContainer = document.getElementById("notifications-list");
    const markAllBtn = document.getElementById("btn-mark-all-read");
    const simulateBtn = document.getElementById("btn-simulate-notif");

    let activeFilter = "all";

    const iconConfig = {
      like: { cls: "notif-type-like", icon: "fa-solid fa-heart" },
      comment: { cls: "notif-type-comment", icon: "fa-solid fa-comment-dots" },
      follow: { cls: "notif-type-follow", icon: "fa-solid fa-user-plus" },
      mention: { cls: "notif-type-mention", icon: "fa-solid fa-at" },
      repost: { cls: "notif-type-repost", icon: "fa-solid fa-retweet" },
    };

    const renderNotifications = () => {
      if (!listContainer) return;
      const items = window.Notifications.getForUser(
        currentUser.id,
        activeFilter,
      );

      if (items.length === 0) {
        listContainer.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon"><i class="fa-regular fa-bell-slash"></i></div>
            <h3 class="empty-state-title">Tidak Ada Notifikasi</h3>
            <p class="empty-state-desc">Semua aktivitas baru seperti suka, komentar, dan pengikut baru akan muncul di sini.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = items
        .map((n) => {
          const actor = window.Users.getById(n.actorId);
          const actorName = actor ? actor.name : "Pengguna Konekta";
          const actorUsername = actor ? actor.username : "";
          const av = actor
            ? window.Storage.resolveMedia(actor.avatar) ||
              window.UI.getFallbackAvatar(actor.name)
            : window.UI.getFallbackAvatar("K");
          const cfg = iconConfig[n.type] || iconConfig.like;

          return `
            <div
              class="notification-item ${!n.read ? "unread" : ""}"
              data-notif-id="${n.id}"
              data-actor-username="${window.Storage.escapeHtml(actorUsername)}"
            >
              <div class="notif-type-icon ${cfg.cls}">
                <i class="${cfg.icon}"></i>
              </div>
              <img
                src="${av}"
                alt="${window.Storage.escapeHtml(actorName)}"
                class="avatar avatar-md"
                onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(actorName)}';"
              />
              <div style="flex:1; min-width:0;">
                <p class="text-sm" style="margin-bottom:2px;">
                  <strong>${window.Storage.escapeHtml(actorName)}</strong>
                  <span>${window.Storage.escapeHtml(n.text)}</span>
                </p>
                <span class="text-xs text-muted">${window.UI.formatRelativeTime(n.createdAt)}</span>
              </div>
              ${!n.read ? '<span class="badge-count" style="min-width:10px; height:10px; padding:0;"></span>' : ""}
            </div>
          `;
        })
        .join("");

      listContainer.querySelectorAll("[data-notif-id]").forEach((row) => {
        row.addEventListener("click", () => {
          const nid = row.getAttribute("data-notif-id");
          const uname = row.getAttribute("data-actor-username");
          window.Notifications.markAsRead(nid);
          if (uname) {
            window.location.href = `profile.html?user=${encodeURIComponent(uname)}`;
          } else {
            renderNotifications();
          }
        });
      });
    };

    document.querySelectorAll("[data-notif-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll("[data-notif-tab]")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.getAttribute("data-notif-tab");
        renderNotifications();
      });
    });

    if (markAllBtn) {
      markAllBtn.addEventListener("click", () => {
        window.Notifications.markAllAsRead(currentUser.id);
        window.UI.showToast(
          "Semua notifikasi ditandai sudah dibaca.",
          "success",
        );
        renderNotifications();
      });
    }

    if (simulateBtn) {
      simulateBtn.addEventListener("click", () => {
        window.Notifications.simulateIncomingActivity();
        renderNotifications();
      });
    }

    renderNotifications();
  }

  /* ==========================================================================
     7. SETTINGS PAGE (settings.html)
     ========================================================================== */
  initSettingsPage() {
    window.Auth.bindPasswordToggles(document);

    // 1. Theme Option Cards
    const currentThemePref = window.Storage.get(
      window.STORAGE_KEYS.THEME,
      "system",
    );
    const updateThemeCardsUI = (pref) => {
      document.querySelectorAll("[data-theme-choice]").forEach((card) => {
        card.classList.toggle(
          "active",
          card.getAttribute("data-theme-choice") === pref,
        );
      });
    };
    updateThemeCardsUI(currentThemePref);

    document.querySelectorAll("[data-theme-choice]").forEach((card) => {
      card.addEventListener("click", () => {
        const chosen = card.getAttribute("data-theme-choice");
        window.UI.applyTheme(chosen, true);
        updateThemeCardsUI(chosen);
        window.UI.showToast("Preferensi tema berhasil disimpan.", "success");
      });
    });

    // 2. Account Settings Form (Username, Name, Privacy)
    const currentUser = window.Auth.getCurrentUser();
    const usernameInput = document.getElementById("settings-username");
    const nameInput = document.getElementById("settings-name");
    const privateToggle = document.getElementById("settings-private-toggle");
    const accountForm = document.getElementById("settings-account-form");

    if (usernameInput) usernameInput.value = currentUser.username;
    if (nameInput) nameInput.value = currentUser.name;
    if (privateToggle) privateToggle.checked = Boolean(currentUser.isPrivate);

    if (accountForm) {
      accountForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const res = await window.Users.updateProfile(currentUser.id, {
          username: usernameInput.value,
          name: nameInput.value,
          isPrivate: privateToggle.checked,
        });

        if (!res.ok) {
          window.UI.showToast(res.error, "error");
          return;
        }
        window.UI.showToast("Pengaturan akun berhasil disimpan!", "success");
        window.UI.renderNavigation("settings");
      });
    }

    // 3. Password Form
    const passwordForm = document.getElementById("settings-password-form");
    if (passwordForm) {
      passwordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const curPass = document.getElementById(
          "settings-current-password",
        ).value;
        const newPass = document.getElementById("settings-new-password").value;
        const res = await window.Auth.updatePassword(curPass, newPass);

        if (!res.ok) {
          window.UI.showToast(res.message, "error");
          return;
        }
        passwordForm.reset();
        window.UI.showToast(res.message, "success");
      });
    }

    // 4. Blocked & Muted Users Management
    const renderBlockedMutedList = () => {
      const container = document.getElementById("settings-blocked-muted-list");
      if (!container) return;

      const freshMe = window.Auth.getCurrentUser();
      const blockedIds = freshMe.blockedUsers || [];
      const mutedIds = freshMe.mutedUsers || [];

      if (blockedIds.length === 0 && mutedIds.length === 0) {
        container.innerHTML =
          '<p class="text-xs text-muted">Tidak ada pengguna yang sedang diblokir atau dibisukan.</p>';
        return;
      }

      const rows = [];
      blockedIds.forEach((id) => {
        const u = window.Users.getById(id);
        if (u) {
          rows.push(`
            <div class="setting-row">
              <div>
                <div class="text-sm font-semibold">@${window.Storage.escapeHtml(u.username)}</div>
                <span class="text-xs text-danger">Status: Diblokir</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-unblock-id="${u.id}">Buka Blokir</button>
            </div>
          `);
        }
      });

      mutedIds.forEach((id) => {
        const u = window.Users.getById(id);
        if (u) {
          rows.push(`
            <div class="setting-row">
              <div>
                <div class="text-sm font-semibold">@${window.Storage.escapeHtml(u.username)}</div>
                <span class="text-xs text-muted">Status: Dibisukan</span>
              </div>
              <button type="button" class="btn btn-secondary btn-sm" data-unmute-id="${u.id}">Bunyikan</button>
            </div>
          `);
        }
      });

      container.innerHTML = rows.join("");

      container.querySelectorAll("[data-unblock-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.Users.toggleBlock(btn.getAttribute("data-unblock-id"));
          renderBlockedMutedList();
        });
      });

      container.querySelectorAll("[data-unmute-id]").forEach((btn) => {
        btn.addEventListener("click", () => {
          window.Users.toggleMute(btn.getAttribute("data-unmute-id"));
          renderBlockedMutedList();
        });
      });
    };
    renderBlockedMutedList();

    // 5. Storage Usage Indicator
    const usageEl = document.getElementById("settings-storage-usage");
    if (usageEl) {
      const kb = window.Storage.getStorageUsageKB();
      usageEl.textContent = `${kb} KB digunakan dari ~5.000 KB kuota localStorage`;
    }

    // 6. Reset All Data & Delete Account
    const resetBtn = document.getElementById("btn-reset-all-data");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        const confirmed = await window.UI.confirmDialog({
          title: "Reset Semua Data Aplikasi?",
          message:
            "Seluruh postingan baru, akun baru, dan pesan akan dihapus dan dikembalikan ke data awal (Seed).",
          confirmText: "Ya, Reset Data",
          danger: true,
        });
        if (confirmed) {
          await window.Storage.clearAll();
          window.Seed.seedAll();
          window.location.href = "index.html";
        }
      });
    }

    const deleteAccBtn = document.getElementById("btn-delete-account");
    if (deleteAccBtn) {
      deleteAccBtn.addEventListener("click", async () => {
        const confirmed = await window.UI.confirmDialog({
          title: "Hapus Akun Secara Permanen?",
          message: `Akun @${currentUser.username} beserta seluruh postingan Anda akan dihapus secara permanen dari browser ini.`,
          confirmText: "Ya, Hapus Akun Saya",
          danger: true,
        });
        if (confirmed) {
          window.Auth.deleteCurrentAccount();
        }
      });
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new AppController();
  app.init();
});
