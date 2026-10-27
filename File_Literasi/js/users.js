/**
 * ==========================================================================
 * USERS.JS - User Profiles, Follow/Unfollow, Block/Mute & Edit Profile Modal
 * ==========================================================================
 */

class UserService {
  /**
   * Get all users from storage
   * @returns {Array<Object>}
   */
  getAll() {
    return window.Storage.get(window.STORAGE_KEYS.USERS, []);
  }

  /**
   * Find user by ID
   * @param {string} userId
   * @returns {Object|null}
   */
  getById(userId) {
    if (!userId) return null;
    const users = this.getAll();
    return users.find((u) => u.id === userId) || null;
  }

  /**
   * Find user by username (case-insensitive)
   * @param {string} username
   * @returns {Object|null}
   */
  getByUsername(username) {
    if (!username) return null;
    const clean = String(username).trim().toLowerCase().replace(/^@/, "");
    const users = this.getAll();
    return users.find((u) => u.username.toLowerCase() === clean) || null;
  }

  /**
   * Search users by name, username, or bio
   * @param {string} query
   * @returns {Array<Object>}
   */
  search(query) {
    const clean = String(query || "")
      .trim()
      .toLowerCase()
      .replace(/^@/, "");
    const users = this.getAll();
    if (!clean) return users;

    return users.filter(
      (u) =>
        u.name.toLowerCase().includes(clean) ||
        u.username.toLowerCase().includes(clean) ||
        (u.bio && u.bio.toLowerCase().includes(clean)) ||
        (u.location && u.location.toLowerCase().includes(clean)),
    );
  }

  /**
   * Get suggested users to follow ("Siapa yang diikuti")
   * @param {string} currentUserId
   * @param {number} limit
   * @returns {Array<Object>}
   */
  getSuggestedUsers(currentUserId, limit = 5) {
    const currentUser = this.getById(currentUserId);
    if (!currentUser) return [];

    const following = currentUser.following || [];
    const blocked = currentUser.blockedUsers || [];
    const muted = currentUser.mutedUsers || [];

    return this.getAll()
      .filter(
        (u) =>
          u.id !== currentUserId &&
          !following.includes(u.id) &&
          !blocked.includes(u.id) &&
          !muted.includes(u.id),
      )
      .sort((a, b) => (b.followers || []).length - (a.followers || []).length)
      .slice(0, limit);
  }

  /**
   * Toggle follow/unfollow between current user and target user
   * @param {string} targetUserId
   * @returns {{following: boolean, followerCount: number}|null}
   */
  toggleFollow(targetUserId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser || currentUser.id === targetUserId) return null;

    const users = this.getAll();
    const meIdx = users.findIndex((u) => u.id === currentUser.id);
    const targetIdx = users.findIndex((u) => u.id === targetUserId);

    if (meIdx === -1 || targetIdx === -1) return null;

    const me = users[meIdx];
    const target = users[targetIdx];

    me.following = me.following || [];
    target.followers = target.followers || [];

    const isAlreadyFollowing = me.following.includes(targetUserId);

