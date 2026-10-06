import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type AdminUser = {
  user_id: string;
  email: string;
  full_name: string | null;
  common_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  role_code: string | null;
  role_name: string | null;
  role_scope: string | null;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  role_ended_at: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) return 'AS';

  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function roleLabel(role: string | null) {
  if (!role) return 'No role';

  return role
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  async function loadUsers() {
    setLoading(true);

    const { data, error } = await supabase.rpc(
      'admin_list_users'
    );

    if (error) {
      console.error(error);
      setUsers([]);
    } else {
      setUsers((data || []) as AdminUser[]);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const roles = useMemo(() => {
    return Array.from(
      new Set(
        users
          .map((user) => user.role_code)
          .filter(Boolean)
      )
    ) as string[];
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.toLowerCase().trim();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        [
          user.full_name,
          user.common_name,
          user.email,
          user.phone,
          user.role_name,
          user.company_name,
          user.branch_name,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLowerCase()
              .includes(query)
          );

      const matchesRole =
        roleFilter === 'ALL' ||
        user.role_code === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' ||
        user.status === statusFilter;

      return (
        matchesSearch &&
        matchesRole &&
        matchesStatus
      );
    });
  }, [users, search, roleFilter, statusFilter]);

  const activeUsers = users.filter(
    (user) => user.status === 'ACTIVE'
  ).length;

  const administratorUsers = users.filter((user) =>
    [
      'SUPER_ADMIN',
      'ASOMAC_ADMIN',
      'COMPANY_ADMIN',
    ].includes(user.role_code || '')
  ).length;

  const inactiveUsers = users.filter(
    (user) => user.status !== 'ACTIVE'
  ).length;

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PLATFORM DIRECTORY
          </div>

          <h1>Users</h1>

          <p>
            Manage people, administrators, roles and
            organizational placement across ASOMAC.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={() =>
            alert(
              'User invitation workflow will be connected next.'
            )
          }
        >
          + Invite User
        </button>
      </div>

      <div className="stats-grid">
        <div className="neumorphic-stat">
          <div className="stat-icon blue">
            👥
          </div>

          <div>
            <span>Total Users</span>
            <strong>{users.length}</strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon green">
            ✓
          </div>

          <div>
            <span>Active Users</span>
            <strong>{activeUsers}</strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon orange">
            🛡
          </div>

          <div>
            <span>Administrators</span>
            <strong>{administratorUsers}</strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon gray">
            ○
          </div>

          <div>
            <span>Inactive</span>
            <strong>{inactiveUsers}</strong>
          </div>
        </div>
      </div>

      <section className="content-card users-card">
        <div className="card-toolbar">
          <div>
            <h2>User Directory</h2>
            <p>
              {filteredUsers.length} user
              {filteredUsers.length === 1 ? '' : 's'} displayed
            </p>
          </div>

          <button
            className="secondary-button"
            onClick={loadUsers}
          >
            ↻ Refresh
          </button>
        </div>

        <div className="filters">
          <div className="search-box">
            <span>⌕</span>

            <input
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search users, companies, branches..."
            />
          </div>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value)
            }
          >
            <option value="ALL">All roles</option>

            {roles.map((role) => (
              <option key={role} value={role}>
                {roleLabel(role)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value)
            }
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Loading users...</span>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">👥</div>
            <h3>No users found</h3>
            <p>
              Try changing your search or filters.
            </p>
          </div>
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Organization</th>
                  <th>Company</th>
                  <th>Branch</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredUsers.map((user) => {
                  const name =
                    user.common_name ||
                    user.full_name ||
                    'Unnamed User';

                  return (
                    <tr key={user.user_id}>
                      <td>
                        <div className="user-cell">
                          {user.avatar_url ? (
                            <img
                              src={user.avatar_url}
                              alt={name}
                              className="table-avatar"
                            />
                          ) : (
                            <div className="table-avatar avatar-fallback">
                              {initials(name)}
                            </div>
                          )}

                          <div className="user-details">
                            <strong>{name}</strong>

                            {user.common_name &&
                              user.full_name &&
                              user.common_name !==
                                user.full_name && (
                                <span>
                                  {user.full_name}
                                </span>
                              )}

                            <small>{user.email}</small>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="role-badge">
                          {roleLabel(user.role_code)}
                        </span>
                      </td>

                      <td>
                        <span className="location-text">
                          {user.role_scope || '—'}
                        </span>
                      </td>

                      <td>
                        {user.company_name || '—'}
                      </td>

                      <td>
                        {user.branch_name || '—'}
                      </td>

                      <td>
                        <span
                          className={`status-badge ${
                            user.status === 'ACTIVE'
                              ? 'active'
                              : 'inactive'
                          }`}
                        >
                          <span />
                          {user.status}
                        </span>
                      </td>

                      <td>
                        <button
                          className="table-action"
                          onClick={() =>
                            alert(
                              `User management for ${name} will be connected next.`
                            )
                          }
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
