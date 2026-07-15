import { getCachedSession } from "../auth/auth";
import { aestheticById } from "../data/aesthetics";
import { rankForAura } from "../data/ranks";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  formatFriendshipDuration,
  getFriendshipStatus,
  listFriends,
  listIncomingRequests,
  listOutgoingRequests,
  removeFriend,
  sendFriendRequest,
  type FriendRequestRow,
  type FriendRow,
  type FriendshipStatusInfo,
} from "../friends/api";
import { renderFriendPanel } from "./friendPanel";
import {
  fetchPublicProfile,
  loadOwnBio,
  removeAvatar,
  searchProfiles,
  updateBio,
  uploadAvatar,
  type ProfileSearchHit,
  type PublicProfile,
} from "../profile/api";
import type { AestheticCore, PlayerState } from "../types";
import { escapeHtml, formatNumber } from "../utils/format";
import { showToast } from "./toast";

type ProfileTab = "me" | "friends" | "lookup";

function avatarHtml(url: string | null | undefined, name: string, sizeClass = ""): string {
  const initial = (name || "?").slice(0, 1).toUpperCase();
  if (url) {
    return `<img class="avatar ${sizeClass}" src="${escapeHtml(url)}" alt="" />`;
  }
  return `<div class="avatar avatar-fallback ${sizeClass}" aria-hidden="true">${escapeHtml(initial)}</div>`;
}

