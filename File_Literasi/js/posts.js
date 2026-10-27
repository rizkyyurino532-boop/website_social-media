/**
 * ==========================================================================
 * POSTS.JS - Posts CRUD, Multi-Image Upload, Likes, Nested Comments,
 * Trending Hashtags, Infinite Scroll (IntersectionObserver) & 24h Stories
 * ==========================================================================
 */

const MAX_POST_CHARS = 280;
const STORY_TTL_MS = 24 * 60 * 60 * 1000; // 24 Hours

class PostService {
  constructor() {
    this.storyTimer = null;
  }

  /**
   * Get all posts sorted newest first
   * @returns {Array<Object>}
   */
  getAll() {
    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    return posts.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get post by ID
   * @param {string} postId
   * @returns {Object|null}
   */
  getById(postId) {
    const posts = this.getAll();
    return posts.find((p) => p.id === postId) || null;
  }

  /**
   * Filter posts for Home Feed ('following' or 'foryou')
   * Excludes blocked and muted users
   * @param {'following'|'foryou'|'bookmarks'} mode
   * @returns {Array<Object>}
   */
  getFeedPosts(mode = "following") {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return [];

    const blocked = currentUser.blockedUsers || [];
    const muted = currentUser.mutedUsers || [];
    const following = currentUser.following || [];

    const allPosts = this.getAll().filter(
      (p) => !blocked.includes(p.userId) && !muted.includes(p.userId),
    );

    if (mode === "bookmarks") {
      return allPosts.filter(
        (p) =>
          (p.bookmarks || []).includes(currentUser.id) ||
          (currentUser.bookmarks || []).includes(p.id),
      );
    }

    if (mode === "following") {
      const allowedAuthors = new Set([currentUser.id, ...following]);
      return allPosts.filter(
        (p) =>
          allowedAuthors.has(p.userId) ||
          (p.reposts || []).some((repUserId) => allowedAuthors.has(repUserId)),
      );
    }

    // 'foryou' shows all non-blocked/muted posts
    return allPosts;
  }

  /**
   * Get posts for a specific profile tab ('posts' | 'media' | 'likes')
   * @param {string} profileUserId
   * @param {'posts'|'media'|'likes'} tab
   * @returns {Array<Object>}
   */
  getProfilePosts(profileUserId, tab = "posts") {
    const allPosts = this.getAll();

    if (tab === "media") {
      return allPosts.filter(
        (p) =>
          p.userId === profileUserId &&
          Array.isArray(p.images) &&
          p.images.length > 0,
      );
    }

    if (tab === "likes") {
      return allPosts.filter((p) => (p.likes || []).includes(profileUserId));
    }

    // 'posts' includes authored posts and reposts by profileUserId
    return allPosts.filter(
      (p) =>
        p.userId === profileUserId || (p.reposts || []).includes(profileUserId),
    );
  }

  /**
   * Search posts by keyword or #hashtag
   * @param {string} query
   * @param {'popular'|'latest'} sortBy
   * @returns {Array<Object>}
   */
  searchPosts(query = "", sortBy = "popular") {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    const blocked = currentUser ? currentUser.blockedUsers || [] : [];
    const clean = String(query || "")
      .trim()
      .toLowerCase();

    let results = this.getAll().filter((p) => !blocked.includes(p.userId));

    if (clean) {
      results = results.filter((p) => {
        const author = window.Users ? window.Users.getById(p.userId) : null;
        const inContent = (p.content || "").toLowerCase().includes(clean);
        const inAuthor =
          author &&
          (author.name.toLowerCase().includes(clean) ||
            author.username.toLowerCase().includes(clean));
        return inContent || inAuthor;
      });
    }

    if (sortBy === "popular") {
      results.sort((a, b) => {
        const scoreA =
          (a.likes || []).length * 2 +
          (a.comments || []).length * 3 +
          (a.reposts || []).length * 2;
        const scoreB =
          (b.likes || []).length * 2 +
          (b.comments || []).length * 3 +
          (b.reposts || []).length * 2;
        return scoreB - scoreA || b.createdAt - a.createdAt;
      });
    } else {
      results.sort((a, b) => b.createdAt - a.createdAt);
    }

    return results;
  }

  /**
   * Calculate trending hashtags across all posts
   * @param {number} limit
   * @returns {Array<{tag: string, count: number}>}
   */
  getTrendingHashtags(limit = 8) {
    const posts = this.getAll();
    const counts = new Map();
    const displayMap = new Map();
    const regex = /(?:^|\s)#([a-zA-Z0-9_]+)/g;

    posts.forEach((post) => {
      const text = post.content || "";
      let match;
      while ((match = regex.exec(text)) !== null) {
        const rawTag = match[1];
        const lower = rawTag.toLowerCase();
        counts.set(lower, (counts.get(lower) || 0) + 1);
        if (!displayMap.has(lower)) {
          displayMap.set(lower, rawTag);
        }
      }
    });

    return Array.from(counts.entries())
      .map(([lower, count]) => ({
        tag: displayMap.get(lower) || lower,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Create a new post with optional multi-image attachments
   * @param {Object} payload
   * @param {string} payload.content
   * @param {Array<string>} [payload.imageDataUrls]
   * @returns {Promise<{ok: boolean, error?: string, post?: Object}>}
   */
  async createPost({ content, imageDataUrls = [] }) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser)
      return { ok: false, error: "Silakan masuk terlebih dahulu." };

    const cleanContent = String(content || "").trim();
    if (!cleanContent && imageDataUrls.length === 0) {
      return {
        ok: false,
        error: "Tulis sesuatu atau tambahkan gambar untuk diposting.",
      };
    }

    if (cleanContent.length > MAX_POST_CHARS) {
      return {
        ok: false,
        error: `Teks postingan melebihi batas maksimal ${MAX_POST_CHARS} karakter.`,
      };
    }

    const storedImages = [];
    for (const dataUrl of imageDataUrls.slice(0, 4)) {
      const ref = await window.Storage.saveMedia(dataUrl);
      storedImages.push(ref);
    }

    const newPost = {
      id: window.Storage.generateId("post"),
      userId: currentUser.id,
      content: cleanContent,
      images: storedImages,
      likes: [],
      reposts: [],
      bookmarks: [],
      comments: [],
      createdAt: Date.now(),
    };

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    posts.unshift(newPost);
    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);

    // Notify mentioned @users
    if (window.Notifications && cleanContent) {
      window.Notifications.notifyMentions(
        cleanContent,
        currentUser.id,
        newPost.id,
      );
    }

    return { ok: true, post: newPost };
  }

  /**
   * Update content of an existing post owned by current user
   * @param {string} postId
   * @param {string} newContent
   * @returns {{ok: boolean, error?: string}}
   */
  updatePost(postId, newContent) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    const clean = String(newContent || "").trim();

    if (!clean) {
      return { ok: false, error: "Isi postingan tidak boleh kosong." };
    }
    if (clean.length > MAX_POST_CHARS) {
      return { ok: false, error: `Maksimal ${MAX_POST_CHARS} karakter.` };
    }

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const idx = posts.findIndex((p) => p.id === postId);
    if (idx === -1) return { ok: false, error: "Postingan tidak ditemukan." };
    if (posts[idx].userId !== currentUser.id) {
      return {
        ok: false,
        error: "Anda hanya dapat mengedit postingan milik sendiri.",
      };
    }

    posts[idx].content = clean;
    posts[idx].editedAt = Date.now();
    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);
    return { ok: true };
  }