    if (isAlreadyFollowing) {
      me.following = me.following.filter((id) => id !== targetUserId);
      target.followers = target.followers.filter((id) => id !== me.id);
      window.Storage.set(window.STORAGE_KEYS.USERS, users);
      if (window.UI) {
        window.UI.showToast(`Berhenti mengikuti @${target.username}`, "info");
      }
      return { following: false, followerCount: target.followers.length };
    } else {
      me.following.push(targetUserId);
      if (!target.followers.includes(me.id)) {
        target.followers.push(me.id);
      }
      window.Storage.set(window.STORAGE_KEYS.USERS, users);

      if (window.Notifications) {
        window.Notifications.create({
          userId: targetUserId,
          actorId: me.id,
          type: "follow",
          text: "mulai mengikuti Anda",
        });
      }

      if (window.UI) {
        window.UI.showToast(
          `Sekarang mengikuti @${target.username}`,
          "success",
        );
      }
      return { following: true, followerCount: target.followers.length };
    }
  }

  /**
   * Toggle block/unblock a user
   * Blocking automatically removes follow relationships both ways
   * @param {string} targetUserId
   * @returns {boolean} True if now blocked, false if unblocked
   */
  toggleBlock(targetUserId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser || currentUser.id === targetUserId) return false;

    const users = this.getAll();
    const meIdx = users.findIndex((u) => u.id === currentUser.id);
    const targetIdx = users.findIndex((u) => u.id === targetUserId);
    if (meIdx === -1 || targetIdx === -1) return false;

    const me = users[meIdx];
    const target = users[targetIdx];
    me.blockedUsers = me.blockedUsers || [];

    const isBlocked = me.blockedUsers.includes(targetUserId);
    if (isBlocked) {
      me.blockedUsers = me.blockedUsers.filter((id) => id !== targetUserId);
      window.Storage.set(window.STORAGE_KEYS.USERS, users);
      if (window.UI) {
        window.UI.showToast(`Blokir @${target.username} telah dibuka.`, "info");
      }
      return false;
    } else {
      me.blockedUsers.push(targetUserId);
      // Remove mutual follow
      me.following = (me.following || []).filter((id) => id !== targetUserId);
      me.followers = (me.followers || []).filter((id) => id !== targetUserId);
      target.following = (target.following || []).filter((id) => id !== me.id);
      target.followers = (target.followers || []).filter((id) => id !== me.id);

      window.Storage.set(window.STORAGE_KEYS.USERS, users);
      if (window.UI) {
        window.UI.showToast(`@${target.username} telah diblokir.`, "warning");
      }
      return true;
    }
  }

  /**
   * Toggle mute/unmute a user
   * @param {string} targetUserId
   * @returns {boolean} True if now muted, false if unmuted
   */
  toggleMute(targetUserId) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser || currentUser.id === targetUserId) return false;

    const users = this.getAll();
    const meIdx = users.findIndex((u) => u.id === currentUser.id);
    const targetIdx = users.findIndex((u) => u.id === targetUserId);
    if (meIdx === -1 || targetIdx === -1) return false;

    const me = users[meIdx];
    const target = users[targetIdx];
    me.mutedUsers = me.mutedUsers || [];

    const isMuted = me.mutedUsers.includes(targetUserId);
    if (isMuted) {
      me.mutedUsers = me.mutedUsers.filter((id) => id !== targetUserId);
      window.Storage.set(window.STORAGE_KEYS.USERS, users);
      if (window.UI) {
        window.UI.showToast(
          `@${target.username} tidak lagi dibisukan.`,
          "info",
        );
      }
      return false;
    } else {
      me.mutedUsers.push(targetUserId);
      window.Storage.set(window.STORAGE_KEYS.USERS, users);
      if (window.UI) {
        window.UI.showToast(
          `Postingan @${target.username} dibisukan dari beranda.`,
          "info",
        );
      }
      return true;
    }
  }

  /**
   * Update user profile fields
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<{ok: boolean, error?: string, user?: Object}>}
   */
  async updateProfile(userId, updates) {
    const users = this.getAll();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) return { ok: false, error: "Pengguna tidak ditemukan." };

    const user = users[idx];

    if (updates.username !== undefined) {
      const cleanUname = String(updates.username)
        .trim()
        .toLowerCase()
        .replace(/^@/, "");
      if (!/^[a-z0-9_]{3,20}$/.test(cleanUname)) {
        return {
          ok: false,
          error:
            "Username harus 3-20 karakter (huruf kecil, angka, atau garis bawah).",
        };
      }
      const duplicate = users.some(
        (u) => u.id !== userId && u.username.toLowerCase() === cleanUname,
      );
      if (duplicate) {
        return { ok: false, error: "Username sudah dipakai pengguna lain." };
      }
      user.username = cleanUname;
    }

    if (updates.name !== undefined) {
      const cleanName = String(updates.name).trim();
      if (cleanName.length < 2) {
        return { ok: false, error: "Nama tampilan minimal 2 karakter." };
      }
      user.name = cleanName;
    }

    if (updates.bio !== undefined) {
      user.bio = String(updates.bio).trim().substring(0, 180);
    }

    if (updates.location !== undefined) {
      user.location = String(updates.location).trim().substring(0, 60);
    }

    if (updates.website !== undefined) {
      let site = String(updates.website).trim();
      if (site && !/^https?:\/\//i.test(site)) {
        site = `https://${site}`;
      }
      user.website = site;
    }

    if (updates.isPrivate !== undefined) {
      user.isPrivate = Boolean(updates.isPrivate);
    }

    if (updates.avatarDataUrl) {
      user.avatar = await window.Storage.saveMedia(updates.avatarDataUrl);
    }

    if (updates.bannerDataUrl) {
      user.banner = await window.Storage.saveMedia(updates.bannerDataUrl);
    }

    users[idx] = user;
    window.Storage.set(window.STORAGE_KEYS.USERS, users);
    return { ok: true, user };
  }

  /**
   * Open Edit Profile Modal with Avatar & Banner image upload preview
   * @param {Function} onSavedCallback
   */
  openEditProfileModal(onSavedCallback) {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return;

    let pendingAvatarDataUrl = null;
    let pendingBannerDataUrl = null;

    const currentAvatar =
      window.Storage.resolveMedia(currentUser.avatar) ||
      window.UI.getFallbackAvatar(currentUser.name);
    const currentBanner = window.Storage.resolveMedia(currentUser.banner) || "";

    const bodyHtml = `
      <form id="edit-profile-form" novalidate>
        <div class="form-group">
          <label class="form-label">Foto Sampul (Banner)</label>
          <div
            id="edit-banner-preview"
            style="height:125px; border-radius:var(--radius-md); background:var(--gradient-brand); position:relative; overflow:hidden; display:flex; align-items:center; justify-content:center; border:1px solid var(--border-color);"
          >
            ${
              currentBanner
                ? `<img src="${currentBanner}" id="edit-banner-img" alt="Banner" style="width:100%; height:100%; object-fit:cover;" />`
                : `<img src="" id="edit-banner-img" alt="Banner" class="hidden" style="width:100%; height:100%; object-fit:cover;" />`
            }
            <label
              for="edit-banner-input"
              class="btn btn-secondary btn-sm"
              style="position:absolute; bottom:8px; right:8px; cursor:pointer; background:rgba(15,23,42,0.75); color:#fff; border:none;"
            >
              <i class="fa-solid fa-camera"></i> Ubah Banner
            </label>
            <input type="file" id="edit-banner-input" accept="image/*" class="hidden" />
          </div>
        </div>

        <div class="form-group" style="display:flex; align-items:center; gap:var(--space-4);">
          <img
            src="${currentAvatar}"
            id="edit-avatar-img"
            alt="Avatar"
            class="avatar avatar-lg"
            onerror="this.onerror=null;this.src='${window.UI.getFallbackAvatar(currentUser.name)}';"
          />
          <div>
            <label for="edit-avatar-input" class="btn btn-outline btn-sm" style="cursor:pointer;">
              <i class="fa-solid fa-upload"></i> Unggah Foto Profil
            </label>
            <input type="file" id="edit-avatar-input" accept="image/*" class="hidden" />
            <span class="form-hint">JPG, PNG, atau WEBP. Otomatis disesuaikan.</span>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-name">Nama Lengkap</label>
          <input
            type="text"
            id="edit-name"
            class="form-control"
            value="${window.Storage.escapeHtml(currentUser.name)}"
            maxlength="50"
            required
          />
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-bio">Bio Singkat</label>
          <textarea
            id="edit-bio"
            class="form-control"
            rows="3"
            maxlength="180"
            placeholder="Ceritakan sedikit tentang diri Anda..."
          >${window.Storage.escapeHtml(currentUser.bio || "")}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label" for="edit-location">Lokasi</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-location-dot input-icon-left"></i>
            <input
              type="text"
              id="edit-location"
              class="form-control has-icon-left"
              value="${window.Storage.escapeHtml(currentUser.location || "")}"
              placeholder="Contoh: Jakarta, Indonesia"
              maxlength="60"
            />
          </div>
        </div>

        <div class="form-group" style="margin-bottom:0;">
          <label class="form-label" for="edit-website">Tautan / Website</label>
          <div class="input-wrapper">
            <i class="fa-solid fa-link input-icon-left"></i>
            <input
              type="url"
              id="edit-website"
              class="form-control has-icon-left"
              value="${window.Storage.escapeHtml(currentUser.website || "")}"
              placeholder="https://domainanda.com"
            />
          </div>
          <span class="form-error" id="edit-profile-error"></span>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" id="edit-profile-cancel">Batal</button>
      <button type="button" class="btn btn-primary" id="edit-profile-save">
        <i class="fa-solid fa-check"></i> Simpan Perubahan
      </button>
    `;

    window.UI.openModal({
      title: "Edit Profil",
      bodyHtml,
      footerHtml,
      onMount: (modalEl) => {
        const avatarInput = modalEl.querySelector("#edit-avatar-input");
        const avatarImg = modalEl.querySelector("#edit-avatar-img");
        const bannerInput = modalEl.querySelector("#edit-banner-input");
        const bannerImg = modalEl.querySelector("#edit-banner-img");
        const errorEl = modalEl.querySelector("#edit-profile-error");

        avatarInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            pendingAvatarDataUrl = await window.Storage.compressImage(
              file,
              400,
              0.85,
            );
            avatarImg.src = pendingAvatarDataUrl;
          } catch (err) {
            errorEl.textContent = err.message;
          }
        });

        bannerInput.addEventListener("change", async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            pendingBannerDataUrl = await window.Storage.compressImage(
              file,
              1100,
              0.85,
            );
            bannerImg.src = pendingBannerDataUrl;
            bannerImg.classList.remove("hidden");
          } catch (err) {
            errorEl.textContent = err.message;
          }
        });

        modalEl
          .querySelector("#edit-profile-cancel")
          .addEventListener("click", () => {
            window.UI.closeModal();
          });

        modalEl
          .querySelector("#edit-profile-save")
          .addEventListener("click", async () => {
            const name = modalEl.querySelector("#edit-name").value;
            const bio = modalEl.querySelector("#edit-bio").value;
            const location = modalEl.querySelector("#edit-location").value;
            const website = modalEl.querySelector("#edit-website").value;

            const res = await this.updateProfile(currentUser.id, {
              name,
              bio,
              location,
              website,
              avatarDataUrl: pendingAvatarDataUrl,
              bannerDataUrl: pendingBannerDataUrl,
            });

            if (!res.ok) {
              errorEl.textContent = res.error;
              return;
            }

            window.UI.closeModal();
            window.UI.showToast("Profil berhasil diperbarui!", "success");
            window.UI.renderNavigation("profile");
            if (typeof onSavedCallback === "function") {
              onSavedCallback(res.user);
            }
          });
      },
    });
  }

  /**
   * Open modal displaying Followers or Following list for a user
   * @param {string} userId
   * @param {'followers'|'following'} listType
   * @param {Function} [onChanged]
   */
  openFollowListModal(userId, listType = "followers", onChanged = null) {
    const targetUser = this.getById(userId);
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!targetUser || !currentUser) return;

    const ids =
      listType === "followers"
        ? targetUser.followers || []
        : targetUser.following || [];
    const userObjects = ids.map((id) => this.getById(id)).filter(Boolean);

    const title =
      listType === "followers"
        ? `Pengikut @${targetUser.username} (${userObjects.length})`
        : `Diikuti oleh @${targetUser.username} (${userObjects.length})`;

    const bodyHtml =
      userObjects.length === 0
        ? `<div class="empty-state" style="padding:var(--space-6);">
            <p class="text-muted">Belum ada daftar pengguna untuk ditampilkan.</p>
          </div>`
        : `<div class="suggestion-list" id="modal-follow-list">
            ${userObjects
              .map((u) => {
                const av =
                  window.Storage.resolveMedia(u.avatar) ||
                  window.UI.getFallbackAvatar(u.name);
                const isMe = u.id === currentUser.id;
                const amIFollowing = (currentUser.following || []).includes(
                  u.id,
                );
                return `
                  <div class="suggestion-item" style="padding:var(--space-2) 0; border-bottom:1px solid var(--border-color);">
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
                            class="btn btn-sm btn-follow ${amIFollowing ? "is-following" : "btn-primary"}"
                            data-modal-follow="${u.id}"
                          >
                            ${amIFollowing ? "Mengikuti" : "Ikuti"}
                          </button>`
                        : '<span class="text-xs text-muted">Anda</span>'
                    }
                  </div>
                `;
              })
              .join("")}
          </div>`;

    window.UI.openModal({
      title,
      bodyHtml,
      onMount: (modalEl) => {
        modalEl.querySelectorAll("[data-modal-follow]").forEach((btn) => {
          btn.addEventListener("click", () => {
            const uid = btn.getAttribute("data-modal-follow");
            const result = this.toggleFollow(uid);
            if (result) {
              btn.className = `btn btn-sm btn-follow ${
                result.following ? "is-following" : "btn-primary"
              }`;
              btn.textContent = result.following ? "Mengikuti" : "Ikuti";
              if (typeof onChanged === "function") onChanged();
            }
          });
        });
      },
    });
  }
}

window.Users = new UserService();
