import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type RecordStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'CLOSED';

type Company = {
  id: string;
  name: string;
  registration_number?: string | null;
  allow_asomac_branch_visibility?: boolean;
  status: RecordStatus;
};

type Branch = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  location: string | null;
  phone: string | null;
  email: string | null;
  status: RecordStatus;
  created_at: string;
  updated_at: string;
};

type RoleRow = {
  company_id: string | null;
  branch_id: string | null;
  roles: { code: string } | { code: string }[] | null;
};

const emptyForm = {
  name: '',
  address: '',
  location: '',
  phone: '',
  email: '',
  status: 'ACTIVE' as RecordStatus,
};

function roleCode(row: RoleRow) {
  if (!row.roles) return '';
  return Array.isArray(row.roles) ? row.roles[0]?.code || '' : row.roles.code;
}

export default function Branches() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [companyAdminCompanyId, setCompanyAdminCompanyId] = useState('');
  const [isAsomacAdmin, setIsAsomacAdmin] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | RecordStatus>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [form, setForm] = useState(emptyForm);

  const selectedCompany = useMemo(
    () => companies.find((company) => company.id === selectedCompanyId) || null,
    [companies, selectedCompanyId],
  );

  const canManageBranches = Boolean(companyAdminCompanyId && selectedCompanyId === companyAdminCompanyId);

  async function loadAccess() {
    setLoading(true);
    setError('');

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError('Your session could not be loaded. Please sign in again.');
      setLoading(false);
      return;
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('company_id, branch_id, roles!inner(code)')
      .eq('user_id', userData.user.id)
      .is('ended_at', null);

    if (rolesError) {
      setError(rolesError.message);
      setLoading(false);
      return;
    }

    const rows = (roles || []) as RoleRow[];
    const codes = rows.map(roleCode);

    const superAdmin = codes.includes('SUPER_ADMIN');
    const asomacAdmin = superAdmin || codes.includes('ASSOMAC_ADMIN');
    const companyAdmin = rows.find((row) => roleCode(row) === 'COMPANY_ADMIN' && row.company_id);

    setIsSuperAdmin(superAdmin);
    setIsAsomacAdmin(asomacAdmin);
    setCompanyAdminCompanyId(companyAdmin?.company_id || '');

    const { data: companyData, error: companyError } = await supabase.rpc(
      'list_manageable_companies_for_branches',
    );

    if (companyError) {
      setError(companyError.message);
      setLoading(false);
      return;
    }

    const nextCompanies = (companyData || []) as Company[];
    setCompanies(nextCompanies);

    const preferredCompanyId =
      companyAdmin?.company_id ||
      (nextCompanies.length === 1 ? nextCompanies[0].id : '');

    setSelectedCompanyId(preferredCompanyId);
    setLoading(false);
  }

  async function loadBranches(companyId: string) {
    if (!companyId) {
      setBranches([]);
      return;
    }

    setBranchesLoading(true);
    setError('');

    const { data, error: branchError } = await supabase
      .from('branches')
      .select('id,company_id,name,address,location,phone,email,status,created_at,updated_at')
      .eq('company_id', companyId)
      .order('name');

    if (branchError) {
      setError(branchError.message);
      setBranches([]);
    } else {
      setBranches((data || []) as Branch[]);
    }

    setBranchesLoading(false);
  }

  useEffect(() => {
    loadAccess();
  }, []);

  useEffect(() => {
    if (!selectedCompanyId) {
      setBranches([]);
      return;
    }
    loadBranches(selectedCompanyId);
  }, [selectedCompanyId]);

  function openCreate() {
    setEditingBranch(null);
    setForm(emptyForm);
    setError('');
    setMessage('');
    setModalOpen(true);
  }

  function openEdit(branch: Branch) {
    setEditingBranch(branch);
    setForm({
      name: branch.name || '',
      address: branch.address || '',
      location: branch.location || '',
      phone: branch.phone || '',
      email: branch.email || '',
      status: branch.status || 'ACTIVE',
    });
    setError('');
    setMessage('');
    setModalOpen(true);
  }

  async function saveBranch(event: React.FormEvent) {
    event.preventDefault();

    if (!selectedCompanyId || !canManageBranches) {
      setError('Only the assigned Company Administrator can maintain this company\'s branches.');
      return;
    }

    if (!form.name.trim()) {
      setError('Branch name is required.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    const rpcName = editingBranch ? 'update_company_branch' : 'create_company_branch';
    const args = editingBranch
      ? {
          p_branch_id: editingBranch.id,
          p_name: form.name.trim(),
          p_address: form.address.trim() || null,
          p_location: form.location.trim() || null,
          p_phone: form.phone.trim() || null,
          p_email: form.email.trim() || null,
          p_status: form.status,
        }
      : {
          p_company_id: selectedCompanyId,
          p_name: form.name.trim(),
          p_address: form.address.trim() || null,
          p_location: form.location.trim() || null,
          p_phone: form.phone.trim() || null,
          p_email: form.email.trim() || null,
          p_status: form.status,
        };

    const { error: saveError } = await supabase.rpc(rpcName, args);

    if (saveError) {
      setError(saveError.message);
      setSaving(false);
      return;
    }

    setSaving(false);
    setModalOpen(false);
    setMessage(editingBranch ? 'Branch updated successfully.' : 'Branch created successfully.');
    await loadBranches(selectedCompanyId);
  }

  async function deactivateBranch(branch: Branch) {
    if (!canManageBranches) return;

    const confirmed = window.confirm(
      `Deactivate "${branch.name}"? It will remain in the historical record but will no longer be an active branch.`,
    );

    if (!confirmed) return;

    setError('');
    setMessage('');

    const { error: deactivateError } = await supabase.rpc(
      'deactivate_company_branch',
      { p_branch_id: branch.id },
    );

    if (deactivateError) {
      setError(deactivateError.message);
      return;
    }

    setMessage('Branch deactivated successfully.');
    await loadBranches(selectedCompanyId);
  }

  const filteredBranches = useMemo(() => {
    const query = search.trim().toLowerCase();

    return branches.filter((branch) => {
      const matchesSearch =
        !query ||
        [branch.name, branch.address, branch.location, branch.phone, branch.email]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));

      const matchesStatus =
        statusFilter === 'ALL' || branch.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [branches, search, statusFilter]);

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>Loading branch management...</span>
        </div>
      </div>
    );
  }

  if (!isAsomacAdmin && !companyAdminCompanyId) {
    return (
      <div className="page-container">
        <div className="page-heading">
          <div>
            <div className="eyebrow">ASOMAC PLATFORM</div>
            <h1>Branches</h1>
            <p>Your account is not assigned a company branch-management role.</p>
          </div>
        </div>
        <div className="content-card placeholder-card">
          <div className="placeholder-icon">⌂</div>
          <h2>Branch access is not assigned</h2>
          <p>
            A Company Administrator manages branches for their company.
            ASOMAC administrators can view branch information only where the
            company has granted branch visibility.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ORGANISATION HIERARCHY</div>
          <h1>Branches</h1>
          <p>
            Manage company branches securely. Company Administrators can create,
            edit and deactivate branches for their own company. ASOMAC visibility
            follows each company&apos;s branch-information consent.
          </p>
        </div>

        {canManageBranches && (
          <button className="primary-button" onClick={openCreate}>
            + Add Branch
          </button>
        )}
      </div>

      {error && (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#fff0ee',
            color: '#b83429',
            border: '1px solid #ffd9d4',
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {message && (
        <div
          style={{
            marginBottom: 18,
            padding: '12px 14px',
            borderRadius: 12,
            background: '#edf8f0',
            color: '#23743d',
            border: '1px solid #d5efdc',
            fontSize: 12,
          }}
        >
          {message}
        </div>
      )}

      <div className="stats-grid">
        <div className="neumorphic-stat">
          <div className="stat-icon blue">⌂</div>
          <div>
            <span>COMPANY</span>
            <strong>{selectedCompany?.name || '—'}</strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon orange">▦</div>
          <div>
            <span>TOTAL BRANCHES</span>
            <strong>{branches.length}</strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon green">●</div>
          <div>
            <span>ACTIVE</span>
            <strong>{branches.filter((branch) => branch.status === 'ACTIVE').length}</strong>
          </div>
        </div>

        <div className="neumorphic-stat">
          <div className="stat-icon gray">○</div>
          <div>
            <span>INACTIVE</span>
            <strong>{branches.filter((branch) => branch.status !== 'ACTIVE').length}</strong>
          </div>
        </div>
      </div>

      <div className="content-card users-card">
        <div className="card-toolbar">
          <div>
            <h2>Company Branch Registry</h2>
            <p>
              {canManageBranches
                ? 'You are managing branches for your assigned company.'
                : 'Read-only branch information based on organisational visibility rules.'}
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isAsomacAdmin ? 'minmax(220px, 1fr) minmax(220px, 1fr) 160px' : 'minmax(220px, 1fr) 160px',
            gap: 10,
            padding: '17px 24px',
            background: '#fbfcfd',
            borderBottom: '1px solid #edf0f4',
          }}
        >
          {isAsomacAdmin && (
            <select
              value={selectedCompanyId}
              onChange={(event) => setSelectedCompanyId(event.target.value)}
              style={{
                height: 42,
                border: '1px solid #e1e6ed',
                borderRadius: 11,
                padding: '0 10px',
                background: '#fff',
                color: '#354156',
                fontSize: 11,
              }}
            >
              <option value="">Select company</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                  {company.allow_asomac_branch_visibility ? '' : ' — visibility restricted'}
                </option>
              ))}
            </select>
          )}

          <div className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search branches..."
            />
          </div>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as 'ALL' | RecordStatus)}
            style={{
              height: 42,
              border: '1px solid #e1e6ed',
              borderRadius: 11,
              padding: '0 10px',
              background: '#fff',
              color: '#354156',
              fontSize: 11,
            }}
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>

        {!selectedCompanyId ? (
          <div className="empty-state">
            <div className="empty-icon">⌂</div>
            <h3>Select a company</h3>
            <p>Select a company above to view its permitted branch information.</p>
          </div>
        ) : branchesLoading ? (
          <div className="loading-state">
            <div className="loading-spinner" />
            <span>Loading branches...</span>
          </div>
        ) : filteredBranches.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">⌂</div>
            <h3>No branches found</h3>
            <p>
              {canManageBranches
                ? 'This company has no branches yet. Use Add Branch to create the first one.'
                : 'No visible branches match the current filters.'}
            </p>
          </div>
        ) : (
          <div className="users-table-wrapper">
            <table className="users-table" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th>Branch</th>
                  <th>Location</th>
                  <th>Contact</th>
                  <th>Status</th>
                  {canManageBranches && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filteredBranches.map((branch) => (
                  <tr key={branch.id}>
                    <td>
                      <div className="user-details">
                        <strong>{branch.name}</strong>
                        <span>{branch.address || 'Address not provided'}</span>
                      </div>
                    </td>
                    <td>
                      <span className="location-text">
                        {branch.location || 'Location not provided'}
                      </span>
                    </td>
                    <td>
                      <div className="user-details">
                        <span>{branch.phone || 'No phone'}</span>
                        <small>{branch.email || 'No email'}</small>
                      </div>
                    </td>
                    <td>
                      <span
                        className={`status-badge ${branch.status === 'ACTIVE' ? 'active' : 'inactive'}`}
                      >
                        <span />
                        {branch.status}
                      </span>
                    </td>
                    {canManageBranches && (
                      <td>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <button
                            className="table-action"
                            onClick={() => openEdit(branch)}
                          >
                            Edit
                          </button>
                          {branch.status === 'ACTIVE' && (
                            <button
                              className="table-action"
                              style={{ color: '#b83429' }}
                              onClick={() => deactivateBranch(branch)}
                            >
                              Deactivate
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isSuperAdmin && (
        <div
          style={{
            marginTop: 18,
            padding: '13px 16px',
            borderRadius: 12,
            background: '#f4f7fb',
            color: '#667388',
            fontSize: 11,
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: '#00194C' }}>Super Administrator:</strong>{' '}
          platform-level branch visibility is available for oversight. Branch
          creation and maintenance remains assigned to the Company Administrator.
        </div>
      )}

      {modalOpen && (
        <div
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 18,
            background: 'rgba(15,23,42,.48)',
            backdropFilter: 'blur(5px)',
          }}
        >
          <div
            className="content-card"
            style={{
              width: 'min(720px, 100%)',
              maxHeight: 'calc(100vh - 36px)',
              overflowY: 'auto',
              padding: 24,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 15, marginBottom: 22 }}>
              <div>
                <div className="eyebrow">BRANCH REGISTRY</div>
                <h2 style={{ margin: 0, color: '#00194C' }}>
                  {editingBranch ? 'Edit Branch' : 'Add Branch'}
                </h2>
                <p style={{ margin: '6px 0 0', color: '#8993a4', fontSize: 11 }}>
                  {selectedCompany?.name || 'Selected company'}
                </p>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Close
              </button>
            </div>

            <form onSubmit={saveBranch}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 14,
                }}
              >
                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="form-label">Branch name *</span>
                  <input
                    className="form-input"
                    value={form.name}
                    onChange={(event) => setForm({ ...form, name: event.target.value })}
                    placeholder="e.g. Kampala Branch"
                    required
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="form-label">Status</span>
                  <select
                    className="form-input"
                    value={form.status}
                    onChange={(event) =>
                      setForm({ ...form, status: event.target.value as RecordStatus })
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                    <option value="SUSPENDED">Suspended</option>
                    <option value="CLOSED">Closed</option>
                  </select>
                </label>

                <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                  <span className="form-label">Address</span>
                  <input
                    className="form-input"
                    value={form.address}
                    onChange={(event) => setForm({ ...form, address: event.target.value })}
                    placeholder="Street, building, plot, office address"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="form-label">Location</span>
                  <input
                    className="form-input"
                    value={form.location}
                    onChange={(event) => setForm({ ...form, location: event.target.value })}
                    placeholder="District / town / area"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span className="form-label">Phone</span>
                  <input
                    className="form-input"
                    value={form.phone}
                    onChange={(event) => setForm({ ...form, phone: event.target.value })}
                    placeholder="+256..."
                    inputMode="tel"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6, gridColumn: '1 / -1' }}>
                  <span className="form-label">Email</span>
                  <input
                    className="form-input"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="branch@example.com"
                    autoComplete="email"
                  />
                </label>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: 10,
                  marginTop: 24,
                  paddingTop: 18,
                  borderTop: '1px solid #edf0f4',
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="primary-button" disabled={saving}>
                  {saving ? 'Saving...' : editingBranch ? 'Save Changes' : 'Create Branch'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