export function renderProfile(
  container: HTMLElement,
  state: PlayerState,
  onState: (s: PlayerState) => void,
): void {
  let tab: ProfileTab = "me";
  let ownBio = "";
  let ownAvatar = state.avatarUrl ?? null;
  let busy = false;
  let error = "";
  let success = "";
  let searchQ = "";
  let searchResults: ProfileSearchHit[] = [];
  let viewed: PublicProfile | null = null;
  let viewedFriend: FriendshipStatusInfo = { status: "none" };
  let searching = false;
  let friends: FriendRow[] = [];
  let incoming: FriendRequestRow[] = [];
  let outgoing: FriendRequestRow[] = [];
  let friendsLoading = false;
  let selectedFriend: FriendRow | null = null;

  const session = getCachedSession();

  const boot = async () => {
    ownBio = await loadOwnBio();
    if (!ownAvatar && session) {
      const p = await fetchPublicProfile(session.username);
      if (p?.avatarUrl) {
        ownAvatar = p.avatarUrl;
        onState({ ...state, avatarUrl: p.avatarUrl });
      }
    }
    paint();
  };

  const loadFriendsData = async () => {
    friendsLoading = true;
    paint();
    [friends, incoming, outgoing] = await Promise.all([
      listFriends(),
      listIncomingRequests(),
      listOutgoingRequests(),
    ]);
    friendsLoading = false;
    paint();
  };

  const paint = () => {
    container.innerHTML = `
      <div class="segmented">
        <button type="button" data-tab="me" class="${tab === "me" ? "active" : ""}">My Profile</button>
        <button type="button" data-tab="friends" class="${tab === "friends" ? "active" : ""}">Friends${incoming.length ? ` (${incoming.length})` : ""}</button>
        <button type="button" data-tab="lookup" class="${tab === "lookup" ? "active" : ""}">Lookup</button>
      </div>
      <div id="profile-body"></div>
    `;

    container.querySelectorAll<HTMLButtonElement>("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        tab = btn.dataset.tab as ProfileTab;
        error = "";
        success = "";
        paint();
        if (tab === "friends") void loadFriendsData();
      });
    });

    const body = container.querySelector("#profile-body")!;
    if (tab === "me") renderMe(body);
    else if (tab === "friends") renderFriends(body);
    else renderLookup(body);
  };

  const banner = () => {
    if (error) return `<p class="danger-text" style="margin:0 0 12px">${escapeHtml(error)}</p>`;
    if (success) return `<p class="success-text" style="margin:0 0 12px">${escapeHtml(success)}</p>`;
    return "";
  };

  const renderMe = (body: Element) => {
    const rank = rankForAura(state.totalAura);
    const aesthetic = aestheticById(state.core as AestheticCore);
    const name = state.displayName || session?.username || "You";

    body.innerHTML = `
      ${banner()}
      <div class="card profile-hero">
        <div class="profile-hero-row">
          <div class="avatar-wrap">
            ${avatarHtml(ownAvatar, name, "avatar-lg")}
            <label class="avatar-edit ${busy ? "disabled" : ""}">
              <input type="file" id="avatar-input" accept="image/jpeg,image/png,image/webp" hidden ${busy ? "disabled" : ""} />
              Change
            </label>
          </div>
          <div class="profile-hero-meta">
            <h2 style="margin:0">${escapeHtml(name)}</h2>
            <p class="muted" style="margin:4px 0 0">@${escapeHtml(session?.username ?? "—")}</p>
            <div class="tag-row">
              <span class="tag">${rank.emoji} ${escapeHtml(rank.name)}</span>
              <span class="tag magenta">${aesthetic.emoji} ${escapeHtml(aesthetic.label)}</span>
            </div>
          </div>
        </div>
        <div class="stat-grid" style="margin-top:16px">
          <div class="stat"><b>${formatNumber(state.totalAura)}</b><span>Aura</span></div>
          <div class="stat"><b>🔥 ${state.streak}</b><span>Streak</span></div>
          <div class="stat"><b>${state.duelWins}</b><span>Duels</span></div>
        </div>
        ${
          ownAvatar
            ? `<button type="button" class="btn btn-plain" id="remove-avatar" style="margin-top:8px" ${busy ? "disabled" : ""}>Remove photo</button>`
            : ""
        }
      </div>

      <div class="section-header">About</div>
      <div class="card stack">
        <div class="field">
          <label for="bio">Bio</label>
          <textarea id="bio" maxlength="160" placeholder="A short vibe line…">${escapeHtml(ownBio)}</textarea>
          <p class="field-hint muted">Max 160 characters. Visible on your public profile.</p>
        </div>
        <button class="btn btn-fill" id="save-bio" ${busy ? "disabled" : ""}>Save Bio</button>
      </div>

      <div class="section-header">Friends</div>
      <div class="card">
        <p class="muted" style="margin:0 0 12px">Find people in Lookup and send friend requests. Manage friends in the Friends tab.</p>
        <button type="button" class="btn btn-secondary" id="go-friends-tab">Open Friends</button>
      </div>
    `;

    body.querySelector("#go-friends-tab")?.addEventListener("click", () => {
      tab = "friends";
      void loadFriendsData();
    });

    const fileInput = body.querySelector("#avatar-input") as HTMLInputElement | null;
    fileInput?.addEventListener("change", async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      busy = true;
      error = "";
      success = "";
      paint();
      const res = await uploadAvatar(file);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      ownAvatar = res.url;
      onState({ ...state, avatarUrl: res.url });
      success = "Profile photo updated.";
      showToast("Photo updated");
      paint();
    });

    body.querySelector("#remove-avatar")?.addEventListener("click", async () => {
      if (busy) return;
      busy = true;
      paint();
      const res = await removeAvatar();
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      ownAvatar = null;
      onState({ ...state, avatarUrl: null });
      success = "Photo removed.";
      showToast("Photo removed");
      paint();
    });

    body.querySelector("#save-bio")?.addEventListener("click", async () => {
      if (busy) return;
      const bio = (body.querySelector("#bio") as HTMLTextAreaElement).value;
      busy = true;
      error = "";
      success = "";
      paint();
      const res = await updateBio(bio);
      busy = false;
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      ownBio = bio.trim().slice(0, 160);
      success = "Bio saved.";
      showToast("Bio saved");
      paint();
    });
  };

  const renderFriends = (body: Element) => {
    if (selectedFriend) {
      void renderFriendPanel(body as HTMLElement, selectedFriend, state, () => {
        selectedFriend = null;
        paint();
      });
      return;
    }

    if (friendsLoading) {
      body.innerHTML = `<p class="muted" style="padding:8px 4px">Loading friends…</p>`;
      return;
    }

    body.innerHTML = `
      ${banner()}

      <div class="section-header">Requests${incoming.length ? ` · ${incoming.length}` : ""}</div>
      ${
        incoming.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">No pending requests.</p></div>`
          : `<div class="inset-group">${incoming
              .map(
                (r) => `
            <div class="list-row friend-row">
              ${avatarHtml(r.avatarUrl, r.displayName)}
              <div class="meta">
                <strong>${escapeHtml(r.displayName)}</strong>
                <span>@${escapeHtml(r.username)} · ${formatNumber(r.totalAura)} aura</span>
              </div>
              <div class="friend-actions">
                <button type="button" class="btn btn-fill btn-sm" data-accept="${escapeHtml(r.id)}">Accept</button>
                <button type="button" class="btn btn-secondary btn-sm" data-decline="${escapeHtml(r.id)}">Decline</button>
              </div>
            </div>`,
              )
              .join("")}</div>`
      }

      <div class="section-header">Outgoing</div>
      ${
        outgoing.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">No outgoing requests.</p></div>`
          : `<div class="inset-group">${outgoing
              .map(
                (r) => `
            <div class="list-row friend-row">
              ${avatarHtml(r.avatarUrl, r.displayName)}
              <div class="meta">
                <strong>${escapeHtml(r.displayName)}</strong>
                <span>@${escapeHtml(r.username)} · pending</span>
              </div>
              <div class="friend-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-cancel="${escapeHtml(r.id)}">Cancel</button>
              </div>
            </div>`,
              )
              .join("")}</div>`
      }

      <div class="section-header">Friends · ${friends.length}</div>
      ${
        friends.length === 0
          ? `<div class="card"><p class="muted" style="margin:0">No friends yet. Use Lookup to find people and send requests.</p>
             <button type="button" class="btn btn-fill" id="go-lookup" style="margin-top:12px">Find people</button></div>`
          : `<div class="inset-group">${friends
              .map(
                (f) => `
            <div class="list-row friend-row">
              <button type="button" class="profile-hit-inline" data-friend="${escapeHtml(f.userId)}">
                ${avatarHtml(f.avatarUrl, f.displayName)}
                <div class="meta">
                  <strong>${escapeHtml(f.displayName)}</strong>
                  <span>@${escapeHtml(f.username)} · ${escapeHtml(formatFriendshipDuration(f.friendsSince))}</span>
                </div>
              </button>
              <div class="friend-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-unfriend="${escapeHtml(f.userId)}">Remove</button>
              </div>
            </div>`,
              )
              .join("")}</div>`
      }
    `;

    body.querySelector("#go-lookup")?.addEventListener("click", () => {
      tab = "lookup";
      paint();
    });

    body.querySelectorAll<HTMLButtonElement>("[data-accept]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await acceptFriendRequest(btn.dataset.accept!);
        if (!res.ok) {
          error = res.error;
          paint();
          return;
        }
        showToast(res.message ?? "Accepted");
        void loadFriendsData();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-decline]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await declineFriendRequest(btn.dataset.decline!);
        if (!res.ok) {
          error = res.error;
          paint();
          return;
        }
        showToast(res.message ?? "Declined");
        void loadFriendsData();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-cancel]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const res = await cancelFriendRequest(btn.dataset.cancel!);
        if (!res.ok) {
          error = res.error;
          paint();
          return;
        }
        showToast(res.message ?? "Cancelled");
        void loadFriendsData();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-unfriend]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Remove this friend?")) return;
        const res = await removeFriend(btn.dataset.unfriend!);
        if (!res.ok) {
          error = res.error;
          paint();
          return;
        }
        showToast(res.message ?? "Removed");
        void loadFriendsData();
      });
    });

    body.querySelectorAll<HTMLButtonElement>("[data-friend]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.friend!;
        selectedFriend = friends.find((f) => f.userId === id) ?? null;
        paint();
      });
    });
  };

  const friendActionsHtml = (st: FriendshipStatusInfo): string => {
    switch (st.status) {
      case "self":
        return `<span class="tag magenta">You</span>`;
      case "friends":
        return `<button type="button" class="btn btn-secondary btn-sm" id="friend-remove">Remove friend</button>`;
      case "outgoing":
        return `<button type="button" class="btn btn-secondary btn-sm" id="friend-cancel">Cancel request</button>`;
      case "incoming":
        return `<div class="friend-actions">
          <button type="button" class="btn btn-fill btn-sm" id="friend-accept">Accept</button>
          <button type="button" class="btn btn-secondary btn-sm" id="friend-decline">Decline</button>
        </div>`;
      default:
        return `<button type="button" class="btn btn-fill btn-sm" id="friend-add">Add friend</button>`;
    }
  };

  const bindFriendActions = (username: string) => {
    container.querySelector("#friend-add")?.addEventListener("click", async () => {
      const res = await sendFriendRequest(username);
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      showToast(res.message ?? "Sent");
      viewedFriend = await getFriendshipStatus(username);
      paint();
    });
    container.querySelector("#friend-cancel")?.addEventListener("click", async () => {
      if (!viewedFriend.id) return;
      const res = await cancelFriendRequest(viewedFriend.id);
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      showToast(res.message ?? "Cancelled");
      viewedFriend = await getFriendshipStatus(username);
      paint();
    });
    container.querySelector("#friend-accept")?.addEventListener("click", async () => {
      if (!viewedFriend.id) return;
      const res = await acceptFriendRequest(viewedFriend.id);
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      showToast(res.message ?? "Accepted");
      viewedFriend = await getFriendshipStatus(username);
      paint();
    });
    container.querySelector("#friend-decline")?.addEventListener("click", async () => {
      if (!viewedFriend.id) return;
      const res = await declineFriendRequest(viewedFriend.id);
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      showToast(res.message ?? "Declined");
      viewedFriend = await getFriendshipStatus(username);
      paint();
    });
    container.querySelector("#friend-remove")?.addEventListener("click", async () => {
      if (!viewedFriend.userId && !viewed?.userId) return;
      if (!confirm("Remove this friend?")) return;
      const res = await removeFriend(viewedFriend.userId || viewed!.userId);
      if (!res.ok) {
        error = res.error;
        paint();
        return;
      }
      showToast(res.message ?? "Removed");
      viewedFriend = await getFriendshipStatus(username);
      paint();
    });
  };

  const renderLookup = (body: Element) => {
    body.innerHTML = `
      ${banner()}
      <div class="section-header">Find people</div>
      <div class="card stack">
        <div class="field">
          <label for="lookup-q">Username or display name</label>
          <input id="lookup-q" maxlength="40" placeholder="Search @username" value="${escapeHtml(searchQ)}" />
        </div>
        <button class="btn btn-fill" id="lookup-go" ${searching ? "disabled" : ""}>${searching ? "Searching…" : "Search"}</button>
      </div>

      <div id="lookup-results" style="margin-top:16px"></div>
      <div id="lookup-view" style="margin-top:16px"></div>
    `;

    const resultsEl = body.querySelector("#lookup-results")!;
    const viewEl = body.querySelector("#lookup-view")!;

    const paintResults = () => {
      if (searchResults.length === 0 && searchQ.trim() && !searching) {
        resultsEl.innerHTML = `<p class="muted" style="padding:0 4px">No profiles found.</p>`;
        return;
      }
      if (searchResults.length === 0) {
        resultsEl.innerHTML = "";
        return;
      }
      resultsEl.innerHTML = `
        <div class="section-header">Results</div>
        <div class="inset-group">
          ${searchResults
            .map(
              (h) => `
            <button type="button" class="list-row profile-hit" data-user="${escapeHtml(h.username)}">
              ${avatarHtml(h.avatarUrl, h.displayName)}
              <div class="meta">
                <strong>${escapeHtml(h.displayName)}</strong>
                <span>@${escapeHtml(h.username)} · ${formatNumber(h.totalAura)} aura</span>
              </div>
            </button>
          `,
            )
            .join("")}
        </div>
      `;
      resultsEl.querySelectorAll<HTMLButtonElement>("[data-user]").forEach((btn) => {
        btn.addEventListener("click", async () => {
          const u = btn.dataset.user!;
          viewed = await fetchPublicProfile(u);
          viewedFriend = await getFriendshipStatus(u);
          if (!viewed) {
            error = "Could not load profile.";
            paint();
            return;
          }
          paintView();
        });
      });
    };

    const paintView = () => {
      if (!viewed) {
        viewEl.innerHTML = "";
        return;
      }
      const aesthetic = aestheticById((viewed.core as AestheticCore) || "main-character");
      const rank = rankForAura(viewed.totalAura);
      viewEl.innerHTML = `
        <div class="section-header">Profile</div>
        <div class="card profile-hero">
          <div class="profile-hero-row">
            ${avatarHtml(viewed.avatarUrl, viewed.displayName, "avatar-lg")}
            <div class="profile-hero-meta">
              <h2 style="margin:0">${escapeHtml(viewed.displayName)}</h2>
              <p class="muted" style="margin:4px 0 0">@${escapeHtml(viewed.username)}</p>
              <div class="tag-row">
                <span class="tag">${rank.emoji} ${escapeHtml(rank.name)}</span>
                <span class="tag magenta">${aesthetic.emoji} ${escapeHtml(aesthetic.label)}</span>
              </div>
              <div class="friend-action-bar" style="margin-top:12px">
                ${friendActionsHtml(viewedFriend)}
              </div>
            </div>
          </div>
          ${
            viewed.bio
              ? `<p class="muted" style="margin:14px 0 0">${escapeHtml(viewed.bio)}</p>`
              : `<p class="muted" style="margin:14px 0 0">No bio yet.</p>`
          }
          <div class="stat-grid" style="margin-top:16px">
            <div class="stat"><b>${formatNumber(viewed.totalAura)}</b><span>Aura</span></div>
            <div class="stat"><b>🔥 ${viewed.streak}</b><span>Streak</span></div>
            <div class="stat"><b>${viewed.duelWins}</b><span>Duels</span></div>
          </div>
          <div class="stat-grid" style="margin-top:1px">
            <div class="stat"><b>${viewed.bestDailyScore || "—"}</b><span>Best day</span></div>
            <div class="stat"><b>${viewed.battlePassLevel}</b><span>Pass lvl</span></div>
            <div class="stat"><b>${viewed.coresCount}</b><span>Cores</span></div>
          </div>
        </div>
      `;
      bindFriendActions(viewed.username);
    };

    paintResults();
    paintView();

    const runSearch = async () => {
      const q = (body.querySelector("#lookup-q") as HTMLInputElement).value;
      searchQ = q;
      if (q.trim().length < 1) {
        error = "Enter a name to search.";
        paint();
        return;
      }
      searching = true;
      error = "";
      paint();
      searchResults = await searchProfiles(q);
      searching = false;
      if (searchResults.length === 1) {
        viewed = await fetchPublicProfile(searchResults[0]!.username);
        viewedFriend = await getFriendshipStatus(searchResults[0]!.username);
      } else {
        viewed = null;
        viewedFriend = { status: "none" };
      }
      paint();
    };

    body.querySelector("#lookup-go")?.addEventListener("click", () => {
      void runSearch();
    });
    body.querySelector("#lookup-q")?.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter") {
        e.preventDefault();
        void runSearch();
      }
    });
  };

  void boot();
  void listIncomingRequests().then((r) => {
    incoming = r;
    if (tab === "me") {
      // refresh badge on segment
      const seg = container.querySelector('[data-tab="friends"]');
      if (seg && incoming.length) {
        seg.textContent = `Friends (${incoming.length})`;
      }
    }
  });
}
