import { useEffect, useMemo, useState, type FormEvent } from 'react';
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

type ModalMode = 'view' | 'edit';

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

function statusLabel(status: string | null) {
  if (!status) return 'Unknown';

  return status
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function roleClass(role: string | null) {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'super-admin';

    case 'ASOMAC_ADMIN':
      return 'asomac-admin';

    case 'COMPANY_ADMIN':
      return 'company-admin';

    case 'BRANCH_ADMIN':
      return 'branch-admin';

    default:
      return '';
  }
}

function statusClass(status: string | null) {
  if (status === 'ACTIVE') return 'active';
  if (status === 'SUSPENDED') return 'suspended';

  return 'inactive';
}

export default function Users() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [selectedUser, setSelectedUser] =
    useState<AdminUser | null>(null);

  const [modalMode, setModalMode] =
    useState<ModalMode>('view');

  const [showInviteModal, setShowInviteModal] =
    useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [editFullName, setEditFullName] =
    useState('');

  const [editPhone, setEditPhone] =
    useState('');

  const [editStatus, setEditStatus] =
    useState('ACTIVE');

  const [editRoleId, setEditRoleId] =
    useState('');

  const [editCompanyId, setEditCompanyId] =
    useState('');

  const [editBranchId, setEditBranchId] =
    useState('');

  const [editBranches, setEditBranches] =
    useState<{ id: string; company_id: string; name: string }[]>([]);

  const [editRoles, setEditRoles] =
    useState<{ id: string; code: string; name: string; scope: string }[]>([]);

  const [editCompanies, setEditCompanies] =
    useState<{ id: string; name: string }[]>([]);

  const [inviteEmail, setInviteEmail] =
    useState('');

  const [emailChecking, setEmailChecking] =
    useState(false);

  const [emailCheck, setEmailCheck] =
    useState<{
      status: 'idle' | 'checking' | 'valid' | 'invalid';
      message: string;
    }>({
      status: 'idle',
      message: '',
    });

  const [inviteName, setInviteName] =
    useState('');

  const [invitePhone, setInvitePhone] =
    useState('');

  const [inviteRole, setInviteRole] =
    useState('');

  const [inviteRoles, setInviteRoles] =
    useState<{ id: string; code: string; name: string; scope: string }[]>([]);

  const [inviteCompanies, setInviteCompanies] =
    useState<{ id: string; name: string }[]>([]);

  const [inviteBranches, setInviteBranches] =
    useState<{ id: string; company_id: string; name: string }[]>([]);

  const [inviteCompanyId, setInviteCompanyId] =
    useState('');

  const [inviteBranchId, setInviteBranchId] =
    useState('');

  const [generatedInvitation, setGeneratedInvitation] =
    useState<{ token: string; expiresAt: string; url: string } | null>(null);

  async function loadUsers(showRefresh = false) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setErrorMessage('');

    const { data, error } = await supabase.rpc(
      'admin_list_users'
    );

    if (error) {
      console.error(error);
      setUsers([]);
      setErrorMessage(
        error.message ||
          'Unable to load users.'
      );
    } else {
      setUsers(
        (data || []) as AdminUser[]
      );
    }

    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    loadUsers();
    loadInviteRoles();
    loadInviteCompanies();
  }, []);

  async function loadInviteRoles() {
    const { data, error } = await supabase
      .from('roles')
      .select('id, code, name, scope')
      .order('name');

    if (error) {
      console.error(error);
      setInviteRoles([]);
      setInviteRole('');
      setErrorMessage(
        error.message || 'Unable to load available invitation roles.'
      );
      return;
    }

    const availableRoles =
      (data || []) as {
        id: string;
        code: string;
        name: string;
        scope: string;
      }[];

    setInviteRoles(availableRoles);

    setInviteRole((currentRole) => {
      if (
        currentRole &&
        availableRoles.some((role) => role.code === currentRole)
      ) {
        return currentRole;
      }

      return availableRoles[0]?.code || '';
    });
  }

  async function loadInviteCompanies() {
    const { data, error } = await supabase
      .from('companies')
      .select('id, name')
      .order('name');

    if (error) {
      console.error(error);
      setInviteCompanies([]);
      setErrorMessage(
        error.message || 'Unable to load companies for invitations.'
      );
      return;
    }

    setInviteCompanies(
      (data || []) as { id: string; name: string }[]
    );
  }

  async function loadInviteBranches(companyId: string) {
    if (!companyId) {
      setInviteBranches([]);
      setInviteBranchId('');
      return;
    }

    const { data, error } = await supabase
      .from('branches')
      .select('id, company_id, name')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error(error);
      setInviteBranches([]);
      setInviteBranchId('');
      setErrorMessage(
        error.message || 'Unable to load branches for the selected company.'
      );
      return;
    }

    setInviteBranches(
      (data || []) as { id: string; company_id: string; name: string }[]
    );
    setInviteBranchId('');
  }

  function selectedInviteRole() {
    return inviteRoles.find((role) => role.code === inviteRole) || null;
  }

  function inviteRoleNeedsCompany() {
    const scope = selectedInviteRole()?.scope?.toUpperCase();
    return scope === 'COMPANY' || scope === 'BRANCH';
  }

  function inviteRoleNeedsBranch() {
    return selectedInviteRole()?.scope?.toUpperCase() === 'BRANCH';
  }

  function handleInviteRoleChange(roleCode: string) {
    setInviteRole(roleCode);

    const role = inviteRoles.find((item) => item.code === roleCode);
    const scope = role?.scope?.toUpperCase();

    if (scope === 'BRANCH' || scope === 'COMPANY') {
      setInviteCompanyId('');
    } else {
      setInviteCompanyId('');
      setInviteBranchId('');
      setInviteBranches([]);
    }

    if (scope !== 'BRANCH') {
      setInviteBranchId('');
      setInviteBranches([]);
    }
  }

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
    const query = search
      .toLowerCase()
      .trim();

    return users.filter((user) => {
      const matchesSearch =
        !query ||
        [
          user.full_name,
          user.common_name,
          user.email,
          user.phone,
          user.role_name,
          user.role_code,
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
  }, [
    users,
    search,
    roleFilter,
    statusFilter,
  ]);

  const activeUsers = users.filter(
    (user) => user.status === 'ACTIVE'
  ).length;

  const administratorUsers = users.filter(
    (user) =>
      [
        'SUPER_ADMIN',
        'ASOMAC_ADMIN',
        'COMPANY_ADMIN',
        'BRANCH_ADMIN',
      ].includes(user.role_code || '')
  ).length;

  const inactiveUsers = users.filter(
    (user) => user.status !== 'ACTIVE'
  ).length;

  const superAdmins = users.filter(
    (user) =>
      user.role_code === 'SUPER_ADMIN'
  ).length;

  function openUser(user: AdminUser) {
    setSelectedUser(user);
    setModalMode('view');
    setMessage('');
    setErrorMessage('');
  }

  function openEdit(user: AdminUser) {
    setSelectedUser(user);

    loadEditAccessOptions();

    setEditRoleId('');
    setEditCompanyId(user.company_id || '');
    setEditBranchId(user.branch_id || '');

    setEditFullName(
      user.full_name || ''
    );

    setEditPhone(
      user.phone || ''
    );

    setEditStatus(
      user.status || 'ACTIVE'
    );

    setModalMode('edit');
    setMessage('');
    setErrorMessage('');
  }

  function closeUserModal() {
    if (saving) return;

    setSelectedUser(null);
    setModalMode('view');
    setMessage('');
    setErrorMessage('');
  }

  async function loadEditAccessOptions() {
    const [{ data: rolesData }, { data: companiesData }] =
      await Promise.all([
        supabase
          .from('roles')
          .select('id, code, name, scope')
          .order('name'),
        supabase
          .from('companies')
          .select('id, name')
          .order('name'),
      ]);

    const loadedRoles =
      (rolesData || []) as {
        id: string;
        code: string;
        name: string;
        scope: string;
      }[];

    const loadedCompanies =
      (companiesData || []) as { id: string; name: string }[];

    setEditRoles(loadedRoles);
    setEditCompanies(loadedCompanies);

    const currentRole = loadedRoles.find(
      (role) => role.code === selectedUser?.role_code
    );

    setEditRoleId(currentRole?.id || '');
  }

  async function loadEditBranches(companyId: string) {
    if (!companyId) {
      setEditBranches([]);
      setEditBranchId('');
      return;
    }

    const { data, error } = await supabase
      .from('branches')
      .select('id, company_id, name')
      .eq('company_id', companyId)
      .order('name');

    if (error) {
      console.error(error);
      setEditBranches([]);
      setEditBranchId('');
      setErrorMessage(error.message || 'Unable to load branches.');
      return;
    }

    setEditBranches(
      (data || []) as {
        id: string;
        company_id: string;
        name: string;
      }[]
    );
  }

  function selectedEditRole() {
    return editRoles.find((role) => role.id === editRoleId) || null;
  }

  function handleEditRoleChange(roleId: string) {
    setEditRoleId(roleId);

    const role = editRoles.find((item) => item.id === roleId);
    const scope = role?.scope?.toUpperCase();

    if (scope === 'COMPANY' || scope === 'BRANCH') {
      setEditCompanyId(selectedUser?.company_id || '');
      if (selectedUser?.company_id) {
        loadEditBranches(selectedUser.company_id);
      }
    } else {
      setEditCompanyId('');
      setEditBranchId('');
      setEditBranches([]);
    }

    if (scope !== 'BRANCH') {
      setEditBranchId('');
    }
  }

  async function saveUserAccess() {
    if (!selectedUser) return;

    const role = selectedEditRole();

    if (!role) {
      setErrorMessage('Please select a valid role.');
      return;
    }

    const scope = role.scope?.toUpperCase();

    if ((scope === 'COMPANY' || scope === 'BRANCH') && !editCompanyId) {
      setErrorMessage('Please select a company for this role.');
      return;
    }

    if (scope === 'BRANCH' && !editBranchId) {
      setErrorMessage('Please select a branch for this role.');
      return;
    }

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase.rpc(
      'admin_update_user_access',
      {
        p_user_id: selectedUser.user_id,
        p_role_id: role.id,
        p_company_id:
          scope === 'COMPANY' || scope === 'BRANCH'
            ? editCompanyId
            : null,
        p_branch_id:
          scope === 'BRANCH'
            ? editBranchId
            : null,
      }
    );

    if (error) {
      console.error(error);
      setErrorMessage(
        error.message || 'Unable to update user role and scope.'
      );
      setSaving(false);
      return;
    }

    setMessage('User role and organizational scope updated successfully.');
    await loadUsers();
    setModalMode('view');
    setSaving(false);
  }

  async function deleteUser(user: AdminUser) {
    const name = user.common_name || user.full_name || user.email;

    const confirmed = window.confirm(
      'PERMANENT USER DELETION\\n\\n' +
      'This will permanently delete ' +
      name +
      ' (' +
      user.email +
      ') and their application account, profile and role assignments.\\n\\n' +
      'This action cannot be undone.\\n\\nContinue?'
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } = await supabase.rpc(
      'admin_delete_user',
      { p_user_id: user.user_id }
    );

    if (error) {
      console.error(error);
      setErrorMessage(
        error.message || 'Unable to delete this user.'
      );
      setSaving(false);
      return;
    }

    setSelectedUser(null);
    setModalMode('view');
    setMessage('User deleted successfully.');
    await loadUsers();
    setSaving(false);
  }

  async function saveUser() {
    if (!selectedUser) return;

    setSaving(true);
    setMessage('');
    setErrorMessage('');

    const { error } =
      await supabase.rpc(
        'admin_update_user_profile',
        {
          p_user_id:
            selectedUser.user_id,

          p_full_name:
            editFullName.trim() || null,

          p_phone:
            editPhone.trim() || null,

          p_status:
            editStatus,
        }
      );

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to update this user.'
      );

      setSaving(false);
      return;
    }

    setMessage(
      'User profile updated successfully.'
    );

    await loadUsers();

    const updatedUser =
      users.find(
        (user) =>
          user.user_id ===
          selectedUser.user_id
      );

    if (updatedUser) {
      setSelectedUser({
        ...updatedUser,
        full_name:
          editFullName.trim() || null,
        phone:
          editPhone.trim() || null,
        status:
          editStatus,
      });
    }

    setModalMode('view');
    setSaving(false);
  }

  async function changeStatus(
    user: AdminUser,
    status: string
  ) {
    const confirmed =
      window.confirm(
        `Are you sure you want to ${status === 'ACTIVE' ? 'activate' : 'suspend'} ${user.common_name || user.full_name || user.email}?`
      );

    if (!confirmed) return;

    setSaving(true);
    setErrorMessage('');
    setMessage('');

    const { error } =
      await supabase.rpc(
        'admin_update_user_profile',
        {
          p_user_id:
            user.user_id,

          p_full_name:
            user.full_name,

          p_phone:
            user.phone,

          p_status:
            status,
        }
      );

    if (error) {
      console.error(error);

      setErrorMessage(
        error.message ||
          'Unable to update user status.'
      );

      setSaving(false);
      return;
    }

    setMessage(
      `User ${status === 'ACTIVE' ? 'activated' : 'suspended'} successfully.`
    );

    await loadUsers();

    setSaving(false);
  }

  async function checkInviteEmail(showSuccess = true): Promise<boolean> {
    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setEmailCheck({
        status: 'invalid',
        message: 'Email address is required.',
      });
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailCheck({
        status: 'invalid',
        message: 'Enter a valid email address.',
      });
      return false;
    }

    const {
      data: sessionData,
    } = await supabase.auth.getSession();

    const accessToken =
      sessionData.session?.access_token;

    if (!accessToken) {
      setEmailCheck({
        status: 'invalid',
        message: 'Your session has expired. Please sign in again.',
      });
      return false;
    }

    setEmailChecking(true);
    setEmailCheck({
      status: 'checking',
      message: 'Checking email domain and mail server...',
    });

    try {
      const response = await fetch('/api/email/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (!response.ok || !result?.valid) {
        setEmailCheck({
          status: 'invalid',
          message:
            result?.reason ||
            'This email address could not be verified.',
        });
        return false;
      }

      setEmailCheck({
        status: 'valid',
        message:
          showSuccess
            ? (result.message || 'Email address verified.')
            : '',
      });

      return true;
    } catch (error) {
      console.error(error);
      setEmailCheck({
        status: 'invalid',
        message: 'Unable to check this email right now. Please try again.',
      });
      return false;
    } finally {
      setEmailChecking(false);
    }
  }

  async function submitInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setErrorMessage('');
    setGeneratedInvitation(null);

    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      setErrorMessage('Email address is required.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    const emailIsValid = await checkInviteEmail(false);

    if (!emailIsValid) {
      setErrorMessage(
        'Please correct the email address before sending the invitation.'
      );
      return;
    }

    if (!inviteRoles.length) {
      setErrorMessage(
        'No invitation roles are available. Please refresh the page and try again.'
      );
      return;
    }

    const selectedRole = inviteRoles.find(
      (role) => role.code === inviteRole
    );

    if (!inviteRole || !selectedRole) {
      setErrorMessage(
        'Please select a valid role from the available roles.'
      );
      return;
    }

    const roleScope = selectedRole.scope?.toUpperCase();

    if (roleScope === 'COMPANY' || roleScope === 'BRANCH') {
      if (!inviteCompanyId) {
        setErrorMessage(
          'Please select the company this user will belong to.'
        );
        return;
      }
    }

    if (roleScope === 'BRANCH') {
      if (!inviteBranchId) {
        setErrorMessage(
          'Please select the branch this user will belong to.'
        );
        return;
      }

      const selectedBranch = inviteBranches.find(
        (branch) => branch.id === inviteBranchId
      );

      if (!selectedBranch || selectedBranch.company_id !== inviteCompanyId) {
        setErrorMessage(
          'The selected branch does not belong to the selected company.'
        );
        return;
      }
    }

    setSaving(true);
    setMessage('Creating the secure invitation...');
    setErrorMessage('');

    const { data, error } = await supabase.rpc('create_user_invitation', {
      p_email: email,
      p_role_id: selectedRole.id,
      p_company_id:
        roleScope === 'COMPANY' || roleScope === 'BRANCH'
          ? inviteCompanyId
          : null,
      p_branch_id:
        roleScope === 'BRANCH'
          ? inviteBranchId
          : null,
      p_expires_in_hours: 168,
    });

    if (error) {
      console.error(error);
      setErrorMessage(error.message || 'Unable to create invitation.');
      setSaving(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.invitation_token) {
      setErrorMessage('Invitation was created but no token was returned.');
      setSaving(false);
      return;
    }

    const url = window.location.origin + '/accept-invitation?token=' + encodeURIComponent(result.invitation_token);

    setGeneratedInvitation({
      token: result.invitation_token,
      expiresAt: result.expires_at,
      url,
    });
    setMessage('Invitation created. Sending the invitation email...');

    const {
      data: sessionData,
    } = await supabase.auth.getSession();

    const accessToken =
      sessionData.session?.access_token;

    if (!accessToken) {
      setSaving(false);
      setErrorMessage(
        'Invitation was created, but your session is no longer available to send the email. Copy the invitation link below and send it manually.'
      );
      return;
    }

    const emailResponse =
      await fetch('/api/invitations/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          invitation_id: result.invitation_id,
          invitation_token: result.invitation_token,
        }),
      });

    if (!emailResponse.ok) {
      let details = 'Invitation was created, but the email could not be sent.';

      try {
        const emailResult = await emailResponse.json();
        if (emailResult?.error) {
          details = emailResult.error;
        }
      } catch {
        // Keep the safe fallback message.
      }

      setSaving(false);
      setErrorMessage(
        `${details} You can still copy the invitation link below.`
      );
      return;
    }

    setSaving(false);
    setMessage(
      'Invitation created and emailed successfully. The secure invitation link is also available below.'
    );
  }

  return (
    <div className="page-container users-page">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <div className="page-heading users-heading">

        <div>
          <div className="eyebrow">
            ADMINISTRATION
          </div>

          <h1>User Management</h1>

          <p>
            Manage ASOMAC users, administrators,
            roles, status and organizational
            placement.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={() =>
            setShowInviteModal(true)
          }
        >
          <span className="button-icon">
            +
          </span>

          Invite User
        </button>
      </div>

      {/* =====================================================
          GLOBAL MESSAGE
      ====================================================== */}

      {message && (
        <div className="users-message success">
          <span>✓</span>
          {message}
        </div>
      )}

      {errorMessage && (
        <div className="users-message error">
          <span>!</span>
          {errorMessage}
        </div>
      )}

      {/* =====================================================
          STATISTICS
      ====================================================== */}

      <div className="stats-grid users-stats">

        <div className="neumorphic-stat">
          <div className="stat-icon blue">
            👥
          </div>

          <div>
            <span>Total Users</span>
            <strong>
              {users.length}
            </strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon green">
            ✓
          </div>

          <div>
            <span>Active Users</span>
            <strong>
              {activeUsers}
            </strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon orange">
            🛡
          </div>

          <div>
            <span>Administrators</span>
            <strong>
              {administratorUsers}
            </strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon gray">
            ○
          </div>

          <div>
            <span>Inactive / Suspended</span>
            <strong>
              {inactiveUsers}
            </strong>
          </div>
        </div>

      </div>

      {/* =====================================================
          USER DIRECTORY
      ====================================================== */}

      <section className="content-card users-card">

        <div className="card-toolbar">

          <div>
            <h2>User Directory</h2>

            <p>
              Showing{' '}
              <strong>
                {filteredUsers.length}
              </strong>{' '}
              of{' '}
              <strong>
                {users.length}
              </strong>{' '}
              users
            </p>
          </div>

          <button
            type="button"
            className="secondary-button"
            onClick={() =>
              loadUsers(true)
            }
            disabled={refreshing}
          >
            {refreshing
              ? 'Refreshing...'
              : '↻ Refresh'}
          </button>

        </div>

        {/* =================================================
            FILTERS
        ================================================== */}

        <div className="filters">

          <div className="search-box">

            <span className="search-icon">
              ⌕
            </span>

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search users, email, company, branch..."
            />

            {search && (
              <button
                type="button"
                className="clear-search"
                onClick={() =>
                  setSearch('')
                }
              >
                ×
              </button>
            )}

          </div>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(
                event.target.value
              )
            }
          >
            <option value="ALL">
              All roles
            </option>

            {roles.map((role) => (
              <option
                key={role}
                value={role}
              >
                {roleLabel(role)}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value
              )
            }
          >
            <option value="ALL">
              All statuses
            </option>

            <option value="ACTIVE">
              Active
            </option>

            <option value="INACTIVE">
              Inactive
            </option>

            <option value="SUSPENDED">
              Suspended
            </option>
          </select>

        </div>

        {/* =================================================
            LOADING
        ================================================== */}

        {loading ? (
          <div className="loading-state">

            <div className="loading-spinner" />

            <span>
              Loading users...
            </span>

          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="empty-state">

            <div className="empty-icon">
              👥
            </div>

            <h3>
              No users found
            </h3>

            <p>
              {users.length === 0
                ? 'There are currently no users available in the directory.'
                : 'Try changing your search or filters.'}
            </p>

            {(search ||
              roleFilter !== 'ALL' ||
              statusFilter !== 'ALL') && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setSearch('');
                  setRoleFilter('ALL');
                  setStatusFilter('ALL');
                }}
              >
                Clear Filters
              </button>
            )}

          </div>
        ) : (
          <>
            {/* =============================================
                DESKTOP TABLE
            ============================================== */}

            <div className="users-table-wrapper">

              <table className="users-table">

                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th>Scope</th>
                    <th>Company</th>
                    <th>Branch</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>

                <tbody>

                  {filteredUsers.map(
                    (user) => {
                      const name =
                        user.common_name ||
                        user.full_name ||
                        'Unnamed User';

                      return (
                        <tr
                          key={
                            user.user_id
                          }
                        >

                          <td>
                            <div className="user-cell">

                              {user.avatar_url ? (
                                <img
                                  src={
                                    user.avatar_url
                                  }
                                  alt={name}
                                  className="table-avatar"
                                />
                              ) : (
                                <div className="table-avatar avatar-fallback">
                                  {initials(
                                    name
                                  )}
                                </div>
                              )}

                              <div className="user-details">

                                <strong>
                                  {name}
                                </strong>

                                {user.common_name &&
                                  user.full_name &&
                                  user.common_name !==
                                    user.full_name && (
                                    <span>
                                      {
                                        user.full_name
                                      }
                                    </span>
                                  )}

                                <small>
                                  {
                                    user.email
                                  }
                                </small>

                              </div>

                            </div>
                          </td>

                          <td>
                            <span
                              className={`role-badge ${roleClass(
                                user.role_code
                              )}`}
                            >
                              {roleLabel(
                                user.role_code
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="location-text">
                              {user.role_scope ||
                                '—'}
                            </span>
                          </td>

                          <td>
                            {user.company_name ||
                              '—'}
                          </td>

                          <td>
                            {user.branch_name ||
                              '—'}
                          </td>

                          <td>
                            <span
                              className={`status-badge ${statusClass(
                                user.status
                              )}`}
                            >
                              <span />
                              {statusLabel(
                                user.status
                              )}
                            </span>
                          </td>

                          <td>
                            <button
                              type="button"
                              className="table-action"
                              onClick={() =>
                                openUser(
                                  user
                                )
                              }
                            >
                              View
                            </button>
                          </td>

                        </tr>
                      );
                    }
                  )}

                </tbody>

              </table>

            </div>

            {/* =============================================
                MOBILE USER CARDS
            ============================================== */}

            <div className="mobile-users-list">

              {filteredUsers.map(
                (user) => {
                  const name =
                    user.common_name ||
                    user.full_name ||
                    'Unnamed User';

                  return (
                    <button
                      type="button"
                      className="mobile-user-card"
                      key={
                        user.user_id
                      }
                      onClick={() =>
                        openUser(
                          user
                        )
                      }
                    >

                      <div className="mobile-user-top">

                        {user.avatar_url ? (
                          <img
                            src={
                              user.avatar_url
                            }
                            alt={name}
                            className="table-avatar"
                          />
                        ) : (
                          <div className="table-avatar avatar-fallback">
                            {initials(
                              name
                            )}
                          </div>
                        )}

                        <div className="mobile-user-info">

                          <strong>
                            {name}
                          </strong>

                          <span>
                            {
                              user.email
                            }
                          </span>

                        </div>

                        <span
                          className={`status-badge ${statusClass(
                            user.status
                          )}`}
                        >
                          <span />
                          {statusLabel(
                            user.status
                          )}
                        </span>

                      </div>

                      <div className="mobile-user-meta">

                        <span>
                          <b>Role</b>
                          {roleLabel(
                            user.role_code
                          )}
                        </span>

                        <span>
                          <b>Company</b>
                          {user.company_name ||
                            'ASOMAC'}
                        </span>

                      </div>

                    </button>
                  );
                }
              )}

            </div>
          </>
        )}

      </section>

      {/* =====================================================
          USER DETAILS / EDIT MODAL
      ====================================================== */}

      {selectedUser && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeUserModal();
            }
          }}
        >

          <div className="modal-card large">

            <div className="modal-header">

              <div>
                <span className="modal-eyebrow">
                  USER MANAGEMENT
                </span>

                <h2>
                  {modalMode === 'edit'
                    ? 'Edit User'
                    : 'User Details'}
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={
                  closeUserModal
                }
                disabled={saving}
              >
                ×
              </button>

            </div>

            {/* =============================================
                PROFILE HEADER
            ============================================== */}

            <div className="user-profile-section">

              <div className="profile-avatar-large">

                {selectedUser.avatar_url ? (
                  <img
                    src={
                      selectedUser.avatar_url
                    }
                    alt=""
                  />
                ) : (
                  initials(
                    selectedUser.common_name ||
                      selectedUser.full_name ||
                      'User'
                  )
                )}

              </div>

              <div className="profile-main">

                <h3>
                  {selectedUser.common_name ||
                    selectedUser.full_name ||
                    'Unnamed User'}
                </h3>

                <p>
                  {selectedUser.email}
                </p>

                <div className="profile-badges">

                  <span
                    className={`role-badge ${roleClass(
                      selectedUser.role_code
                    )}`}
                  >
                    {roleLabel(
                      selectedUser.role_code
                    )}
                  </span>

                  <span
                    className={`status-badge ${statusClass(
                      selectedUser.status
                    )}`}
                  >
                    <span />
                    {statusLabel(
                      selectedUser.status
                    )}
                  </span>

                </div>

              </div>

            </div>

            {/* =============================================
                VIEW MODE
            ============================================== */}

            {modalMode === 'view' && (
              <div className="user-detail-grid">

                <div className="detail-item">
                  <span>
                    Full Legal Name
                  </span>
                  <strong>
                    {selectedUser.full_name ||
                      '—'}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Common Name
                  </span>
                  <strong>
                    {selectedUser.common_name ||
                      '—'}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Email Address
                  </span>
                  <strong>
                    {selectedUser.email}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Phone Number
                  </span>
                  <strong>
                    {selectedUser.phone ||
                      '—'}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Role
                  </span>
                  <strong>
                    {roleLabel(
                      selectedUser.role_code
                    )}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Scope
                  </span>
                  <strong>
                    {selectedUser.role_scope ||
                      '—'}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Company
                  </span>
                  <strong>
                    {selectedUser.company_name ||
                      'Not assigned'}
                  </strong>
                </div>

                <div className="detail-item">
                  <span>
                    Branch
                  </span>
                  <strong>
                    {selectedUser.branch_name ||
                      'Not assigned'}
                  </strong>
                </div>

              </div>
            )}

            {/* =============================================
                EDIT MODE
            ============================================== */}

            {modalMode === 'edit' && (
              <div className="edit-user-form">

                <div className="form-section-title">
                  Personal Information
                </div>

                <div className="form-grid">

                  <div className="form-field">

                    <label>
                      Full Legal Name
                    </label>

                    <input
                      value={
                        editFullName
                      }
                      onChange={(event) =>
                        setEditFullName(
                          event.target
                            .value
                        )
                      }
                      placeholder="Full legal name"
                    />

                  </div>

                  <div className="form-field">

                    <label>
                      Phone Number
                    </label>

                    <input
                      value={
                        editPhone
                      }
                      onChange={(event) =>
                        setEditPhone(
                          event.target
                            .value
                        )
                      }
                      placeholder="+256..."
                    />

                  </div>

                </div>

                <div className="form-section-title">
                  Account Control
                </div>

                <div className="form-grid">

                  <div className="form-field">

                    <label>
                      Email Address
                    </label>

                    <input
                      value={
                        selectedUser.email
                      }
                      disabled
                      readOnly
                    />

                    <small>
                      Email changes require
                      a separate verification
                      workflow.
                    </small>

                  </div>

                  <div className="form-field">

                    <label>
                      Account Status
                    </label>

                    <select
                      value={
                        editStatus
                      }
                      onChange={(event) =>
                        setEditStatus(
                          event.target
                            .value
                        )
                      }
                    >
                      <option value="ACTIVE">
                        Active
                      </option>

                      <option value="INACTIVE">
                        Inactive
                      </option>

                      <option value="SUSPENDED">
                        Suspended
                      </option>
                    </select>

                  </div>

                </div>

                <div className="form-section-title">
                  Role & Organizational Access
                </div>

                <div className="form-grid">

                  <div className="form-field">
                    <label>Role</label>

                    <select
                      value={editRoleId}
                      onChange={(event) =>
                        handleEditRoleChange(event.target.value)
                      }
                    >
                      <option value="">
                        Select role
                      </option>

                      {editRoles.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-field">
                    <label>Scope</label>

                    <input
                      value={selectedEditRole()?.scope || '—'}
                      disabled
                      readOnly
                    />
                  </div>

                </div>

                {(selectedEditRole()?.scope === 'COMPANY' ||
                  selectedEditRole()?.scope === 'BRANCH') && (
                  <div className="form-grid">

                    <div className="form-field">
                      <label>Company</label>

                      <select
                        value={editCompanyId}
                        onChange={(event) => {
                          const companyId = event.target.value;
                          setEditCompanyId(companyId);
                          setEditBranchId('');

                          if (
                            selectedEditRole()?.scope === 'BRANCH'
                          ) {
                            loadEditBranches(companyId);
                          } else {
                            setEditBranches([]);
                          }
                        }}
                      >
                        <option value="">
                          Select company
                        </option>

                        {editCompanies.map((company) => (
                          <option key={company.id} value={company.id}>
                            {company.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedEditRole()?.scope === 'BRANCH' && (
                      <div className="form-field">
                        <label>Branch</label>

                        <select
                          value={editBranchId}
                          onChange={(event) =>
                            setEditBranchId(event.target.value)
                          }
                          disabled={!editCompanyId}
                        >
                          <option value="">
                            Select branch
                          </option>

                          {editBranches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                  </div>
                )}

                <div className="permission-notice">
                  <div>
                    🔐
                  </div>

                  <div>
                    <strong>
                      Super Administrator control
                    </strong>

                    <p>
                      Changing a role replaces the user's active role
                      assignment. Company and branch scope is validated
                      again by the database before the change is accepted.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* =============================================
                MODAL ACTIONS
            ============================================== */}

            <div className="modal-actions">

              {modalMode === 'view' ? (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      openEdit(
                        selectedUser
                      )
                    }
                  >
                    Edit User
                  </button>

                  {selectedUser.status ===
                  'ACTIVE' ? (
                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        changeStatus(
                          selectedUser,
                          'SUSPENDED'
                        )
                      }
                      disabled={saving}
                    >
                      Suspend User
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() =>
                        changeStatus(
                          selectedUser,
                          'ACTIVE'
                        )
                      }
                      disabled={saving}
                    >
                      Activate User
                    </button>
                  )}

                  <button
                    type="button"
                    className="danger-button"
                    onClick={() =>
                      deleteUser(selectedUser)
                    }
                    disabled={saving}
                  >
                    Delete User
                  </button>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={
                      closeUserModal
                    }
                  >
                    Close
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() =>
                      setModalMode('view')
                    }
                    disabled={saving}
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={saveUser}
                    disabled={saving}
                  >
                    {saving
                      ? 'Saving...'
                      : 'Save Profile'}
                  </button>

                  <button
                    type="button"
                    className="primary-button"
                    onClick={saveUserAccess}
                    disabled={saving}
                  >
                    {saving
                      ? 'Saving...'
                      : 'Save Access'}
                  </button>
                </>
              )}

            </div>

          </div>
        </div>
      )}

      {/* =====================================================
          INVITE USER MODAL
      ====================================================== */}

      {showInviteModal && (
        <div
          className="modal-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !saving
            ) {
              setShowInviteModal(
                false
              );
            }
          }}
        >

          <div className="modal-card">

            <div className="modal-header">

              <div>
                <span className="modal-eyebrow">
                  ADMINISTRATION
                </span>

                <h2>
                  Invite User
                </h2>
              </div>

              <button
                type="button"
                className="modal-close"
                onClick={() =>
                  setShowInviteModal(
                    false
                  )
                }
                disabled={saving}
              >
                ×
              </button>

            </div>

            <div className="invite-intro">

              <div className="invite-icon">
                ✉
              </div>

              <div>
                <strong>
                  Send an ASOMAC invitation
                </strong>

                <p>
                  The user will receive an
                  invitation to complete
                  their account setup.
                </p>
              </div>

            </div>

            <form
              onSubmit={
                submitInvitation
              }
            >

              <div className="form-grid">

                <div className="form-field">

                  <label>
                    Common Name
                  </label>

                  <input
                    value={
                      inviteName
                    }
                    onChange={(event) =>
                      setInviteName(
                        event.target
                          .value
                      )
                    }
                    placeholder="Preferred display name"
                  />

                </div>

                <div className="form-field">

                  <label>
                    Email Address *
                  </label>

                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(event) => {
                      setInviteEmail(event.target.value);
                      setEmailCheck({
                        status: 'idle',
                        message: '',
                      });
                    }}
                    onBlur={() => {
                      if (inviteEmail.trim()) {
                        void checkInviteEmail();
                      }
                    }}
                    placeholder="name@example.com"
                    required
                    disabled={saving || emailChecking}
                  />

                  {emailCheck.message && (
                    <small
                      style={{
                        color:
                          emailCheck.status === 'valid'
                            ? '#248044'
                            : emailCheck.status === 'invalid'
                              ? '#bd392e'
                              : '#66748a',
                        fontWeight: 600,
                      }}
                    >
                      {emailChecking ? '⏳ ' : emailCheck.status === 'valid' ? '✓ ' : emailCheck.status === 'invalid' ? '!' : ''}
                      {emailCheck.message}
                    </small>
                  )}

                </div>

                <div className="form-field">

                  <label>
                    Phone Number
                  </label>

                  <input
                    value={
                      invitePhone
                    }
                    onChange={(event) =>
                      setInvitePhone(
                        event.target
                          .value
                      )
                    }
                    placeholder="+256..."
                  />

                </div>

                <div className="form-field">

                  <label>
                    Initial Role
                  </label>

                  <select
                    value={inviteRole}
                    onChange={(event) =>
                      handleInviteRoleChange(event.target.value)
                    }
                    required
                    disabled={!inviteRoles.length || saving}
                  >
                    <option value="" disabled>
                      {inviteRoles.length
                        ? 'Select a role'
                        : 'Loading roles...'}
                    </option>

                    {inviteRoles.map((role) => (
                      <option
                        key={role.id}
                        value={role.code}
                      >
                        {role.name}
                      </option>
                    ))}
                  </select>

                </div>

                {inviteRoleNeedsCompany() && (
                  <div className="form-field">
                    <label>
                      Company *
                    </label>

                    <select
                      value={inviteCompanyId}
                      onChange={async (event) => {
                        const companyId = event.target.value;
                        setInviteCompanyId(companyId);
                        setInviteBranchId('');

                        if (inviteRoleNeedsBranch()) {
                          await loadInviteBranches(companyId);
                        } else {
                          setInviteBranches([]);
                        }
                      }}
                      required
                      disabled={saving || !inviteCompanies.length}
                    >
                      <option value="">
                        {inviteCompanies.length
                          ? 'Select company'
                          : 'No companies available'}
                      </option>

                      {inviteCompanies.map((company) => (
                        <option
                          key={company.id}
                          value={company.id}
                        >
                          {company.name}
                        </option>
                      ))}
                    </select>

                    <small>
                      This company assignment is enforced by the database.
                    </small>
                  </div>
                )}

                {inviteRoleNeedsBranch() && (
                  <div className="form-field">
                    <label>
                      Branch *
                    </label>

                    <select
                      value={inviteBranchId}
                      onChange={(event) =>
                        setInviteBranchId(event.target.value)
                      }
                      required
                      disabled={
                        saving ||
                        !inviteCompanyId ||
                        !inviteBranches.length
                      }
                    >
                      <option value="">
                        {!inviteCompanyId
                          ? 'Select a company first'
                          : inviteBranches.length
                            ? 'Select branch'
                            : 'No branches available'}
                      </option>

                      {inviteBranches.map((branch) => (
                        <option
                          key={branch.id}
                          value={branch.id}
                        >
                          {branch.name}
                        </option>
                      ))}
                    </select>

                    <small>
                      The branch must belong to the selected company.
                    </small>
                  </div>
                )}

              </div>

              <div className="permission-notice">

                <div>
                  🔐
                </div>

                <div>
                  <strong>
                    Secure account creation
                  </strong>

                  <p>
                    User accounts are created
                    through Supabase
                    authentication. The final
                    invitation RPC will enforce
                    administrator permissions,
                    role scope and company/branch
                    assignments at the database level.
                  </p>
                </div>

              </div>

              {generatedInvitation && (
          <div className="generated-invitation">
            <strong>Invitation link generated</strong>
            <p>Send this link to the invited user. It expires on {new Date(generatedInvitation.expiresAt).toLocaleString()}.</p>
            <div className="invitation-link-row">
              <input value={generatedInvitation.url} readOnly />
              <button
                type="button"
                className="secondary-button"
                onClick={async () => {
                  await navigator.clipboard.writeText(generatedInvitation.url);
                  setMessage('Invitation link copied to clipboard.');
                }}
              >
                Copy Link
              </button>
            </div>
            <small>The raw token is never stored in Supabase. This link contains the one-time token returned at creation.</small>
          </div>
        )}

        <div className="modal-actions">

                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    setShowInviteModal(
                      false
                    )
                  }
                  disabled={saving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="primary-button"
                  disabled={
                    saving ||
                    emailChecking ||
                    !inviteRole ||
                    !inviteRoles.some((role) => role.code === inviteRole) ||
                    (inviteRoleNeedsCompany() && !inviteCompanyId) ||
                    (inviteRoleNeedsBranch() && !inviteBranchId)
                  }
                >
                  {saving
                    ? 'Sending Invitation...'
                    : emailChecking
                      ? 'Checking Email...'
                      : 'Send Invitation'}
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

      {/* =====================================================
          PAGE-SPECIFIC STYLES
      ====================================================== */}

      <style>{`
        .users-page {
          width: 100%;
        }

        .users-heading {
          margin-bottom: 24px;
        }

        .users-heading h1 {
          margin-bottom: 7px;
        }

        .users-heading p {
          max-width: 760px;
        }

        .button-icon {
          font-size: 21px;
          line-height: 1;
          margin-right: 5px;
        }

        .users-message {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 13px 16px;
          margin-bottom: 20px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
        }

        .users-message.success {
          background: #edf9f1;
          color: #16733a;
          border: 1px solid #ccebd7;
        }

        .users-message.error {
          background: #fff0ef;
          color: #b3261e;
          border: 1px solid #f4cdca;
        }

        .users-stats {
          margin-bottom: 24px;
        }

        .users-card {
          overflow: hidden;
        }

        .card-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 18px;
          margin-bottom: 22px;
        }

        .card-toolbar h2 {
          margin: 0 0 5px;
        }

        .card-toolbar p {
          margin: 0;
        }

        .filters {
          display: grid;
          grid-template-columns: minmax(260px, 1fr) 190px 190px;
          gap: 12px;
          margin-bottom: 20px;
        }

        .search-box {
          min-width: 0;
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-box input {
          width: 100%;
          padding-left: 43px;
          padding-right: 40px;
        }

        .search-icon {
          position: absolute;
          left: 15px;
          z-index: 2;
          font-size: 22px;
          color: #68758a;
          pointer-events: none;
        }

        .clear-search {
          position: absolute;
          right: 9px;
          width: 30px;
          height: 30px;
          border: 0;
          background: transparent;
          color: #647084;
          font-size: 22px;
          cursor: pointer;
          border-radius: 8px;
        }

        .clear-search:hover {
          background: #edf1f6;
        }

        .filters select,
        .filters input {
          min-height: 46px;
          border: 0;
          outline: none;
          border-radius: 13px;
          background: #f2f5f9;
          box-shadow:
            inset 2px 2px 5px rgba(0, 25, 76, 0.08),
            inset -2px -2px 5px rgba(255, 255, 255, 0.9);
          color: #17243b;
          font-size: 14px;
        }

        .filters select {
          padding: 0 14px;
        }

        .filters input::placeholder {
          color: #8b96a7;
        }

        .users-table-wrapper {
          width: 100%;
          overflow-x: auto;
          border-radius: 15px;
        }

        .users-table {
          width: 100%;
          min-width: 920px;
          border-collapse: separate;
          border-spacing: 0;
        }

        .users-table th {
          padding: 13px 14px;
          text-align: left;
          font-size: 11px;
          letter-spacing: 0.07em;
          text-transform: uppercase;
          color: #7a8699;
          background: #f6f8fb;
          border-bottom: 1px solid #e6ebf2;
          white-space: nowrap;
        }

        .users-table td {
          padding: 15px 14px;
          border-bottom: 1px solid #edf0f4;
          color: #26344a;
          font-size: 13px;
          vertical-align: middle;
        }

        .users-table tbody tr {
          transition: background 0.18s ease;
        }

        .users-table tbody tr:hover {
          background: #fafbfd;
        }

        .users-table tbody tr:last-child td {
          border-bottom: 0;
        }

        .user-cell {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 230px;
        }

        .table-avatar {
          width: 42px;
          height: 42px;
          min-width: 42px;
          border-radius: 13px;
          object-fit: cover;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 13px;
          color: #ffffff;
          background: #00194c;
          box-shadow:
            4px 4px 10px rgba(0, 25, 76, 0.12),
            -3px -3px 8px rgba(255, 255, 255, 0.95);
        }

        .user-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .user-details strong {
          color: #17243b;
          font-size: 14px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 230px;
        }

        .user-details span {
          color: #66748a;
          font-size: 11px;
        }

        .user-details small {
          color: #8994a5;
          font-size: 11px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 230px;
        }

        .role-badge {
          display: inline-flex;
          align-items: center;
          padding: 6px 9px;
          border-radius: 8px;
          background: #eef2f7;
          color: #44516a;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .role-badge.super-admin {
          background: #e9edf8;
          color: #00194c;
        }

        .role-badge.asomac-admin {
          background: #fff0e8;
          color: #c34a00;
        }

        .role-badge.company-admin {
          background: #eef7ef;
          color: #28763b;
        }

        .role-badge.branch-admin {
          background: #f2effa;
          color: #62459a;
        }

        .location-text {
          color: #6f7c90;
          font-size: 12px;
        }

        .status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 9px;
          border-radius: 8px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
        }

        .status-badge > span {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          display: block;
          background: currentColor;
        }

        .status-badge.active {
          background: #edf8f0;
          color: #248044;
        }

        .status-badge.inactive {
          background: #f0f2f5;
          color: #6e7785;
        }

        .status-badge.suspended {
          background: #fff0ed;
          color: #c23d30;
        }

        .table-action {
          border: 0;
          background: transparent;
          color: #00194c;
          font-weight: 700;
          font-size: 12px;
          padding: 8px 9px;
          border-radius: 8px;
          cursor: pointer;
        }

        .table-action:hover {
          background: #eef2f8;
        }

        .loading-state,
        .empty-state {
          min-height: 270px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-direction: column;
          text-align: center;
          padding: 40px 20px;
        }

        .loading-state {
          gap: 12px;
          color: #6f7b8e;
        }

        .loading-spinner {
          width: 31px;
          height: 31px;
          border-radius: 50%;
          border: 3px solid #e1e7ef;
          border-top-color: #f35a02;
          animation: usersSpin 0.8s linear infinite;
        }

        @keyframes usersSpin {
          to {
            transform: rotate(360deg);
          }
        }

        .empty-icon {
          width: 58px;
          height: 58px;
          border-radius: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f0f3f8;
          font-size: 26px;
          margin-bottom: 13px;
        }

        .empty-state h3 {
          margin: 0 0 6px;
          color: #1a2940;
        }

        .empty-state p {
          margin: 0 0 18px;
          color: #7c8799;
          font-size: 13px;
        }

        .mobile-users-list {
          display: none;
        }

        .modal-overlay {
          position: fixed;
          inset: 0;
          z-index: 1000;
          padding: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(0, 25, 76, 0.42);
          backdrop-filter: blur(7px);
          -webkit-backdrop-filter: blur(7px);
        }

        .modal-card {
          width: min(620px, 100%);
          max-height: calc(100vh - 48px);
          overflow-y: auto;
          background: #f4f7fb;
          border-radius: 24px;
          padding: 25px;
          box-shadow:
            18px 18px 45px rgba(0, 25, 76, 0.22),
            -12px -12px 35px rgba(255, 255, 255, 0.95);
        }

        .modal-card.large {
          width: min(760px, 100%);
        }

        .modal-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 20px;
          margin-bottom: 23px;
        }

        .modal-eyebrow {
          display: block;
          margin-bottom: 5px;
          color: #f35a02;
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 0.12em;
        }

        .modal-header h2 {
          margin: 0;
          color: #00194c;
          font-size: 23px;
        }

        .modal-close {
          width: 36px;
          height: 36px;
          border: 0;
          border-radius: 11px;
          background: #edf1f6;
          color: #59677b;
          font-size: 21px;
          cursor: pointer;
          box-shadow:
            3px 3px 7px rgba(0, 25, 76, 0.08),
            -3px -3px 7px rgba(255, 255, 255, 0.9);
        }

        .modal-close:hover {
          color: #00194c;
        }

        .user-profile-section {
          display: flex;
          align-items: center;
          gap: 17px;
          padding: 18px;
          margin-bottom: 22px;
          border-radius: 17px;
          background: #eef2f7;
          box-shadow:
            inset 2px 2px 5px rgba(0, 25, 76, 0.06),
            inset -2px -2px 5px rgba(255, 255, 255, 0.9);
        }

        .profile-avatar-large {
          width: 68px;
          height: 68px;
          min-width: 68px;
          border-radius: 20px;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #00194c;
          color: #ffffff;
          font-weight: 800;
          font-size: 20px;
        }

        .profile-avatar-large img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .profile-main {
          min-width: 0;
        }

        .profile-main h3 {
          margin: 0 0 4px;
          color: #17243b;
          font-size: 18px;
        }

        .profile-main p {
          margin: 0 0 9px;
          color: #788498;
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .profile-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 7px;
        }

        .user-detail-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .detail-item {
          padding: 14px;
          border-radius: 13px;
          background: #ffffff;
          border: 1px solid #e8edf3;
        }

        .detail-item span {
          display: block;
          margin-bottom: 5px;
          color: #8a95a6;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        .detail-item strong {
          display: block;
          color: #26344a;
          font-size: 13px;
          word-break: break-word;
        }

        .form-section-title {
          margin: 20px 0 11px;
          color: #00194c;
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .form-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 14px;
        }

        .form-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-field label {
          color: #526078;
          font-size: 12px;
          font-weight: 700;
        }

        .form-field input,
        .form-field select {
          width: 100%;
          min-height: 45px;
          padding: 0 13px;
          border: 1px solid #e0e6ee;
          outline: none;
          border-radius: 11px;
          background: #ffffff;
          color: #1d2b42;
          font-size: 13px;
          box-sizing: border-box;
        }

        .form-field input:focus,
        .form-field select:focus {
          border-color: #f35a02;
          box-shadow: 0 0 0 3px rgba(243, 90, 2, 0.1);
        }

        .form-field input:disabled {
          background: #edf1f5;
          color: #7d8796;
          cursor: not-allowed;
        }

        .form-field small {
          color: #8b96a7;
          font-size: 10px;
          line-height: 1.4;
        }

        .permission-notice {
          display: flex;
          gap: 11px;
          align-items: flex-start;
          margin-top: 17px;
          padding: 13px;
          border-radius: 12px;
          background: #eef3fa;
          color: #536177;
        }

        .permission-notice > div:first-child {
          font-size: 17px;
        }

        .permission-notice strong {
          display: block;
          color: #26344a;
          font-size: 12px;
          margin-bottom: 3px;
        }

        .permission-notice p {
          margin: 0;
          color: #728096;
          font-size: 11px;
          line-height: 1.5;
        }

        .invite-intro {
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 20px;
          padding: 14px;
          border-radius: 14px;
          background: #fff2eb;
        }

        .invite-icon {
          width: 40px;
          height: 40px;
          min-width: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
          background: #f35a02;
          color: #ffffff;
          font-size: 18px;
        }

        .invite-intro strong {
          display: block;
          color: #27364d;
          font-size: 13px;
          margin-bottom: 3px;
        }

        .invite-intro p {
          margin: 0;
          color: #7d899b;
          font-size: 11px;
          line-height: 1.4;
        }

        .modal-actions {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          flex-wrap: wrap;
          gap: 9px;
          margin-top: 25px;
          padding-top: 18px;
          border-top: 1px solid #e1e7ee;
        }

        .danger-button {
          min-height: 42px;
          padding: 0 15px;
          border: 0;
          border-radius: 11px;
          background: #fff0ee;
          color: #bd392e;
          font-weight: 700;
          font-size: 12px;
          cursor: pointer;
        }

        .danger-button:hover {
          background: #ffe3df;
        }

        .primary-button:disabled,
        .secondary-button:disabled,
        .danger-button:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .generated-invitation {
          margin-top: 18px;
          padding: 15px;
          border-radius: 14px;
          background: #edf8f1;
          border: 1px solid #cde9d7;
        }

        .generated-invitation strong {
          display: block;
          color: #176b35;
          font-size: 13px;
          margin-bottom: 5px;
        }

        .generated-invitation p,
        .generated-invitation small {
          display: block;
          color: #647a6b;
          font-size: 11px;
          line-height: 1.5;
        }

        .generated-invitation p { margin: 0 0 10px; }
        .generated-invitation small { margin-top: 8px; }

        .invitation-link-row {
          display: flex;
          gap: 8px;
        }

        .invitation-link-row input {
          flex: 1;
          min-width: 0;
          min-height: 42px;
          padding: 0 10px;
          border: 1px solid #d9e6dd;
          border-radius: 10px;
          background: #fff;
          color: #26344a;
          font-size: 11px;
        }

        @media (max-width: 1000px) {
          .filters {
            grid-template-columns: 1fr 1fr;
          }

          .search-box {
            grid-column: 1 / -1;
          }
        }

        @media (max-width: 760px) {
          .users-heading {
            align-items: flex-start;
          }

          .users-heading .primary-button {
            width: 100%;
          }

          .card-toolbar {
            align-items: flex-start;
          }

          .filters {
            grid-template-columns: 1fr;
          }

          .search-box {
            grid-column: auto;
          }

          .users-table-wrapper {
            display: none;
          }

          .mobile-users-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
          }

          .mobile-user-card {
            width: 100%;
            border: 0;
            text-align: left;
            padding: 14px;
            border-radius: 15px;
            background: #f7f9fc;
            box-shadow:
              3px 3px 8px rgba(0, 25, 76, 0.07),
              -3px -3px 8px rgba(255, 255, 255, 0.9);
            cursor: pointer;
          }

          .mobile-user-top {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .mobile-user-info {
            flex: 1;
            min-width: 0;
            display: flex;
            flex-direction: column;
            gap: 3px;
          }

          .mobile-user-info strong {
            color: #17243b;
            font-size: 13px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .mobile-user-info span {
            color: #7d899b;
            font-size: 10px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .mobile-user-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px;
            margin-top: 13px;
            padding-top: 11px;
            border-top: 1px solid #e7ecf2;
          }

          .mobile-user-meta span {
            display: flex;
            flex-direction: column;
            gap: 3px;
            color: #526078;
            font-size: 11px;
          }

          .mobile-user-meta b {
            color: #9aa4b3;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .user-detail-grid,
          .form-grid {
            grid-template-columns: 1fr;
          }

          .modal-overlay {
            padding: 12px;
            align-items: flex-end;
          }

          .modal-card,
          .modal-card.large {
            width: 100%;
            max-height: calc(100vh - 24px);
            border-radius: 21px;
            padding: 19px;
          }

          .modal-actions {
            justify-content: stretch;
          }

          .modal-actions button {
            flex: 1;
            min-width: 120px;
          }
        }

        @media (max-width: 480px) {
          .users-stats {
            grid-template-columns: 1fr 1fr;
          }

          .neumorphic-stat {
            padding: 13px;
          }

          .stat-icon {
            width: 35px;
            height: 35px;
            min-width: 35px;
          }

          .card-toolbar {
            flex-direction: column;
          }

          .card-toolbar .secondary-button {
            width: 100%;
          }

          .user-profile-section {
            align-items: flex-start;
          }

          .profile-avatar-large {
            width: 55px;
            height: 55px;
            min-width: 55px;
            border-radius: 16px;
            font-size: 16px;
          }

          .modal-actions {
            flex-direction: column-reverse;
          }

          .modal-actions button {
            width: 100%;
          }
        }
      `}</style>

    </div>
  );
}
