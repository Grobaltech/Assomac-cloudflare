import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

type AdminUser = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  common_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  status: string | null;
  role_code: string | null;
  role_name: string | null;
  role_scope: string | null;
  company_id: string | null;
  company_name: string | null;
  branch_id: string | null;
  branch_name: string | null;
  role_ended_at: string | null;
};

type Section =
  | 'overview'
  | 'users'
  | 'administrators'
  | 'audit'
  | 'settings';


function AsomacChairpersonPanel() {
  const [companyCount, setCompanyCount] = useState(0);
  const [activeCompanies, setActiveCompanies] = useState(0);
  const [pendingCompanies, setPendingCompanies] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('companies')
        .select('id,status,membership_status');

      if (!error) {
        const rows = data || [];
        setCompanyCount(rows.length);
        setActiveCompanies(rows.filter((x: any) => x.status === 'ACTIVE').length);
        setPendingCompanies(rows.filter((x: any) => x.membership_status === 'PENDING').length);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-[#00194C] text-white p-7 md:p-9 shadow-xl">
        <p className="text-[#f35a02] text-xs font-black tracking-[0.2em]">
          ASOMAC CHAIRPERSON
        </p>
        <h1 className="text-3xl md:text-4xl font-black mt-2">
          ASOMAC Administration
        </h1>
        <p className="text-blue-100 mt-3 max-w-2xl">
          Manage ASOMAC company information, register member companies and assign company-level users.
          System administration remains exclusively with the Super Administrator.
        </p>
      </section>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard label="Registered Companies" value={loading ? 0 : companyCount} description="Companies in the ASOMAC registry" icon="▦" />
        <StatCard label="Active Companies" value={loading ? 0 : activeCompanies} description="Currently active companies" icon="✓" />
        <StatCard label="Pending Memberships" value={loading ? 0 : pendingCompanies} description="Companies awaiting membership action" icon="◷" />
      </div>

      <section className="card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[#f35a02] font-bold text-sm">COMPANY MANAGEMENT</p>
            <h2 className="text-2xl font-black text-[#00194C] mt-1">ASOMAC Company Registry</h2>
            <p className="text-slate-500 mt-2">
              Register companies, maintain their official information, manage membership records and assign company users.
            </p>
          </div>
          <Link
            to="/companies"
            className="inline-flex items-center justify-center rounded-xl bg-[#f35a02] text-white px-5 py-3 font-black hover:opacity-90"
          >
            + Register / Manage Companies
          </Link>
        </div>
      </section>

      <section className="card p-6">
        <h2 className="text-lg font-black text-[#00194C]">Your authority</h2>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <ScopeItem yes text="Register and edit company information" />
          <ScopeItem yes text="Maintain ASOMAC membership records" />
          <ScopeItem yes text="Assign company-level users" />
          <ScopeItem yes text="Maintain company leadership information" />
          <ScopeItem text="View or edit Super Administrator accounts" />
          <ScopeItem text="Change system-wide security or configuration" />
        </div>
      </section>
    </div>
  );
}

function ScopeItem({ yes = false, text }: { yes?: boolean; text: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-3 flex items-center gap-3">
      <span className={yes ? 'text-green-600 font-black' : 'text-red-500 font-black'}>
        {yes ? '✓' : '×'}
      </span>
      <span className="text-sm font-bold text-slate-700">{text}</span>
    </div>
  );
}

export default function Admin() {
  const [section, setSection] = useState<Section>('overview');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userError, setUserError] = useState('');

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [profile, setProfile] = useState<any>(null);
  const [currentRole, setCurrentRole] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    loadCurrentProfile();
  }, []);

  useEffect(() => {
    if ((section === 'users' || section === 'administrators') &&
        (currentRole === 'SUPER_ADMIN' || currentRole === 'ASSOMAC_ADMIN')) {
      loadUsers();
    }
  }, [section, currentRole]);

  async function loadCurrentProfile() {
    setLoadingProfile(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoadingProfile(false);
      return;
    }

    const { data } = await supabase
      .from('profiles')
      .select('id,full_name,common_name,email,phone,avatar_url,status')
      .eq('id', user.id)
      .maybeSingle();

    setProfile(data);

    const { data: roleData } = await supabase
      .from('user_roles')
      .select('roles(code)')
      .eq('user_id', user.id)
      .is('ended_at', null)
      .order('assigned_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const roleCode = Array.isArray(roleData?.roles)
      ? roleData?.roles?.[0]?.code
      : (roleData?.roles as any)?.code;

    setCurrentRole(roleCode || null);
    setLoadingProfile(false);
  }

  async function loadUsers() {
    setLoadingUsers(true);
    setUserError('');

    const { data, error } = await supabase.rpc('admin_list_users');

    if (error) {
      setUserError(error.message);
      setUsers([]);
    } else {
      setUsers((data || []) as AdminUser[]);
    }

    setLoadingUsers(false);
  }

  const administrators = useMemo(() => {
    return users.filter((user) =>
      [
        'SUPER_ADMIN',
        'ASSOMAC_ADMIN',
        'COMPANY_ADMIN',
        'COMPANY_DIRECTOR',
        'BRANCH_DIRECTOR',
        'BRANCH_MANAGER',
      ].includes(user.role_code || '')
    );
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();

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
            String(value).toLowerCase().includes(query)
          );

      const matchesRole =
        roleFilter === 'ALL' || user.role_code === roleFilter;

      const matchesStatus =
        statusFilter === 'ALL' || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const totalUsers = users.length;

  const activeUsers = users.filter(
    (user) => user.status === 'ACTIVE'
  ).length;

  const inactiveUsers = users.filter(
    (user) => user.status !== 'ACTIVE'
  ).length;

  const uniqueCompanies = new Set(
    users
      .map((user) => user.company_id)
      .filter(Boolean)
  ).size;

  const uniqueBranches = new Set(
    users
      .map((user) => user.branch_id)
      .filter(Boolean)
  ).size;

  const platformAdmins = users.filter((user) =>
    ['SUPER_ADMIN', 'ASSOMAC_ADMIN'].includes(
      user.role_code || ''
    )
  ).length;

  function displayName(user: AdminUser) {
    return (
      user.common_name ||
      user.full_name ||
      user.email ||
      'Unnamed user'
    );
  }

  function roleBadgeClass(role: string | null) {
    switch (role) {
      case 'SUPER_ADMIN':
        return 'bg-purple-100 text-purple-700';
      case 'ASSOMAC_ADMIN':
        return 'bg-blue-100 text-blue-700';
      case 'COMPANY_ADMIN':
        return 'bg-orange-100 text-orange-700';
      case 'BRANCH_MANAGER':
      case 'BRANCH_DIRECTOR':
        return 'bg-green-100 text-green-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  function statusBadgeClass(status: string | null) {
    return status === 'ACTIVE'
      ? 'bg-green-100 text-green-700'
      : 'bg-slate-100 text-slate-600';
  }

  if (loadingProfile) {
    return (
      <div className="p-10 text-center text-slate-500">
        Loading administration centre…
      </div>
    );
  }

  if (currentRole === 'ASSOMAC_ADMIN') {\n    return <AsomacChairpersonPanel />;\n  }\n\n  if (currentRole !== 'SUPER_ADMIN') {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-2xl font-black text-[#00194C]">Administration access required</h1>
        <p className="text-slate-500 mt-2">This area is reserved for ASOMAC platform administrators.</p>
      </div>
    );
  }

  const administratorLabel = currentRole === 'SUPER_ADMIN'
    ? 'SUPER ADMINISTRATOR'
    : 'ASOMAC ADMINISTRATOR';

  return (
    <div className="space-y-6">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <section className="rounded-3xl bg-[#00194C] text-white p-7 md:p-9 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">

          <div>
            <p className="text-[#f35a02] text-xs font-black tracking-[0.2em]">
              {administratorLabel}
            </p>

            <h1 className="text-3xl md:text-4xl font-black mt-2">
              Platform Control Centre
            </h1>

            <p className="text-blue-100 mt-3 max-w-2xl">
              Platform administration for ASOMAC users, organizations,
              security, access control and system activity.
            </p>
          </div>

          <div className="rounded-2xl bg-white/10 border border-white/10 px-5 py-4 min-w-[230px]">
            <p className="text-xs text-blue-200">
              Signed in as
            </p>

            <p className="font-bold mt-1">
              {profile?.common_name ||
                profile?.full_name ||
                'Super Administrator'}
            </p>

            <p className="text-sm text-blue-200 mt-1">
              {profile?.email || '—'}
            </p>
          </div>

        </div>
      </section>


      {/* ======================================================
          NAVIGATION
      ====================================================== */}

      <section className="card p-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">

          <AdminNavButton
            active={section === 'overview'}
            onClick={() => setSection('overview')}
            icon="⌂"
            label="Overview"
          />

          <AdminNavButton
            active={section === 'users'}
            onClick={() => setSection('users')}
            icon="👥"
            label="Users"
          />

          <AdminNavButton
            active={section === 'administrators'}
            onClick={() => setSection('administrators')}
            icon="🛡"
            label="Administrators"
          />

          <AdminNavButton
            active={section === 'audit'}
            onClick={() => setSection('audit')}
            icon="▤"
            label="Audit Logs"
          />

          <AdminNavButton
            active={section === 'settings'}
            onClick={() => setSection('settings')}
            icon="⚙"
            label="System Settings"
          />

        </div>
      </section>


      {/* ======================================================
          OVERVIEW
      ====================================================== */}

      {section === 'overview' && (
        <>
          <div>
            <p className="text-[#f35a02] font-bold text-sm">
              PLATFORM OVERVIEW
            </p>

            <h2 className="text-2xl font-black text-[#00194C] mt-1">
              ASOMAC at a glance
            </h2>

            <p className="text-slate-500 mt-2">
              A complete system-wide view for the Super Administrator.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">

            <StatCard
              label="Total Users"
              value={totalUsers}
              description="Registered platform users"
              icon="👥"
            />

            <StatCard
              label="Active Users"
              value={activeUsers}
              description="Currently active accounts"
              icon="✓"
            />

            <StatCard
              label="Administrators"
              value={platformAdmins}
              description="Platform-level administrators"
              icon="🛡"
            />

            <StatCard
              label="Companies"
              value={uniqueCompanies}
              description="Companies represented by users"
              icon="▦"
            />

          </div>

          <div className="grid lg:grid-cols-2 gap-5">

            <div className="card p-6">
              <p className="text-sm text-slate-500">
                Organizational footprint
              </p>

              <div className="grid grid-cols-2 gap-4 mt-5">

                <MiniMetric
                  label="Branches"
                  value={uniqueBranches}
                />

                <MiniMetric
                  label="Inactive users"
                  value={inactiveUsers}
                />

              </div>
            </div>

            <div className="card p-6">
              <p className="text-sm text-slate-500">
                Security model
              </p>

              <h3 className="font-bold text-lg text-[#00194C] mt-2">
                Database-enforced access
              </h3>

              <p className="text-sm text-slate-500 mt-2 leading-6">
                User visibility and administrative operations are
                protected by Supabase authentication, RLS and
                server-side administrative functions.
              </p>

              <div className="flex flex-wrap gap-2 mt-4">
                <span className="rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-bold">
                  Authentication
                </span>

                <span className="rounded-full bg-blue-100 text-blue-700 px-3 py-1 text-xs font-bold">
                  RLS
                </span>

                <span className="rounded-full bg-purple-100 text-purple-700 px-3 py-1 text-xs font-bold">
                  Audit
                </span>
              </div>
            </div>

          </div>

          <div className="card p-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

              <div>
                <h2 className="text-lg font-black text-[#00194C]">
                  Quick administration
                </h2>

                <p className="text-sm text-slate-500 mt-1">
                  Open the main management areas.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">

                <button
                  onClick={() => setSection('users')}
                  className="rounded-xl bg-[#00194C] text-white px-4 py-2.5 text-sm font-bold hover:opacity-90"
                >
                  Manage Users
                </button>

                <button
                  onClick={() => setSection('administrators')}
                  className="rounded-xl bg-[#f35a02] text-white px-4 py-2.5 text-sm font-bold hover:opacity-90"
                >
                  Administrators
                </button>

              </div>

            </div>

          </div>
        </>
      )}


      {/* ======================================================
          USERS
      ====================================================== */}

      {section === 'users' && (
        <section className="space-y-5">

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">

            <div>
              <p className="text-[#f35a02] font-bold text-sm">
                USER MANAGEMENT
              </p>

              <h2 className="text-3xl font-black text-[#00194C] mt-1">
                Platform Users
              </h2>

              <p className="text-slate-500 mt-2">
                View users and their current organizational placement.
              </p>
            </div>

            <button
              onClick={loadUsers}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold hover:bg-slate-50"
            >
              ↻ Refresh
            </button>

          </div>


          {/* Filters */}

          <div className="card p-4">

            <div className="grid md:grid-cols-3 gap-3">

              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search name, email, company, branch..."
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f35a02]/30"
              />

              <select
                value={roleFilter}
                onChange={(event) =>
                  setRoleFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
              >
                <option value="ALL">
                  All roles
                </option>

                {[...new Set(
                  users
                    .map((user) => user.role_code)
                    .filter(Boolean)
                )].map((role) => (
                  <option key={role} value={role!}>
                    {role}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value)
                }
                className="rounded-xl border border-slate-200 px-4 py-3 text-sm bg-white"
              >
                <option value="ALL">
                  All statuses
                </option>

                {[...new Set(
                  users
                    .map((user) => user.status)
                    .filter(Boolean)
                )].map((status) => (
                  <option key={status} value={status!}>
                    {status}
                  </option>
                ))}
              </select>

            </div>

          </div>


          {/* Error */}

          {userError && (
            <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 p-4 text-sm">
              <strong>Unable to load users:</strong>{' '}
              {userError}
            </div>
          )}


          {/* User table */}

          <div className="card overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-50 border-b border-slate-200">

                  <tr className="text-left">

                    <th className="px-5 py-4 font-bold">
                      User
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Role
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Organization
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Company
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Branch
                    </th>

                    <th className="px-5 py-4 font-bold">
                      Status
                    </th>

                    <th className="px-5 py-4 font-bold text-right">
                      Action
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {loadingUsers ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        Loading users…
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-5 py-12 text-center text-slate-500"
                      >
                        No users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => (
                      <tr
                        key={`${user.user_id}-${user.role_code}`}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >

                        <td className="px-5 py-4">

                          <div className="flex items-center gap-3">

                            {user.avatar_url ? (
                              <img
                                src={user.avatar_url}
                                alt=""
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-[#00194C] text-white flex items-center justify-center font-bold">
                                {displayName(user)
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            )}

                            <div>
                              <p className="font-bold text-slate-800">
                                {displayName(user)}
                              </p>

                              {user.common_name &&
                                user.full_name &&
                                user.common_name !==
                                  user.full_name && (
                                  <p className="text-xs text-slate-400">
                                    {user.full_name}
                                  </p>
                                )}

                              <p className="text-xs text-slate-500">
                                {user.email || 'No email'}
                              </p>
                            </div>

                          </div>

                        </td>


                        <td className="px-5 py-4">

                          {user.role_code ? (
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${roleBadgeClass(
                                user.role_code
                              )}`}
                            >
                              {user.role_code}
                            </span>
                          ) : (
                            <span className="text-slate-400">
                              No role
                            </span>
                          )}

                        </td>


                        <td className="px-5 py-4">

                          {user.role_scope || '—'}

                        </td>


                        <td className="px-5 py-4">

                          {user.company_name || (
                            <span className="text-slate-400">
                              Platform level
                            </span>
                          )}

                        </td>


                        <td className="px-5 py-4">

                          {user.branch_name || (
                            <span className="text-slate-400">
                              —
                            </span>
                          )}

                        </td>


                        <td className="px-5 py-4">

                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${statusBadgeClass(
                              user.status
                            )}`}
                          >
                            {user.status || 'UNKNOWN'}
                          </span>

                        </td>


                        <td className="px-5 py-4 text-right">

                          <button
                            onClick={() =>
                              alert(
                                `User details panel for ${displayName(
                                  user
                                )} will be connected next.`
                              )
                            }
                            className="rounded-lg bg-[#00194C] text-white px-3 py-2 text-xs font-bold"
                          >
                            View / Edit
                          </button>

                        </td>

                      </tr>
                    ))
                  )}

                </tbody>

              </table>

            </div>

          </div>

          <p className="text-xs text-slate-400">
            Showing {filteredUsers.length} of {users.length} users.
          </p>

        </section>
      )}


      {/* ======================================================
          ADMINISTRATORS
      ====================================================== */}

      {section === 'administrators' && (
        <section className="space-y-5">

          <div>
            <p className="text-[#f35a02] font-bold text-sm">
              ADMINISTRATION
            </p>

            <h2 className="text-3xl font-black text-[#00194C] mt-1">
              Administrators
            </h2>

            <p className="text-slate-500 mt-2">
              Platform and organizational administrators currently
              assigned within ASOMAC.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">

            <StatCard
              label="Super Admins"
              value={
                administrators.filter(
                  (u) => u.role_code === 'SUPER_ADMIN'
                ).length
              }
              description="Platform authority"
              icon="👑"
            />

            <StatCard
              label="ASOMAC Admins"
              value={
                administrators.filter(
                  (u) => u.role_code === 'ASOMAC_ADMIN'
                ).length
              }
              description="ASOMAC administration"
              icon="🛡"
            />

            <StatCard
              label="Company Admins"
              value={
                administrators.filter(
                  (u) => u.role_code === 'COMPANY_ADMIN'
                ).length
              }
              description="Company-level administration"
              icon="🏢"
            />

            <StatCard
              label="Branch Managers"
              value={
                administrators.filter(
                  (u) =>
                    u.role_code === 'BRANCH_MANAGER' ||
                    u.role_code === 'BRANCH_DIRECTOR'
                ).length
              }
              description="Branch-level administration"
              icon="📍"
            />

          </div>

          <div className="card overflow-hidden">

            <div className="overflow-x-auto">

              <table className="w-full text-sm">

                <thead className="bg-slate-50 border-b">
                  <tr className="text-left">
                    <th className="px-5 py-4">
                      Administrator
                    </th>

                    <th className="px-5 py-4">
                      Role
                    </th>

                    <th className="px-5 py-4">
                      Company
                    </th>

                    <th className="px-5 py-4">
                      Branch
                    </th>

                    <th className="px-5 py-4">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody>

                  {administrators.map((user) => (
                    <tr
                      key={`${user.user_id}-${user.role_code}`}
                      className="border-b"
                    >

                      <td className="px-5 py-4">
                        <p className="font-bold">
                          {displayName(user)}
                        </p>

                        <p className="text-xs text-slate-500">
                          {user.email}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${roleBadgeClass(
                            user.role_code
                          )}`}
                        >
                          {user.role_code}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        {user.company_name || 'Platform level'}
                      </td>

                      <td className="px-5 py-4">
                        {user.branch_name || '—'}
                      </td>

                      <td className="px-5 py-4">
                        {user.status || 'UNKNOWN'}
                      </td>

                    </tr>
                  ))}

                </tbody>

              </table>

            </div>

          </div>

        </section>
      )}


      {/* ======================================================
          AUDIT
      ====================================================== */}

      {section === 'audit' && (
        <section className="space-y-5">

          <div>
            <p className="text-[#f35a02] font-bold text-sm">
              SECURITY
            </p>

            <h2 className="text-3xl font-black text-[#00194C] mt-1">
              Audit Logs
            </h2>

            <p className="text-slate-500 mt-2">
              Administrative history will appear here as the
              audit viewer is connected.
            </p>
          </div>

          <div className="card p-10 text-center">

            <div className="text-5xl mb-4">
              🔐
            </div>

            <h3 className="font-black text-xl text-[#00194C]">
              Audit trail
            </h3>

            <p className="text-slate-500 mt-2 max-w-xl mx-auto">
              User changes, role assignments, company changes,
              branch changes and other sensitive operations will
              be recorded here.
            </p>

          </div>

        </section>
      )}


      {/* ======================================================
          SETTINGS
      ====================================================== */}

      {section === 'settings' && (
        <section className="space-y-5">

          <div>
            <p className="text-[#f35a02] font-bold text-sm">
              PLATFORM
            </p>

            <h2 className="text-3xl font-black text-[#00194C] mt-1">
              System Settings
            </h2>

            <p className="text-slate-500 mt-2">
              Platform-level configuration reserved for the
              Super Administrator.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-5">

            <div className="card p-6">

              <h3 className="font-black text-lg text-[#00194C]">
                Platform security
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Authentication, role hierarchy, RLS and security
                policies.
              </p>

              <span className="inline-flex mt-5 rounded-full bg-green-100 text-green-700 px-3 py-1 text-xs font-bold">
                Protected
              </span>

            </div>

            <div className="card p-6">

              <h3 className="font-black text-lg text-[#00194C]">
                Future configuration
              </h3>

              <p className="text-sm text-slate-500 mt-2">
                Global platform preferences will be managed here.
              </p>

              <span className="inline-flex mt-5 rounded-full bg-slate-100 text-slate-600 px-3 py-1 text-xs font-bold">
                Coming next
              </span>

            </div>

          </div>

        </section>
      )}

    </div>
  );
}


/* ============================================================
   COMPONENTS
   ============================================================ */

function AdminNavButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: string;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-3 rounded-xl text-sm font-bold transition ${
        active
          ? 'bg-[#00194C] text-white'
          : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      <span className="mr-2">{icon}</span>
      {label}
    </button>
  );
}


function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: string;
}) {
  return (
    <div className="card p-6">

      <div className="flex items-start justify-between gap-4">

        <div>
          <p className="text-sm text-slate-500">
            {label}
          </p>

          <p className="text-4xl font-black text-[#00194C] mt-2">
            {value}
          </p>

          <p className="text-xs text-slate-400 mt-2">
            {description}
          </p>
        </div>

        <div className="w-11 h-11 rounded-xl bg-slate-100 flex items-center justify-center text-xl">
          {icon}
        </div>

      </div>

    </div>
  );
}


function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-5">

      <p className="text-xs text-slate-500">
        {label}
      </p>

      <p className="text-2xl font-black text-[#00194C] mt-1">
        {value}
      </p>

    </div>
  );
}
