import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type {
  AllianceDetail,
  AllianceInfo,
  AllianceInvite,
  AllianceSharedChannel,
  Channel,
} from "../types";

export function AlliancesSection({
  channels,
  ownHubUrl,
}: {
  channels: Channel[];
  ownHubUrl: string;
}) {
  const [alliances, setAlliances] = useState<AllianceInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AllianceDetail | null>(null);
  const [shared, setShared] = useState<AllianceSharedChannel[]>([]);
  const [invite, setInvite] = useState<AllianceInvite | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedCats, setCollapsedCats] = useState<Set<string>>(new Set());

  const [newName, setNewName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  async function refresh() {
    try {
      const list = await invoke<AllianceInfo[]>("list_alliances");
      setAlliances(list);
      if (selectedId && !list.find((a) => a.id === selectedId)) {
        setSelectedId(null);
        setDetail(null);
        setShared([]);
      }
    } catch (e) {
      setError(String(e));
    }
  }

  async function refreshDetail(id: string) {
    try {
      const d = await invoke<AllianceDetail>("get_alliance", { allianceId: id });
      const sh = await invoke<AllianceSharedChannel[]>(
        "list_alliance_shared_channels",
        { allianceId: id },
      );
      setDetail(d);
      setShared(sh);
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) refreshDetail(selectedId);
  }, [selectedId]);

  async function handleCreate() {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await invoke<AllianceInfo>("create_alliance", { name });
      setNewName("");
      await refresh();
      setSelectedId(created.id);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleGenerateInvite() {
    if (!selectedId) return;
    try {
      const inv = await invoke<AllianceInvite>("create_alliance_invite", {
        allianceId: selectedId,
      });
      setInvite(inv);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleJoin() {
    const code = joinCode.trim();
    if (!code) return;
    let u: string, a: string, t: string;
    try {
      const parsed = JSON.parse(atob(code));
      u = parsed.u; a = parsed.a; t = parsed.t;
      if (!u || !a || !t) throw new Error("invalid");
    } catch {
      setError("Invalid share code — make sure you pasted it completely.");
      return;
    }
    try {
      await invoke("join_alliance", {
        inviterHubUrl: u,
        allianceId: a,
        inviteToken: t,
        ownHubPublicUrl: ownHubUrl || u,
      });
      setJoinCode("");
      await refresh();
      setSelectedId(a);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleLeave() {
    if (!selectedId) return;
    if (!confirm("Leave this alliance? Your hub stops sharing channels with it.")) return;
    try {
      await invoke("leave_alliance", { allianceId: selectedId });
      setSelectedId(null);
      setDetail(null);
      setShared([]);
      setInvite(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleToggleShare(channelId: string, currentlyShared: boolean) {
    if (!selectedId) return;
    try {
      if (currentlyShared) {
        await invoke("unshare_channel_from_alliance", {
          allianceId: selectedId,
          channelId,
        });
      } else {
        await invoke("share_channel_with_alliance", {
          allianceId: selectedId,
          channelId,
        });
      }
      await refreshDetail(selectedId);
    } catch (e) {
      setError(String(e));
    }
  }

  const sharedChannelIds = new Set(shared.map((s) => s.channel_id));

  const rootItems = channels
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.display_order - b.display_order);

  function getChildren(parentId: string) {
    return channels
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.display_order - b.display_order);
  }

  function categorySharedState(catId: string): "all" | "some" | "none" {
    const children = getChildren(catId).filter((c) => !c.is_category);
    if (children.length === 0) return "none";
    const sharedCount = children.filter((c) => sharedChannelIds.has(c.id)).length;
    if (sharedCount === children.length) return "all";
    if (sharedCount > 0) return "some";
    return "none";
  }

  async function handleToggleCategoryShare(catId: string) {
    if (!selectedId) return;
    const children = getChildren(catId).filter((c) => !c.is_category);
    const state = categorySharedState(catId);
    const shouldShare = state === "none";
    for (const ch of children) {
      const isShared = sharedChannelIds.has(ch.id);
      if (shouldShare && !isShared) {
        await invoke("share_channel_with_alliance", { allianceId: selectedId, channelId: ch.id });
      } else if (!shouldShare && isShared) {
        await invoke("unshare_channel_from_alliance", { allianceId: selectedId, channelId: ch.id });
      }
    }
    await refreshDetail(selectedId);
  }

  return (
    <section>
      <h1>Alliances</h1>
      <p className="muted">
        Group your hub with other hubs to share channels and voice. A hub can
        be in multiple alliances.
      </p>

      {error && <div className="error-banner">{error}</div>}

      {alliances.length > 0 && (
        <div className="settings-section">
          <label className="settings-label">Active alliance</label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(e.target.value || null)}
          >
            <option value="">— select an alliance —</option>
            {alliances.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      )}

      {selectedId && detail && (
        <div className="alliance-detail">
          <div className="alliance-detail-header">
            <h2>{detail.name}</h2>
            <button className="btn-secondary-small" onClick={handleLeave}>
              Leave alliance
            </button>
          </div>

          <div className="settings-section">
            <label className="settings-label">Member hubs</label>
            <ul className="alliance-members">
              {detail.members.map((m) => (
                <li key={m.hub_public_key}>
                  <strong>{m.hub_name}</strong>
                  <span className="muted"> — {m.hub_url}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="settings-section">
            <label className="settings-label">Channels you share</label>
            <p className="muted">
              Toggle which of your local channels are visible to other members
              of this alliance.
            </p>
            {rootItems.length === 0 ? (
              <p className="muted">No channels to share yet.</p>
            ) : (
              <div className="alliance-channel-tree">
                {rootItems.map((item) => {
                  if (item.is_category) {
                    const catState = categorySharedState(item.id);
                    const collapsed = collapsedCats.has(item.id);
                    const children = getChildren(item.id).filter((c) => !c.is_category);
                    return (
                      <div key={item.id} className="act-category">
                        <div className="act-category-header">
                          <button
                            className="act-collapse-btn"
                            onClick={() => setCollapsedCats((prev) => {
                              const next = new Set(prev);
                              if (next.has(item.id)) next.delete(item.id); else next.add(item.id);
                              return next;
                            })}
                          >
                            {collapsed ? "▸" : "▾"}
                          </button>
                          <label className="checkbox-label act-category-label">
                            <input
                              type="checkbox"
                              checked={catState === "all"}
                              ref={(el) => { if (el) el.indeterminate = catState === "some"; }}
                              onChange={() => handleToggleCategoryShare(item.id)}
                            />
                            <strong>{item.name.toUpperCase()}</strong>
                          </label>
                        </div>
                        {!collapsed && children.length > 0 && (
                          <div className="act-children">
                            {children.map((ch) => {
                              const isShared = sharedChannelIds.has(ch.id);
                              return (
                                <label key={ch.id} className="checkbox-label act-channel">
                                  <input
                                    type="checkbox"
                                    checked={isShared}
                                    onChange={() => handleToggleShare(ch.id, isShared)}
                                  />
                                  # {ch.name}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  } else {
                    const isShared = sharedChannelIds.has(item.id);
                    return (
                      <label key={item.id} className="checkbox-label act-channel act-toplevel">
                        <input
                          type="checkbox"
                          checked={isShared}
                          onChange={() => handleToggleShare(item.id, isShared)}
                        />
                        # {item.name}
                      </label>
                    );
                  }
                })}
              </div>
            )}
          </div>

          <div className="settings-section">
            <label className="settings-label">Invite another hub</label>
            <p className="muted">
              Generate a share code and send it to the other hub's admin.
            </p>
            <button className="btn-secondary" onClick={handleGenerateInvite}>
              {invite ? "Regenerate share code" : "Generate share code"}
            </button>
            {invite && invite.alliance_id === selectedId && (() => {
              const shareCode = btoa(JSON.stringify({
                u: ownHubUrl,
                a: invite.alliance_id,
                t: invite.token,
              }));
              return (
                <div className="alliance-share-code-block">
                  <p className="muted">Share this code with the other hub's admin:</p>
                  <div className="alliance-share-code-row">
                    <code className="alliance-share-code">{shareCode}</code>
                    <button
                      className="btn-secondary"
                      onClick={() => navigator.clipboard.writeText(shareCode).catch(() => {})}
                      title="Copy to clipboard"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      <div className="settings-section">
        <label className="settings-label">Create a new alliance</label>
        <div className="settings-row">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Alliance name"
          />
          <button onClick={handleCreate} disabled={!newName.trim()}>
            Create
          </button>
        </div>
      </div>

      <div className="settings-section">
        <label className="settings-label">Join an alliance</label>
        <p className="muted">Paste the share code you received from the other hub's admin.</p>
        <div className="alliance-join-form">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Paste share code here…"
          />
          <button
            onClick={handleJoin}
            disabled={!joinCode.trim()}
          >
            Join
          </button>
        </div>
      </div>
    </section>
  );
}
