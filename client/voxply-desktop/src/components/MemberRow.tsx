import { useState } from "react";
import type { MemberAdminInfo, RoleInfo } from "../types";
import { formatPubkey, formatRelative } from "../utils/format";

export function MemberRow({
  member,
  allRoles,
  voiceMuted,
  onKick,
  onBan,
  onMute,
  onTimeout,
  onVoiceMute,
  onVoiceUnmute,
  onToggleRole,
}: {
  member: MemberAdminInfo;
  allRoles: RoleInfo[];
  voiceMuted: boolean;
  onKick: () => void;
  onBan: () => void;
  onMute: () => void;
  onTimeout: () => void;
  onVoiceMute: () => void;
  onVoiceUnmute: () => void;
  onToggleRole: (roleId: string, hasRole: boolean) => void;
}) {
  const [showRoleMenu, setShowRoleMenu] = useState(false);
  const hasRoleId = new Set(member.roles.map((r) => r.id));

  return (
    <tr>
      <td>
        <div className="member-name">
          {member.display_name || formatPubkey(member.public_key)}
        </div>
        <div className="member-pk" title={member.public_key}>
          {formatPubkey(member.public_key)}
        </div>
      </td>
      <td>
        <span className={`status-dot ${member.online ? "online" : "offline"}`} />{" "}
        {member.online ? "Online" : "Offline"}
      </td>
      <td>
        <div className="member-roles">
          {member.roles.map((r) => (
            <span key={r.id} className="member-role-chip">
              {r.name}
            </span>
          ))}
          {member.roles.length === 0 && <span className="muted">none</span>}
        </div>
      </td>
      <td>{formatRelative(member.first_seen_at)}</td>
      <td>{formatRelative(member.last_seen_at)}</td>
      <td>
        <div className="member-actions">
          <button
            className="btn-small"
            onClick={() => setShowRoleMenu(!showRoleMenu)}
          >
            Roles ▾
          </button>
          <button className="btn-small" onClick={onTimeout}>
            Timeout
          </button>
          <button className="btn-small" onClick={onMute}>
            Mute
          </button>
          {voiceMuted ? (
            <button className="btn-small" onClick={onVoiceUnmute}>
              Unmute voice
            </button>
          ) : (
            <button className="btn-small" onClick={onVoiceMute}>
              Mute voice
            </button>
          )}
          <button className="btn-small" onClick={onKick}>
            Kick
          </button>
          <button className="btn-small btn-secondary-small" onClick={onBan}>
            Ban
          </button>
          {showRoleMenu && (
            <div className="member-role-menu">
              {allRoles.map((r) => {
                const has = hasRoleId.has(r.id);
                // Owner role can't be toggled here (protects server-side rule).
                if (r.id === "builtin-owner") return null;
                return (
                  <label key={r.id} className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={has}
                      onChange={() => onToggleRole(r.id, has)}
                    />
                    {r.name}
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
