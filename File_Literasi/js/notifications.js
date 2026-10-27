/**
 * ==========================================================================
 * NOTIFICATIONS.JS - Activity Notifications & Live Toast Pop-up Simulation
 * ==========================================================================
 */

class NotificationService {
  /**
   * Get all notifications for a specific user
   * @param {string} userId
   * @param {'all'|'mention'|'unread'} filter
   * @returns {Array}
   */
  getForUser(userId, filter = "all") {
    if (!userId) return [];
    const all = window.Storage.get(window.STORAGE_KEYS.NOTIFICATIONS, []);
    const currentUser = window.Users ? window.Users.getById(userId) : null;
    const blocked = currentUser ? currentUser.blockedUsers || [] : [];

    return all
      .filter((n) => {
        if (n.userId !== userId) return false;
        if (blocked.includes(n.actorId)) return false;
        if (filter === "mention") return n.type === "mention";
        if (filter === "unread") return !n.read;
        return true;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Count unread notifications for a user
   * @param {string} userId
   * @returns {number}
   */
  getUnreadCount(userId) {
    return this.getForUser(userId, "unread").length;
  }

  /**
   * Create a new notification entry
   * @param {Object} params
   * @param {string} params.userId - Recipient user ID
   * @param {string} params.actorId - User ID who triggered the event
   * @param {'like'|'comment'|'follow'|'mention'|'repost'} params.type
   * @param {string|null} [params.postId]
   * @param {string} params.text
   * @param {boolean} [params.showLiveToast]
   */
  create({
    userId,
    actorId,
    type,
    postId = null,
    text,
    showLiveToast = false,
  }) {
    if (!userId || !actorId || userId === actorId) return null;

    const notifications = window.Storage.get(
      window.STORAGE_KEYS.NOTIFICATIONS,
      [],
    );

    // Avoid duplicate identical like/follow notifications within a short time
    if (type === "like" || type === "follow") {
      const existing = notifications.find(
        (n) =>
          n.userId === userId &&
          n.actorId === actorId &&
          n.type === type &&
          n.postId === postId,
      );
      if (existing) {
        existing.createdAt = Date.now();
        existing.read = false;
        window.Storage.set(window.STORAGE_KEYS.NOTIFICATIONS, notifications);
        if (window.UI) window.UI.updateNavBadges();
        return existing;
      }
    }

    const newNotif = {
      id: window.Storage.generateId("notif"),
      userId,
      actorId,
      type,
      postId,
      text,
      read: false,
      createdAt: Date.now(),
    };

    notifications.unshift(newNotif);
    window.Storage.set(window.STORAGE_KEYS.NOTIFICATIONS, notifications);

    if (window.UI) {
      window.UI.updateNavBadges();
      if (showLiveToast) {
        const actor = window.Users ? window.Users.getById(actorId) : null;
        const actorName = actor ? actor.name : "Seseorang";
        window.UI.showToast(`${actorName} ${text}`, "info");
      }
    }

    return newNotif;
  }

  /**
   * Parse @username mentions in post/comment text and notify mentioned users
   * @param {string} text
   * @param {string} actorId
   * @param {string} postId
   */
  notifyMentions(text, actorId, postId) {
    if (!text) return;
    const regex = /(?:^|\s)@([a-zA-Z0-9_]+)/g;
    const mentionedUsernames = new Set();
    let match;

    while ((match = regex.exec(text)) !== null) {
      mentionedUsernames.add(match[1].toLowerCase());
    }

    if (mentionedUsernames.size === 0) return;

    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []);
    mentionedUsernames.forEach((uname) => {
      const targetUser = users.find((u) => u.username.toLowerCase() === uname);
      if (targetUser && targetUser.id !== actorId) {
        this.create({
          userId: targetUser.id,
          actorId,
          type: "mention",
          postId,
          text: `menyebut Anda: "${text.substring(0, 60)}${text.length > 60 ? "..." : ""}"`,
        });
      }
    });
  }

  /**
   * Mark a single notification as read
   * @param {string} notifId
   */
  markAsRead(notifId) {
    const notifications = window.Storage.get(
      window.STORAGE_KEYS.NOTIFICATIONS,
      [],
    );
    const target = notifications.find((n) => n.id === notifId);
    if (target && !target.read) {
      target.read = true;
      window.Storage.set(window.STORAGE_KEYS.NOTIFICATIONS, notifications);
      if (window.UI) window.UI.updateNavBadges();
    }
  }

  /**
   * Mark all notifications for a user as read
   * @param {string} userId
   */
  markAllAsRead(userId) {
    const notifications = window.Storage.get(
      window.STORAGE_KEYS.NOTIFICATIONS,
      [],
    );
    let changed = false;
    notifications.forEach((n) => {
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      window.Storage.set(window.STORAGE_KEYS.NOTIFICATIONS, notifications);
      if (window.UI) window.UI.updateNavBadges();
    }
  }

  /**
   * Delete a notification by ID
   * @param {string} notifId
   */
  delete(notifId) {
    const notifications = window.Storage.get(
      window.STORAGE_KEYS.NOTIFICATIONS,
      [],
    ).filter((n) => n.id !== notifId);
    window.Storage.set(window.STORAGE_KEYS.NOTIFICATIONS, notifications);
    if (window.UI) window.UI.updateNavBadges();
  }

  /**
   * Simulate incoming real-time notification from a random dummy user
   * Demonstrates live Toast pop-up & badge counter increment
   */
  simulateIncomingActivity() {
    const currentUser = window.Auth ? window.Auth.getCurrentUser() : null;
    if (!currentUser) return null;

    const users = window.Storage.get(window.STORAGE_KEYS.USERS, []).filter(
      (u) => u.id !== currentUser.id,
    );
    if (users.length === 0) return null;

    const randomActor = users[Math.floor(Math.random() * users.length)];
    const userPosts = window.Storage.get(window.STORAGE_KEYS.POSTS, []).filter(
      (p) => p.userId === currentUser.id,
    );
    const targetPost = userPosts.length > 0 ? userPosts[0] : null;

    const scenarios = [
      {
        type: "like",
        postId: targetPost ? targetPost.id : null,
        text: "menyukai postingan terbaru Anda ❤️",
      },
      {
        type: "comment",
        postId: targetPost ? targetPost.id : null,
        text: 'mengomentari postingan Anda: "Setuju banget, insight yang sangat bermanfaat! 🔥"',
      },
      {
        type: "mention",
        postId: targetPost ? targetPost.id : null,
        text: `menyebut @${currentUser.username} dalam diskusi komunitas #LiterasiData`,
      },
      {
        type: "follow",
        postId: null,
        text: "mulai mengikuti profil Anda 👋",
      },
    ];

    const chosen = scenarios[Math.floor(Math.random() * scenarios.length)];

    // If like scenario and targetPost exists, also add actor to post likes
    if (chosen.type === "like" && targetPost) {
      const allPosts = window.Storage.get(window.STORAGE_KEYS.POSTS, []);
      const pIdx = allPosts.findIndex((p) => p.id === targetPost.id);
      if (pIdx !== -1 && !allPosts[pIdx].likes.includes(randomActor.id)) {
        allPosts[pIdx].likes.push(randomActor.id);
        window.Storage.set(window.STORAGE_KEYS.POSTS, allPosts);
      }
    }

    return this.create({
      userId: currentUser.id,
      actorId: randomActor.id,
      type: chosen.type,
      postId: chosen.postId,
      text: chosen.text,
      showLiveToast: true,
    });
  }
}

window.Notifications = new NotificationService();