  /**
   * Delete a post owned by current user
   * @param {string} postId
   * @returns {boolean}
   */
  deletePost(postId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return false;

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const target = posts.find((p) => p.id === postId);
    if (!target || target.userId !== currentUser.id) return false;

    const updated = posts.filter((p) => p.id !== postId);
    window.Storage.set(window.STORAGE_KEYS.POSTS, updated);
    return true;
  }

  /**
   * Toggle Like on a post
   * @param {string} postId
   * @returns {{liked: boolean, count: number}|null}
   */
  toggleLike(postId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return null;

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const post = posts.find((p) => p.id === postId);
    if (!post) return null;

    post.likes = post.likes || [];
    const hasLiked = post.likes.includes(currentUser.id);

    if (hasLiked) {
      post.likes = post.likes.filter((id) => id !== currentUser.id);
    } else {
      post.likes.push(currentUser.id);
      if (window.Notifications && post.userId !== currentUser.id) {
        window.Notifications.create({
          userId: post.userId,
          actorId: currentUser.id,
          type: "like",
          postId: post.id,
          text: "menyukai postingan Anda",
        });
      }
    }

    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);
    return { liked: !hasLiked, count: post.likes.length };
  }

  /**
   * Toggle Repost on a post
   * @param {string} postId
   * @returns {{reposted: boolean, count: number}|null}
   */
  toggleRepost(postId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return null;

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const post = posts.find((p) => p.id === postId);
    if (!post) return null;

    post.reposts = post.reposts || [];
    const hasReposted = post.reposts.includes(currentUser.id);

    if (hasReposted) {
      post.reposts = post.reposts.filter((id) => id !== currentUser.id);
      if (window.UI) window.UI.showToast("Repost dibatalkan.", "info");
    } else {
      post.reposts.push(currentUser.id);
      if (window.Notifications && post.userId !== currentUser.id) {
        window.Notifications.create({
          userId: post.userId,
          actorId: currentUser.id,
          type: "repost",
          postId: post.id,
          text: "membagikan ulang (repost) postingan Anda",
        });
      }
      if (window.UI)
        window.UI.showToast(
          "Postingan dibagikan ulang ke profil Anda!",
          "success",
        );
    }

    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);
    return { reposted: !hasReposted, count: post.reposts.length };
  }

  /**
   * Toggle Bookmark on a post
   * @param {string} postId
   * @returns {{bookmarked: boolean}|null}
   */
  toggleBookmark(postId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return null;

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const post = posts.find((p) => p.id === postId);
    if (!post) return null;

    post.bookmarks = post.bookmarks || [];
    const isBookmarked = post.bookmarks.includes(currentUser.id);

    if (isBookmarked) {
      post.bookmarks = post.bookmarks.filter((id) => id !== currentUser.id);
      if (window.UI)
        window.UI.showToast("Dihapus dari daftar Tersimpan.", "info");
    } else {
      post.bookmarks.push(currentUser.id);
      if (window.UI)
        window.UI.showToast("Postingan disimpan ke Bookmark!", "success");
    }

    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);
    return { bookmarked: !isBookmarked };
  }

  /**
   * Add a comment to a post
   * @param {string} postId
   * @param {string} content
   * @returns {Object|null}
   */
  addComment(postId, content) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    const clean = String(content || "").trim();
    if (!currentUser || !clean) return null;

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const post = posts.find((p) => p.id === postId);
    if (!post) return null;

    post.comments = post.comments || [];
    const newComment = {
      id: window.Storage.generateId("comment"),
      userId: currentUser.id,
      content: clean.substring(0, 280),
      createdAt: Date.now(),
      replies: [],
    };

    post.comments.push(newComment);
    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);

    if (window.Notifications) {
      if (post.userId !== currentUser.id) {
        window.Notifications.create({
          userId: post.userId,
          actorId: currentUser.id,
          type: "comment",
          postId: post.id,
          text: `mengomentari postingan Anda: "${clean.substring(0, 50)}"`,
        });
      }
      window.Notifications.notifyMentions(clean, currentUser.id, post.id);
    }

    return newComment;
  }

  /**
   * Add a nested reply to a comment
   * @param {string} postId
   * @param {string} commentId
   * @param {string} content
   * @returns {Object|null}
   */
  addReply(postId, commentId, content) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    const clean = String(content || "").trim();
    if (!currentUser || !clean) return null;

    const posts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
    const post = posts.find((p) => p.id === postId);
    if (!post || !post.comments) return null;

    const comment = post.comments.find((c) => c.id === commentId);
    if (!comment) return null;

    comment.replies = comment.replies || [];
    const reply = {
      id: window.Storage.generateId("reply"),
      userId: currentUser.id,
      content: clean.substring(0, 280),
      createdAt: Date.now(),
    };

    comment.replies.push(reply);
    window.Storage.set(window.STORAGE_KEYS.POSTS, posts);

    if (window.Notifications) {
      if (comment.userId !== currentUser.id) {
        window.Notifications.create({
          userId: comment.userId,
          actorId: currentUser.id,
          type: "comment",
          postId: post.id,
          text: `membalas komentar Anda: "${clean.substring(0, 50)}"`,
        });
      }
      window.Notifications.notifyMentions(clean, currentUser.id, post.id);
    }

    return reply;
  }

  /**
   * Build HTML for a single Post Card
   * @param {Object} post
   * @returns {string}
   */
  renderPostCardHtml(post) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return "";

    const author = window.Users ? window.Users.getById(post.userId) : null;
    if (!author) return "";

    const isOwner = post.userId === currentUser.id;
    const isLiked = (post.likes || []).includes(currentUser.id);
    const isReposted = (post.reposts || []).includes(currentUser.id);
    const isBookmarked = (post.bookmarks || []).includes(currentUser.id);

    const commentCount = (post.comments || []).reduce(
      (sum, c) => sum + 1 + ((c.replies && c.replies.length) || 0),
      0,
    );

    const avatarSrc =
      window.Storage.resolveMedia(author.avatar) ||
      window.UI.getFallbackAvatar(author.name);

    const images = (post.images || [])
      .map((imgRef) => window.Storage.resolveMedia(imgRef))
      .filter(Boolean);

    return `
      <article class="post-card" data-post-id="${post.id}">
        ${
          isReposted
            ? `<div class="post-repost-banner">
                <i class="fa-solid fa-retweet"></i>
                <span>Anda membagikan ulang ini</span>
              </div>`
            : ""
        }

        <header class="post-header">
          <a href="profile.html?user=${encodeURIComponent(author.username)}" class="post-author">
            <img
              src="${avatarSrc}"
              alt="${window.Storage.escapeHtml(author.name)}"
              class="avatar avatar-md"
              onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(author.name)}';"
            />
            <div class="post-author-info">
              <div class="post-author-name">
                <span>${window.Storage.escapeHtml(author.name)}</span>
                ${author.verified ? '<i class="fa-solid fa-circle-check verified-badge" title="Terverifikasi"></i>' : ""}
              </div>
              <div class="post-meta">
                <span>@${window.Storage.escapeHtml(author.username)}</span>
                <span>&bull;</span>
                <time datetime="${new Date(post.createdAt).toISOString()}">
                  ${window.UI.formatRelativeTime(post.createdAt)}
                </time>
                ${post.editedAt ? "<span>(diedit)</span>" : ""}
              </div>
            </div>
          </a>

          <div class="dropdown">
            <button
              type="button"
              class="btn-icon post-menu-trigger"
              aria-label="Menu opsi postingan"
              data-post-menu="${post.id}"
            >
              <i class="fa-solid fa-ellipsis"></i>
            </button>
            <div class="dropdown-menu hidden" id="dropdown-${post.id}">
              ${
                isOwner
                  ? `
                    <button type="button" class="dropdown-item" data-action="edit-post" data-post-id="${post.id}">
                      <i class="fa-regular fa-pen-to-square"></i> Edit Postingan
                    </button>
                    <button type="button" class="dropdown-item danger" data-action="delete-post" data-post-id="${post.id}">
                      <i class="fa-regular fa-trash-can"></i> Hapus Postingan
                    </button>
                  `
                  : `
                    <button type="button" class="dropdown-item" data-action="mute-user" data-user-id="${author.id}">
                      <i class="fa-solid fa-volume-xmark"></i> Bisukan @${window.Storage.escapeHtml(author.username)}
                    </button>
                    <button type="button" class="dropdown-item danger" data-action="block-user" data-user-id="${author.id}">
                      <i class="fa-solid fa-ban"></i> Blokir @${window.Storage.escapeHtml(author.username)}
                    </button>
                    <button type="button" class="dropdown-item danger" data-action="report-post" data-post-id="${post.id}">
                      <i class="fa-regular fa-flag"></i> Laporkan Postingan
                    </button>
                  `
              }
            </div>
          </div>
        </header>

        ${
          post.content
            ? `<div class="post-content">${window.UI.formatPostText(post.content)}</div>`
            : ""
        }

        ${
          images.length > 0
            ? `<div class="post-media-grid count-${Math.min(images.length, 4)}">
                ${images
                  .map(
                    (src, idx) => `
                  <div class="post-media-item" data-lightbox-src="${src}" data-lightbox-alt="Foto postingan @${window.Storage.escapeHtml(author.username)} (${idx + 1})">
                    <img src="${src}" alt="Lampiran gambar postingan ${idx + 1}" loading="lazy" />
                  </div>
                `,
                  )
                  .join("")}
              </div>`
            : ""
        }

        <footer class="post-actions">
          <button
            type="button"
            class="post-action-btn like-btn ${isLiked ? "active" : ""}"
            data-action="like"
            data-post-id="${post.id}"
            aria-label="Sukai postingan"
          >
            <i class="${isLiked ? "fa-solid" : "fa-regular"} fa-heart"></i>
            <span class="action-count">${(post.likes || []).length}</span>
          </button>

          <button
            type="button"
            class="post-action-btn comment-btn"
            data-action="toggle-comments"
            data-post-id="${post.id}"
            aria-label="Komentar"
          >
            <i class="fa-regular fa-comment"></i>
            <span class="action-count">${commentCount}</span>
          </button>

          <button
            type="button"
            class="post-action-btn repost-btn ${isReposted ? "active" : ""}"
            data-action="repost"
            data-post-id="${post.id}"
            aria-label="Repost"
          >
            <i class="fa-solid fa-retweet"></i>
            <span class="action-count">${(post.reposts || []).length}</span>
          </button>

          <button
            type="button"
            class="post-action-btn bookmark-btn ${isBookmarked ? "active" : ""}"
            data-action="bookmark"
            data-post-id="${post.id}"
            aria-label="Simpan ke Bookmark"
          >
            <i class="${isBookmarked ? "fa-solid" : "fa-regular"} fa-bookmark"></i>
          </button>
        </footer>

        <section class="comments-section hidden" id="comments-section-${post.id}">
          <form class="comment-form" data-comment-form="${post.id}">
            <input
              type="text"
              class="form-control"
              placeholder="Tulis komentar yang sopan..."
              maxlength="280"
              required
              aria-label="Tulis komentar"
            />
            <button type="submit" class="btn btn-primary btn-sm">Kirim</button>
          </form>
          <div class="comments-list" id="comments-list-${post.id}">
            ${this.renderCommentsListHtml(post)}
          </div>
        </section>
      </article>
    `;
  }

  /**
   * Render nested comments and replies HTML for a post
   * @param {Object} post
   * @returns {string}
   */
  renderCommentsListHtml(post) {
    const comments = post.comments || [];
    if (comments.length === 0) {
      return '<p class="text-xs text-muted" style="text-align:center; padding:var(--space-2);">Belum ada komentar. Jadilah yang pertama berkomentar!</p>';
    }

    return comments
      .map((c) => {
        const cUser = window.Users ? window.Users.getById(c.userId) : null;
        if (!cUser) return "";
        const cAv =
          window.Storage.resolveMedia(cUser.avatar) ||
          window.UI.getFallbackAvatar(cUser.name);

        const repliesHtml = (c.replies || [])
          .map((r) => {
            const rUser = window.Users ? window.Users.getById(r.userId) : null;
            if (!rUser) return "";
            const rAv =
              window.Storage.resolveMedia(rUser.avatar) ||
              window.UI.getFallbackAvatar(rUser.name);
            return `
              <div class="comment-item" style="margin-bottom:var(--space-2);">
                <a href="profile.html?user=${encodeURIComponent(rUser.username)}">
                  <img
                    src="${rAv}"
                    alt="${window.Storage.escapeHtml(rUser.name)}"
                    class="avatar avatar-xs"
                    onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(rUser.name)}';"
                  />
                </a>
                <div class="comment-bubble">
                  <div class="comment-header">
                    <a href="profile.html?user=${encodeURIComponent(rUser.username)}" class="comment-author">
                      ${window.Storage.escapeHtml(rUser.name)}
                    </a>
                    <span class="comment-time">${window.UI.formatRelativeTime(r.createdAt)}</span>
                  </div>
                  <div class="comment-text">${window.UI.formatPostText(r.content)}</div>
                </div>
              </div>
            `;
          })
          .join("");

        return `
          <div class="comment-thread" data-comment-id="${c.id}">
            <div class="comment-item">
              <a href="profile.html?user=${encodeURIComponent(cUser.username)}">
                <img
                  src="${cAv}"
                  alt="${window.Storage.escapeHtml(cUser.name)}"
                  class="avatar avatar-sm"
                  onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(cUser.name)}';"
                />
              </a>
              <div style="flex:1; min-width:0;">
                <div class="comment-bubble">
                  <div class="comment-header">
                    <a href="profile.html?user=${encodeURIComponent(cUser.username)}" class="comment-author">
                      ${window.Storage.escapeHtml(cUser.name)}
                    </a>
                    <span class="comment-time">${window.UI.formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <div class="comment-text">${window.UI.formatPostText(c.content)}</div>
                </div>

                <div class="comment-footer-actions">
                  <button
                    type="button"
                    class="comment-reply-trigger"
                    data-action="show-reply-box"
                    data-post-id="${post.id}"
                    data-comment-id="${c.id}"
                    data-author="${window.Storage.escapeHtml(cUser.username)}"
                  >
                    <i class="fa-solid fa-reply"></i> Balas
                  </button>
                </div>

                <form
                  class="comment-form hidden"
                  id="reply-form-${c.id}"
                  data-reply-form="${post.id}"
                  data-comment-id="${c.id}"
                  style="margin-top:var(--space-2);"
                >
                  <input
                    type="text"
                    class="form-control"
                    placeholder="Balas @${window.Storage.escapeHtml(cUser.username)}..."
                    maxlength="280"
                    required
                  />
                  <button type="submit" class="btn btn-primary btn-sm">Balas</button>
                </form>

                ${repliesHtml ? `<div class="comment-replies">${repliesHtml}</div>` : ""}
              </div>
            </div>
          </div>
        `;
      })
      .join("");
  }

  /**
   * Bind delegated event listeners for all Post Cards inside a feed container
   * @param {HTMLElement} container
   * @param {Function} [onFeedMutated]
   */
  bindFeedEvents(container, onFeedMutated = null) {
    if (!container || container.dataset.boundEvents === "true") return;
    container.dataset.boundEvents = "true";

    // Close open dropdowns when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".dropdown")) {
        container
          .querySelectorAll(".dropdown-menu")
          .forEach((m) => m.classList.add("hidden"));
      }
    });

    container.addEventListener("click", async (e) => {
      // 1. Lightbox image click
      const mediaItem = e.target.closest("[data-lightbox-src]");
      if (mediaItem) {
        const src = mediaItem.getAttribute("data-lightbox-src");
        const alt = mediaItem.getAttribute("data-lightbox-alt");
        window.UI.openLightbox(src, alt);
        return;
      }

      // 2. Post dropdown menu trigger
      const menuTrigger = e.target.closest("[data-post-menu]");
      if (menuTrigger) {
        e.stopPropagation();
        const postId = menuTrigger.getAttribute("data-post-menu");
        const menu = container.querySelector(`#dropdown-${postId}`);
        container.querySelectorAll(".dropdown-menu").forEach((m) => {
          if (m !== menu) m.classList.add("hidden");
        });
        if (menu) menu.classList.toggle("hidden");
        return;
      }

      // 3. Action buttons
      const actionBtn = e.target.closest("[data-action]");
      if (!actionBtn) return;

      const action = actionBtn.getAttribute("data-action");
      const postId = actionBtn.getAttribute("data-post-id");
      const targetUserId = actionBtn.getAttribute("data-user-id");

      if (action === "like" && postId) {
        const res = this.toggleLike(postId);
        if (res) {
          actionBtn.classList.toggle("active", res.liked);
          const icon = actionBtn.querySelector("i");
          if (icon)
            icon.className = `${res.liked ? "fa-solid" : "fa-regular"} fa-heart`;
          const countEl = actionBtn.querySelector(".action-count");
          if (countEl) countEl.textContent = String(res.count);
        }
      } else if (action === "toggle-comments" && postId) {
        const sec = container.querySelector(`#comments-section-${postId}`);
        if (sec) {
          sec.classList.toggle("hidden");
          if (!sec.classList.contains("hidden")) {
            const input = sec.querySelector("input");
            if (input) input.focus();
          }
        }
      } else if (action === "repost" && postId) {
        const res = this.toggleRepost(postId);
        if (res) {
          actionBtn.classList.toggle("active", res.reposted);
          const countEl = actionBtn.querySelector(".action-count");
          if (countEl) countEl.textContent = String(res.count);
        }
      } else if (action === "bookmark" && postId) {
        const res = this.toggleBookmark(postId);
        if (res) {
          actionBtn.classList.toggle("active", res.bookmarked);
          const icon = actionBtn.querySelector("i");
          if (icon)
            icon.className = `${res.bookmarked ? "fa-solid" : "fa-regular"} fa-bookmark`;
        }
      } else if (action === "show-reply-box") {
        const commentId = actionBtn.getAttribute("data-comment-id");
        const replyForm = container.querySelector(`#reply-form-${commentId}`);
        if (replyForm) {
          replyForm.classList.toggle("hidden");
          if (!replyForm.classList.contains("hidden")) {
            replyForm.querySelector("input").focus();
          }
        }
      } else if (action === "edit-post" && postId) {
        this.openEditPostModal(postId, () => {
          if (typeof onFeedMutated === "function") onFeedMutated();
        });
      } else if (action === "delete-post" && postId) {
        const confirmed = await window.UI.confirmDialog({
          title: "Hapus Postingan?",
          message: "Postingan yang dihapus tidak dapat dikembalikan lagi.",
          confirmText: "Ya, Hapus",
          danger: true,
        });
        if (confirmed && this.deletePost(postId)) {
          window.UI.showToast("Postingan berhasil dihapus.", "info");
          const card = container.querySelector(`[data-post-id="${postId}"]`);
          if (card) card.remove();
          if (typeof onFeedMutated === "function") onFeedMutated();
        }
      } else if (action === "mute-user" && targetUserId) {
        window.Users.toggleMute(targetUserId);
        if (typeof onFeedMutated === "function") onFeedMutated();
      } else if (action === "block-user" && targetUserId) {
        const confirmed = await window.UI.confirmDialog({
          title: "Blokir Pengguna?",
          message:
            "Pengguna ini tidak akan bisa melihat postingan Anda atau berinteraksi dengan Anda.",
          confirmText: "Blokir",
          danger: true,
        });
        if (confirmed) {
          window.Users.toggleBlock(targetUserId);
          if (typeof onFeedMutated === "function") onFeedMutated();
        }
      } else if (action === "report-post" && postId) {
        this.openReportPostModal(postId);
      }
    });

    // Comment & Reply Form Submissions
    container.addEventListener("submit", (e) => {
      const commentForm = e.target.closest("[data-comment-form]");
      if (commentForm) {
        e.preventDefault();
        const postId = commentForm.getAttribute("data-comment-form");
        const input = commentForm.querySelector("input");
        const val = input.value.trim();
        if (!val) return;

        this.addComment(postId, val);
        input.value = "";
        this.refreshPostCommentsUI(container, postId);
        return;
      }

      const replyForm = e.target.closest("[data-reply-form]");
      if (replyForm) {
        e.preventDefault();
        const postId = replyForm.getAttribute("data-reply-form");
        const commentId = replyForm.getAttribute("data-comment-id");
        const input = replyForm.querySelector("input");
        const val = input.value.trim();
        if (!val) return;

        this.addReply(postId, commentId, val);
        input.value = "";
        this.refreshPostCommentsUI(container, postId);
      }
    });
  }

  /**
   * Refresh comments list and counter for a single post card in DOM
   * @param {HTMLElement} container
   * @param {string} postId
   */
  refreshPostCommentsUI(container, postId) {
    const post = this.getById(postId);
    if (!post) return;

    const listEl = container.querySelector(`#comments-list-${postId}`);
    if (listEl) {
      listEl.innerHTML = this.renderCommentsListHtml(post);
    }

    const card = container.querySelector(`[data-post-id="${postId}"]`);
    if (card) {
      const commentBtnCount = card.querySelector(".comment-btn .action-count");
      if (commentBtnCount) {
        const total = (post.comments || []).reduce(
          (sum, c) => sum + 1 + ((c.replies && c.replies.length) || 0),
          0,
        );
        commentBtnCount.textContent = String(total);
      }
    }
  }

  /**
   * Open modal to edit an existing post
   * @param {string} postId
   * @param {Function} onUpdated
   */
  openEditPostModal(postId, onUpdated) {
    const post = this.getById(postId);
    if (!post) return;

    const bodyHtml = `
      <form id="edit-post-form">
        <div class="form-group">
          <label class="form-label" for="edit-post-textarea">Konten Postingan</label>
          <textarea
            id="edit-post-textarea"
            class="form-control"
            rows="4"
            maxlength="${MAX_POST_CHARS}"
            required
          >${window.Storage.escapeHtml(post.content)}</textarea>
          <div class="flex justify-between items-center" style="margin-top:4px;">
            <span class="form-error" id="edit-post-error"></span>
            <span class="char-counter" id="edit-post-counter">${post.content.length}/${MAX_POST_CHARS}</span>
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" id="edit-post-cancel">Batal</button>
      <button type="button" class="btn btn-primary" id="edit-post-save">Simpan Perubahan</button>
    `;

    window.UI.openModal({
      title: "Edit Postingan",
      bodyHtml,
      footerHtml,
      onMount: (modalEl) => {
        const textarea = modalEl.querySelector("#edit-post-textarea");
        const counter = modalEl.querySelector("#edit-post-counter");
        const errorEl = modalEl.querySelector("#edit-post-error");

        textarea.addEventListener("input", () => {
          counter.textContent = `${textarea.value.length}/${MAX_POST_CHARS}`;
        });

        modalEl
          .querySelector("#edit-post-cancel")
          .addEventListener("click", () => {
            window.UI.closeModal();
          });

        modalEl
          .querySelector("#edit-post-save")
          .addEventListener("click", () => {
            const res = this.updatePost(postId, textarea.value);
            if (!res.ok) {
              errorEl.textContent = res.error;
              return;
            }
            window.UI.closeModal();
            window.UI.showToast("Postingan berhasil diperbarui!", "success");
            if (typeof onUpdated === "function") onUpdated();
          });
      },
    });
  }

  /**
   * Open modal to report a post
   * @param {string} postId
   */
  openReportPostModal(postId) {
    const bodyHtml = `
      <form id="report-post-form">
        <p class="text-sm text-secondary" style="margin-bottom:var(--space-3);">
          Mengapa Anda melaporkan postingan ini? Laporan bersifat anonim.
        </p>
        <div class="form-group">
          <select id="report-reason" class="form-control" required>
            <option value="spam">Spam atau iklan menyesatkan</option>
            <option value="hoax">Informasi palsu (Hoaks / Disinformasi Data)</option>
            <option value="harassment">Ujaran kebencian atau pelecehan</option>
            <option value="inappropriate">Konten tidak pantas</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="report-notes">Catatan Tambahan (Opsional)</label>
          <textarea id="report-notes" class="form-control" rows="2" placeholder="Berikan detail singkat..."></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" id="report-cancel">Batal</button>
      <button type="button" class="btn btn-danger" id="report-submit">Kirim Laporan</button>
    `;

    window.UI.openModal({
      title: "Laporkan Postingan",
      bodyHtml,
      footerHtml,
      onMount: (modalEl) => {
        modalEl
          .querySelector("#report-cancel")
          .addEventListener("click", () => {
            window.UI.closeModal();
          });

        modalEl
          .querySelector("#report-submit")
          .addEventListener("click", () => {
            const reason = modalEl.querySelector("#report-reason").value;
            const notes = modalEl.querySelector("#report-notes").value.trim();
            const currentUser = window.Auth.getCurrentUser();

            const reports = window.Storage.get(window.STORAGE_KEYS.REPORTS, []);
            reports.push({
              id: window.Storage.generateId("rep"),
              postId,
              reporterId: currentUser ? currentUser.id : "anon",
              reason,
              notes,
              createdAt: Date.now(),
            });
            window.Storage.set(window.STORAGE_KEYS.REPORTS, reports);

            window.UI.closeModal();
            window.UI.showToast(
              "Terima kasih! Laporan Anda telah diterima dan sedang ditinjau.",
              "success",
            );
          });
      },
    });
  }

  /**
   * Open Quick Post Composer Modal from any page via Sidebar button
   */
  openQuickPostModal() {
    const bodyHtml = `
      <form id="quick-post-form">
        <div class="form-group">
          <textarea
            id="quick-post-textarea"
            class="form-control"
            rows="4"
            maxlength="${MAX_POST_CHARS}"
            placeholder="Apa yang sedang Anda pikirkan? Gunakan #hashtag atau @mention..."
            required
          ></textarea>
          <div class="flex justify-between items-center" style="margin-top:6px;">
            <span class="form-error" id="quick-post-error"></span>
            <span class="char-counter" id="quick-post-counter">0/${MAX_POST_CHARS}</span>
          </div>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" id="quick-post-cancel">Batal</button>
      <button type="button" class="btn btn-primary" id="quick-post-submit">
        <i class="fa-solid fa-paper-plane"></i> Posting Sekarang
      </button>
    `;

    window.UI.openModal({
      title: "Buat Postingan Baru",
      bodyHtml,
      footerHtml,
      onMount: (modalEl) => {
        const textarea = modalEl.querySelector("#quick-post-textarea");
        const counter = modalEl.querySelector("#quick-post-counter");
        const errorEl = modalEl.querySelector("#quick-post-error");
        textarea.focus();

        textarea.addEventListener("input", () => {
          counter.textContent = `${textarea.value.length}/${MAX_POST_CHARS}`;
        });

        modalEl
          .querySelector("#quick-post-cancel")
          .addEventListener("click", () => {
            window.UI.closeModal();
          });

        modalEl
          .querySelector("#quick-post-submit")
          .addEventListener("click", async () => {
            const res = await this.createPost({
              content: textarea.value,
              imageDataUrls: [],
            });
            if (!res.ok) {
              errorEl.textContent = res.error;
              return;
            }
            window.UI.closeModal();
            window.UI.showToast("Postingan berhasil diterbitkan!", "success");
            if (typeof window.onPostCreatedGlobal === "function") {
              window.onPostCreatedGlobal();
            } else {
              window.location.href = "home.html";
            }
          });
      },
    });
  }

  /* ==========================================================================
     STORIES SYSTEM (24-Hour Expiration, Upload & Fullscreen Progress Viewer)
     ========================================================================== */

  /**
   * Purge expired stories (> 24 hours old) and return active stories
   * @returns {Array<Object>}
   */
  getActiveStories() {
    const now = Date.now();
    const allStories = window.Storage.get(window.STORAGE_KEYS.STORIES, []);
    const active = allStories.filter(
      (s) => now - Number(s.createdAt) < STORY_TTL_MS,
    );

    if (active.length !== allStories.length) {
      window.Storage.set(window.STORAGE_KEYS.STORIES, active);
    }

    return active.sort((a, b) => a.createdAt - b.createdAt);
  }

  /**
   * Group active stories by user
   * @returns {Array<{user: Object, stories: Array<Object>, allSeen: boolean}>}
   */
  getStoriesGroupedByUser() {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return [];

    const activeStories = this.getActiveStories();
    const groupedMap = new Map();

    activeStories.forEach((story) => {
      if (!groupedMap.has(story.userId)) {
        groupedMap.set(story.userId, []);
      }
      groupedMap.get(story.userId).push(story);
    });

    const groups = [];
    groupedMap.forEach((userStories, userId) => {
      const user = window.Users ? window.Users.getById(userId) : null;
      if (!user) return;
      const allSeen = userStories.every((s) =>
        (s.viewers || []).includes(currentUser.id),
      );
      groups.push({ user, stories: userStories, allSeen });
    });

    // Put current user's stories first if present, then unseen stories
    groups.sort((a, b) => {
      if (a.user.id === currentUser.id) return -1;
      if (b.user.id === currentUser.id) return 1;
      if (a.allSeen !== b.allSeen) return a.allSeen ? 1 : -1;
      return 0;
    });

    return groups;
  }

  /**
   * Render the horizontal Stories Bar at the top of the Home feed
   * @param {HTMLElement} container
   */
  renderStoriesBar(container) {
    if (!container) return;
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return;

    const groups = this.getStoriesGroupedByUser();
    const myGroup = groups.find((g) => g.user.id === currentUser.id);
    const myAvatar =
      window.Storage.resolveMedia(currentUser.avatar) ||
      window.UI.getFallbackAvatar(currentUser.name);

    let html = `
      <div class="story-item" id="add-story-trigger" role="button" tabindex="0" aria-label="Tambah Cerita (Story) Baru">
        <div class="story-ring add-story">
          <img
            src="${myAvatar}"
            alt="Tambah Story"
            onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(currentUser.name)}';"
          />
          <span class="story-add-badge"><i class="fa-solid fa-plus"></i></span>
        </div>
        <span class="story-username">Buat Story</span>
      </div>
    `;

    groups.forEach((group) => {
      const u = group.user;
      const av =
        window.Storage.resolveMedia(u.avatar) ||
        window.UI.getFallbackAvatar(u.name);
      const label = u.id === currentUser.id ? "Story Anda" : u.username;
      html += `
        <div
          class="story-item"
          data-story-user="${u.id}"
          role="button"
          tabindex="0"
          aria-label="Lihat story dari ${window.Storage.escapeHtml(u.name)}"
        >
          <div class="story-ring ${group.allSeen ? "seen" : ""}">
            <img
              src="${av}"
              alt="${window.Storage.escapeHtml(u.name)}"
              onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(u.name)}';"
            />
          </div>
          <span class="story-username">${window.Storage.escapeHtml(label)}</span>
        </div>
      `;
    });

    container.innerHTML = html;

    const addTrigger = container.querySelector("#add-story-trigger");
    if (addTrigger) {
      addTrigger.addEventListener("click", () => {
        this.openCreateStoryModal(() => this.renderStoriesBar(container));
      });
    }

    container.querySelectorAll("[data-story-user]").forEach((item) => {
      item.addEventListener("click", () => {
        const uid = item.getAttribute("data-story-user");
        this.openStoryViewer(uid, () => this.renderStoriesBar(container));
      });
    });
  }

  /**
   * Open modal to upload a new 24-hour photo story
   * @param {Function} onCreated
   */
  openCreateStoryModal(onCreated) {
    let storyImageDataUrl = null;

    const bodyHtml = `
      <form id="create-story-form">
        <div class="form-group">
          <label class="form-label">Pilih Foto Story (Tampil selama 24 jam)</label>
          <div
            id="story-upload-preview"
            style="height:260px; border:2px dashed var(--border-color-strong); border-radius:var(--radius-lg); display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; position:relative; background:var(--bg-surface-hover);"
          >
            <div id="story-upload-placeholder" style="text-align:center; padding:var(--space-4);">
              <i class="fa-solid fa-cloud-arrow-up text-primary-brand" style="font-size:2.2rem; margin-bottom:var(--space-2);"></i>
              <p class="text-sm font-semibold">Klik untuk memilih gambar Story</p>
              <span class="text-xs text-muted">Format JPG, PNG, atau WEBP</span>
            </div>
            <img id="story-preview-img" src="" alt="Pratinjau Story" class="hidden" style="width:100%; height:100%; object-fit:cover;" />
          </div>
          <input type="file" id="story-file-input" accept="image/*" class="hidden" />
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="story-caption-input">Keterangan Singkat (Opsional)</label>
          <input
            type="text"
            id="story-caption-input"
            class="form-control"
            placeholder="Tulis caption untuk story Anda..."
            maxlength="120"
          />
          <span class="form-error" id="story-error"></span>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" id="story-cancel-btn">Batal</button>
      <button type="button" class="btn btn-primary" id="story-publish-btn">
        <i class="fa-solid fa-bolt"></i> Bagikan ke Story
      </button>
    `;

    window.UI.openModal({
      title: "Buat Story Baru",
      bodyHtml,
      footerHtml,
      onMount: (modalEl) => {
        const previewBox = modalEl.querySelector("#story-upload-preview");
        const fileInput = modalEl.querySelector("#story-file-input");
        const previewImg = modalEl.querySelector("#story-preview-img");
        const placeholder = modalEl.querySelector("#story-upload-placeholder");
        const errorEl = modalEl.querySelector("#story-error");

        previewBox.addEventListener("click", () => fileInput.click());

        fileInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            storyImageDataUrl = await window.Storage.compressImage(
              file,
              900,
              0.85,
            );
            previewImg.src = storyImageDataUrl;
            previewImg.classList.remove("hidden");
            placeholder.classList.add("hidden");
            errorEl.textContent = "";
          } catch (err) {
            errorEl.textContent = err.message;
          }
        });

        modalEl
          .querySelector("#story-cancel-btn")
          .addEventListener("click", () => {
            window.UI.closeModal();
          });

        modalEl
          .querySelector("#story-publish-btn")
          .addEventListener("click", async () => {
            if (!storyImageDataUrl) {
              errorEl.textContent =
                "Silakan pilih foto terlebih dahulu untuk membuat Story.";
              return;
            }

            const currentUser = window.Auth.getCurrentUser();
            const caption = modalEl
              .querySelector("#story-caption-input")
              .value.trim();
            const mediaRef = await window.Storage.saveMedia(storyImageDataUrl);

            const stories = this.getActiveStories();
            stories.push({
              id: window.Storage.generateId("story"),
              userId: currentUser.id,
              image: mediaRef,
              caption,
              viewers: [currentUser.id],
              createdAt: Date.now(),
            });

            window.Storage.set(window.STORAGE_KEYS.STORIES, stories);
            window.UI.closeModal();
            window.UI.showToast(
              "Story berhasil diunggah dan aktif selama 24 jam!",
              "success",
            );
            if (typeof onCreated === "function") onCreated();
          });
      },
    });
  }

  /**
   * Open Fullscreen Story Viewer with automated progress bar
   * @param {string} startUserId
   * @param {Function} [onClosed]
   */
  openStoryViewer(startUserId, onClosed = null) {
    const groups = this.getStoriesGroupedByUser();
    if (groups.length === 0) return;

    let groupIndex = groups.findIndex((g) => g.user.id === startUserId);
    if (groupIndex === -1) groupIndex = 0;
    let storyIndex = 0;

    const currentUser = window.Auth.getCurrentUser();
    const existingViewer = document.getElementById("story-viewer-backdrop");
    if (existingViewer) existingViewer.remove();

    const backdrop = document.createElement("div");
    backdrop.id = "story-viewer-backdrop";
    backdrop.className = "story-viewer-backdrop";
    document.body.appendChild(backdrop);

    let progressPercent = 0;
    const STORY_DURATION_MS = 5000;
    const TICK_MS = 50;

    const closeViewer = () => {
      if (this.storyTimer) {
        clearInterval(this.storyTimer);
        this.storyTimer = null;
      }
      backdrop.remove();
      if (typeof onClosed === "function") onClosed();
    };

    const markSeen = (storyId) => {
      const all = window.Storage.get(window.STORAGE_KEYS.STORIES, []);
      const target = all.find((s) => s.id === storyId);
      if (target && currentUser) {
        target.viewers = target.viewers || [];
        if (!target.viewers.includes(currentUser.id)) {
          target.viewers.push(currentUser.id);
          window.Storage.set(window.STORAGE_KEYS.STORIES, all);
        }
      }
    };

    const nextSlide = () => {
      const currentGroup = groups[groupIndex];
      if (storyIndex < currentGroup.stories.length - 1) {
        storyIndex++;
        renderCurrentSlide();
      } else if (groupIndex < groups.length - 1) {
        groupIndex++;
        storyIndex = 0;
        renderCurrentSlide();
      } else {
        closeViewer();
      }
    };

    const prevSlide = () => {
      if (storyIndex > 0) {
        storyIndex--;
        renderCurrentSlide();
      } else if (groupIndex > 0) {
        groupIndex--;
        storyIndex = groups[groupIndex].stories.length - 1;
        renderCurrentSlide();
      } else {
        storyIndex = 0;
        renderCurrentSlide();
      }
    };

    const renderCurrentSlide = () => {
      if (this.storyTimer) clearInterval(this.storyTimer);
      progressPercent = 0;

      const group = groups[groupIndex];
      const story = group.stories[storyIndex];
      const u = group.user;
      markSeen(story.id);

      const av =
        window.Storage.resolveMedia(u.avatar) ||
        window.UI.getFallbackAvatar(u.name);
      const imgSrc = window.Storage.resolveMedia(story.image);
      const isMine = currentUser && u.id === currentUser.id;

      backdrop.innerHTML = `
        <div class="story-viewer-box">
          <div class="story-progress-bars">
            ${group.stories
              .map(
                (_, idx) => `
              <div class="story-progress-segment">
                <div
                  class="story-progress-fill"
                  id="story-prog-${idx}"
                  style="width: ${idx < storyIndex ? "100%" : "0%"}"
                ></div>
              </div>
            `,
              )
              .join("")}
          </div>

          <div class="story-viewer-header">
            <div class="flex items-center gap-2">
              <img
                src="${av}"
                alt="${window.Storage.escapeHtml(u.name)}"
                class="avatar avatar-sm"
                onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(u.name)}';"
              />
              <div>
                <div class="text-sm font-bold" style="color:#fff;">${window.Storage.escapeHtml(u.name)}</div>
                <div class="text-xs" style="color:rgba(255,255,255,0.78);">${window.UI.formatRelativeTime(story.createdAt)}</div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              ${
                isMine
                  ? `<button type="button" class="btn-icon" id="story-delete-btn" style="color:#fff;" title="Hapus Story">
                      <i class="fa-regular fa-trash-can"></i>
                    </button>`
                  : ""
              }
              <button type="button" class="btn-icon" id="story-close-btn" style="color:#fff;" aria-label="Tutup Story">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
          </div>

          <img src="${imgSrc}" alt="Story" class="story-viewer-media" />

          <button type="button" class="story-nav-btn story-nav-prev" id="story-prev-btn" aria-label="Story Sebelumnya">
            <i class="fa-solid fa-chevron-left"></i>
          </button>
          <button type="button" class="story-nav-btn story-nav-next" id="story-next-btn" aria-label="Story Berikutnya">
            <i class="fa-solid fa-chevron-right"></i>
          </button>

          <div class="story-viewer-caption">
            ${story.caption ? `<p style="color:#fff; margin-bottom:6px;">${window.Storage.escapeHtml(story.caption)}</p>` : ""}
            <span class="text-xs" style="color:rgba(255,255,255,0.7);">
              <i class="fa-regular fa-eye"></i> Dilihat oleh ${(story.viewers || []).length} orang
            </span>
          </div>
        </div>
      `;

      const activeProgEl = backdrop.querySelector(`#story-prog-${storyIndex}`);

      this.storyTimer = setInterval(() => {
        progressPercent += (TICK_MS / STORY_DURATION_MS) * 100;
        if (activeProgEl) {
          activeProgEl.style.width = `${Math.min(progressPercent, 100)}%`;
        }
        if (progressPercent >= 100) {
          nextSlide();
        }
      }, TICK_MS);

      backdrop
        .querySelector("#story-close-btn")
        .addEventListener("click", closeViewer);
      backdrop
        .querySelector("#story-prev-btn")
        .addEventListener("click", prevSlide);
      backdrop
        .querySelector("#story-next-btn")
        .addEventListener("click", nextSlide);

      const delBtn = backdrop.querySelector("#story-delete-btn");
      if (delBtn) {
        delBtn.addEventListener("click", () => {
          const remaining = window.Storage.get(
            window.STORAGE_KEYS.STORIES,
            [],
          ).filter((s) => s.id !== story.id);
          window.Storage.set(window.STORAGE_KEYS.STORIES, remaining);
          window.UI.showToast("Story telah dihapus.", "info");
          closeViewer();
        });
      }
    };

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeViewer();
    });

    renderCurrentSlide();
  }
}

window.Posts = new PostService();
