import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';

type Company = {
  id: string;
  name: string;
  registration_number: string | null;
  status: string;
  description: string | null;
  logo_url: string | null;
  slug: string | null;
  head_office: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  website_url: string | null;
  profile_text: string | null;
  membership_number: string | null;
  membership_status: string | null;
  membership_started_at: string | null;
  membership_notes: string | null;
  allow_asomac_branch_visibility: boolean;
  allow_asomac_user_visibility: boolean;
  allow_asomac_reports: boolean;
  created_at: string;
};

type CompanyAdministrator = {
  user_id: string;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  status: string;
  assigned_at: string | null;
  role_ended_at: string | null;
};

type Director = {
  id: string;
  company_id: string;
  full_name: string;
  position_title: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  sort_order: number;
  status: string;
};

const EMPTY_FORM = {
  name: '',
  registration_number: '',
  head_office: '',
  contact_phone: '',
  contact_email: '',
  website_url: '',
  profile_text: '',
  logo_url: '',
  membership_number: '',
  membership_status: 'PENDING',
  membership_started_at: '',
  membership_notes: '',
  status: 'ACTIVE',
  allow_asomac_branch_visibility: false,
  allow_asomac_user_visibility: false,
  allow_asomac_reports: false,
};

const EMPTY_DIRECTOR = {
  full_name: '',
  position_title: '',
  phone: '',
  email: '',
  notes: '',
  sort_order: 0,
  status: 'ACTIVE',
};

function labelStatus(value: string | null) {
  if (!value) return '—';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function Companies() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const [canManageRegistry, setCanManageRegistry] = useState(false);
  const [selected, setSelected] = useState<Company | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);

  const [directors, setDirectors] = useState<Director[]>([]);
  const [directorForm, setDirectorForm] = useState(EMPTY_DIRECTOR);
  const [editingDirectorId, setEditingDirectorId] = useState<string | null>(null);
  const [loadingDirectors, setLoadingDirectors] = useState(false);
  const [savingDirector, setSavingDirector] = useState(false);
  const [companyAdministrators, setCompanyAdministrators] = useState<CompanyAdministrator[]>([]);
  const [loadingCompanyAdministrators, setLoadingCompanyAdministrators] = useState(false);
  const [companyAdminEmail, setCompanyAdminEmail] = useState('');
  const [companyAdminName, setCompanyAdminName] = useState('');
  const [companyAdminPhone, setCompanyAdminPhone] = useState('');
  const [companyAdminCountryCode, setCompanyAdminCountryCode] = useState('+256');
  const [assigningCompanyAdmin, setAssigningCompanyAdmin] = useState(false);
  const [companyAdminInviteLink, setCompanyAdminInviteLink] = useState('');

  async function loadCompanies() {
    setLoading(true);
    setError('');

    const { data, error: loadError } = await supabase
      .from('companies')
      .select(
        'id,name,registration_number,status,description,logo_url,slug,head_office,contact_phone,contact_email,website_url,profile_text,membership_number,membership_status,membership_started_at,membership_notes,allow_asomac_branch_visibility,allow_asomac_user_visibility,allow_asomac_reports,created_at'
      )
      .order('name');

    if (loadError) {
      setCompanies([]);
      setError(loadError.message || 'Unable to load companies.');
    } else {
      setCompanies((data || []) as Company[]);
    }

    setLoading(false);
  }

  async function loadPermissions() {
    const { data, error: permissionError } = await supabase.rpc('is_asomac_admin');

    if (!permissionError) {
      setCanManageRegistry(Boolean(data));
      return;
    }

    const { data: roleRows } = await supabase
      .from('user_roles')
      .select('roles(code)')
      .is('ended_at', null);

    const codes = (roleRows || []).map((row: any) => row.roles?.code).filter(Boolean);
    setCanManageRegistry(codes.includes('SUPER_ADMIN') || codes.includes('ASOMAC_ADMIN'));
  }

  useEffect(() => {
    loadCompanies();
    loadPermissions();
  }, []);

  async function loadCompanyAdministrators(companyId: string) {
    setLoadingCompanyAdministrators(true);
    const { data, error } = await supabase.rpc('list_company_administrators', {
      p_company_id: companyId,
    });
    if (error) {
      setCompanyAdministrators([]);
      setError(error.message || 'Unable to load company users.');
    } else {
      setCompanyAdministrators((data || []) as CompanyAdministrator[]);
    }
    setLoadingCompanyAdministrators(false);
  }

  async function assignCompanyChairperson() {
    if (!selected) return;
    if (!companyAdminName.trim() || !companyAdminEmail.trim() || !companyAdminPhone.trim()) {
      setError('Company Chairperson name, email and phone are required.');
      return;
    }

    setAssigningCompanyAdmin(true);
    setError('');
    setMessage('');
    setCompanyAdminInviteLink('');

    const { data, error } = await supabase.rpc('create_company_admin_invitation', {
      p_company_id: selected.id,
      p_email: companyAdminEmail.trim().toLowerCase(),
      p_full_name: companyAdminName.trim(),
      p_phone: companyAdminPhone.trim(),
      p_country_code: companyAdminCountryCode,
      p_expires_in_hours: 168,
    });

    if (error) {
      setError(error.message || 'Unable to assign Company Chairperson.');
    } else {
      const result = Array.isArray(data) ? data[0] : data;
      if (result?.invitation_token) {
        const link = `${window.location.origin}/accept-invitation?token=${encodeURIComponent(result.invitation_token)}`;
        setCompanyAdminInviteLink(link);
      }
      setMessage('Company Chairperson invitation created successfully.');
      setCompanyAdminEmail('');
      setCompanyAdminName('');
      setCompanyAdminPhone('');
      await loadCompanyAdministrators(selected.id);
    }

    setAssigningCompanyAdmin(false);
  }

  async function loadDirectors(companyId: string) {
    setLoadingDirectors(true);

    const { data, error: directorError } = await supabase.rpc(
      'list_company_directors',
      { p_company_id: companyId }
    );

    if (directorError) {
      setDirectors([]);
      setError(directorError.message || 'Unable to load board of directors.');
    } else {
      setDirectors((data || []) as Director[]);
    }

    setLoadingDirectors(false);
  }

  function openCreate() {
    setSelected(null);
    setForm({ ...EMPTY_FORM });
    setDirectors([]);
    setDirectorForm({ ...EMPTY_DIRECTOR });
    setEditingDirectorId(null);
    setMessage('');
    setError('');
    setShowForm(true);
  }

  async function openEdit(company: Company) {
    setSelected(company);
    setForm({
      name: company.name || '',
      registration_number: company.registration_number || '',
      head_office: company.head_office || '',
      contact_phone: company.contact_phone || '',
      contact_email: company.contact_email || '',
      website_url: company.website_url || '',
      profile_text: company.profile_text || company.description || '',
      logo_url: company.logo_url || '',
      membership_number: company.membership_number || '',
      membership_status: company.membership_status || 'PENDING',
      membership_started_at: company.membership_started_at || '',
      membership_notes: company.membership_notes || '',
      status: company.status || 'ACTIVE',
      allow_asomac_branch_visibility: Boolean(company.allow_asomac_branch_visibility),
      allow_asomac_user_visibility: Boolean(company.allow_asomac_user_visibility),
      allow_asomac_reports: Boolean(company.allow_asomac_reports),
    });
    setDirectorForm({ ...EMPTY_DIRECTOR });
    setEditingDirectorId(null);
    setMessage('');
    setError('');
    setShowForm(true);
    await Promise.all([loadDirectors(company.id), loadCompanyAdministrators(company.id)]);
  }

  function closeForm() {
    if (saving || savingDirector) return;
    setShowForm(false);
    setSelected(null);
    setDirectors([]);
    setCompanyAdministrators([]);
    setCompanyAdminInviteLink('');
    setEditingDirectorId(null);
  }

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: typeof EMPTY_FORM[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function saveCompany(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    if (!form.name.trim()) {
      setError('Company name is required.');
      setSaving(false);
      return;
    }

    const payload = {
      p_name: form.name.trim(),
      p_registration_number: form.registration_number.trim() || null,
      p_head_office: form.head_office.trim() || null,
      p_contact_phone: form.contact_phone.trim() || null,
      p_contact_email: form.contact_email.trim() || null,
      p_website_url: form.website_url.trim() || null,
      p_profile_text: form.profile_text.trim() || null,
      p_logo_url: form.logo_url.trim() || null,
      p_membership_number: form.membership_number.trim() || null,
      p_membership_status: form.membership_status,
      p_membership_started_at: form.membership_started_at || null,
      p_membership_notes: form.membership_notes.trim() || null,
      p_status: form.status,
      p_allow_asomac_branch_visibility: form.allow_asomac_branch_visibility,
      p_allow_asomac_user_visibility: form.allow_asomac_user_visibility,
      p_allow_asomac_reports: form.allow_asomac_reports,
    };

    const result = selected
      ? await supabase.rpc('update_company_registry', {
          p_company_id: selected.id,
          ...payload,
        })
      : await supabase.rpc('create_company_registry', payload);

    if (result.error) {
      setError(result.error.message || 'Unable to save company.');
      setSaving(false);
      return;
    }

    setMessage(selected ? 'Company registry updated successfully.' : 'Company registered successfully.');
    await loadCompanies();

    if (!selected && result.data?.id) {
      const created = (result.data as Company);
      setSelected(created);
      await loadDirectors(created.id);
    }

    setSaving(false);
  }

  function startDirectorEdit(director: Director) {
    setEditingDirectorId(director.id);
    setDirectorForm({
      full_name: director.full_name,
      position_title: director.position_title,
      phone: director.phone || '',
      email: director.email || '',
      notes: director.notes || '',
      sort_order: director.sort_order,
      status: director.status || 'ACTIVE',
    });
  }

  function resetDirectorForm() {
    setEditingDirectorId(null);
    setDirectorForm({ ...EMPTY_DIRECTOR });
  }

  async function saveDirector(event: React.FormEvent) {
    event.preventDefault();

    if (!selected) {
      setError('Save the company first before adding board members.');
      return;
    }

    setSavingDirector(true);
    setMessage('');
    setError('');

    const { error: directorError } = await supabase.rpc('save_company_director', {
      p_id: editingDirectorId,
      p_company_id: selected.id,
      p_full_name: directorForm.full_name.trim(),
      p_position_title: directorForm.position_title.trim(),
      p_phone: directorForm.phone.trim() || null,
      p_email: directorForm.email.trim() || null,
      p_notes: directorForm.notes.trim() || null,
      p_sort_order: Number(directorForm.sort_order) || 0,
      p_status: directorForm.status,
    });

    if (directorError) {
      setError(directorError.message || 'Unable to save board member.');
      setSavingDirector(false);
      return;
    }

    setMessage(editingDirectorId ? 'Board member updated.' : 'Board member added.');
    resetDirectorForm();
    await loadDirectors(selected.id);
    setSavingDirector(false);
  }

  async function deleteDirector(director: Director) {
    if (!window.confirm(`Remove ${director.full_name} from the board of directors?`)) return;

    setSavingDirector(true);
    setError('');

    const { error: directorError } = await supabase.rpc(
      'delete_company_director',
      { p_id: director.id }
    );

    if (directorError) {
      setError(directorError.message || 'Unable to remove board member.');
    } else {
      setMessage('Board member removed.');
      await loadDirectors(director.company_id);
    }

    setSavingDirector(false);
  }

  const filteredCompanies = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return companies;

    return companies.filter((company) =>
      [
        company.name,
        company.registration_number,
        company.head_office,
        company.contact_email,
        company.contact_phone,
        company.membership_number,
        company.membership_status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [companies, search]);

  return (
    <div className="page-container">
      <div className="page-heading">
        <div>
          <div className="eyebrow">ASOMAC COMPANY REGISTRY</div>
          <h1>Companies</h1>
          <p>
            Maintain official company registration information, contacts, head office,
            membership records and board of directors.
          </p>
        </div>

        {canManageRegistry && (
          <button className="primary-button" onClick={openCreate}>
            + Register Company
          </button>
        )}
      </div>

      {message && (
        <div className="mb-4 rounded-xl bg-green-50 border border-green-200 text-green-700 px-4 py-3 text-sm">
          {message}
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      <div className="card p-4 mb-5">
        <input
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#f35a02]/20"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search company, registration number, head office or contact..."
        />
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left">
                <th className="px-5 py-4">Company</th>
                <th className="px-5 py-4">Registration</th>
                <th className="px-5 py-4">Head office</th>
                <th className="px-5 py-4">Membership</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    Loading company registry…
                  </td>
                </tr>
              ) : filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                    No companies registered yet.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((company) => (
                  <tr key={company.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-5 py-4">
                      <div className="font-bold text-[#00194C]">{company.name}</div>
                      {company.contact_email && (
                        <div className="text-xs text-slate-500 mt-1">{company.contact_email}</div>
                      )}
                    </td>
                    <td className="px-5 py-4">{company.registration_number || '—'}</td>
                    <td className="px-5 py-4">{company.head_office || '—'}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-bold">
                        {labelStatus(company.membership_status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex rounded-full bg-slate-100 text-slate-700 px-3 py-1 text-xs font-bold">
                        {labelStatus(company.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <button
                        className="rounded-lg bg-[#00194C] text-white px-3 py-2 text-xs font-bold"
                        onClick={() => openEdit(company)}
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

      {showForm && (
        <div className="fixed inset-0 z-[120] bg-slate-900/50 backdrop-blur-sm p-3 md:p-6 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-[#00194C] text-white px-5 md:px-7 py-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[#f35a02] text-xs font-black tracking-[0.18em]">
                  COMPANY REGISTRY
                </p>
                <h2 className="text-xl md:text-2xl font-black mt-1">
                  {selected ? 'Edit Company' : 'Register Company'}
                </h2>
              </div>
              <button
                onClick={closeForm}
                className="w-10 h-10 rounded-xl bg-white/10 text-white text-xl"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="p-5 md:p-7">
              <form onSubmit={saveCompany} className="space-y-6">
                <div>
                  <h3 className="font-black text-[#00194C] text-lg">Official company information</h3>
                  <div className="grid md:grid-cols-2 gap-4 mt-4">
                    <Field label="Company name *">
                      <input value={form.name} onChange={(e) => setField('name', e.target.value)} required />
                    </Field>
                    <Field label="Registration number">
                      <input value={form.registration_number} onChange={(e) => setField('registration_number', e.target.value)} />
                    </Field>
                    <Field label="Head office">
                      <input value={form.head_office} onChange={(e) => setField('head_office', e.target.value)} />
                    </Field>
                    <Field label="Logo URL">
                      <input value={form.logo_url} onChange={(e) => setField('logo_url', e.target.value)} placeholder="https://..." />
                    </Field>
                    <Field label="Company contact phone">
                      <input value={form.contact_phone} onChange={(e) => setField('contact_phone', e.target.value)} />
                    </Field>
                    <Field label="Company contact email">
                      <input type="email" value={form.contact_email} onChange={(e) => setField('contact_email', e.target.value)} />
                    </Field>
                    <Field label="Website">
                      <input type="url" value={form.website_url} onChange={(e) => setField('website_url', e.target.value)} placeholder="https://..." />
                    </Field>
                    <Field label="Company status">
                      <select value={form.status} onChange={(e) => setField('status', e.target.value)}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="CLOSED">Closed</option>
                      </select>
                    </Field>
                  </div>
                </div>

                <div>
                  <h3 className="font-black text-[#00194C] text-lg">Company profile</h3>
                  <textarea
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 min-h-[120px]"
                    value={form.profile_text}
                    onChange={(e) => setField('profile_text', e.target.value)}
                    placeholder="Official company profile, description and background..."
                  />
                </div>

                <div>
                  <h3 className="font-black text-[#00194C] text-lg">ASOMAC membership</h3>
                  <div className="grid md:grid-cols-3 gap-4 mt-4">
                    <Field label="Membership number">
                      <input value={form.membership_number} onChange={(e) => setField('membership_number', e.target.value)} />
                    </Field>
                    <Field label="Membership status">
                      <select value={form.membership_status} onChange={(e) => setField('membership_status', e.target.value)}>
                        <option value="PENDING">Pending</option>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended</option>
                        <option value="EXPIRED">Expired</option>
                      </select>
                    </Field>
                    <Field label="Membership start date">
                      <input type="date" value={form.membership_started_at} onChange={(e) => setField('membership_started_at', e.target.value)} />
                    </Field>
                  </div>
                  <textarea
                    className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-3 min-h-[90px]"
                    value={form.membership_notes}
                    onChange={(e) => setField('membership_notes', e.target.value)}
                    placeholder="Membership notes..."
                  />
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5">
                  <h3 className="font-black text-[#00194C]">Company-controlled visibility</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    These settings protect company privacy. They do not grant ASOMAC operational control.
                  </p>

                  <div className="grid md:grid-cols-3 gap-3 mt-4">
                    <ConsentToggle
                      checked={form.allow_asomac_branch_visibility}
                      onChange={(value) => setField('allow_asomac_branch_visibility', value)}
                      label="Allow branch information"
                    />
                    <ConsentToggle
                      checked={form.allow_asomac_user_visibility}
                      onChange={(value) => setField('allow_asomac_user_visibility', value)}
                      label="Allow company user information"
                    />
                    <ConsentToggle
                      checked={form.allow_asomac_reports}
                      onChange={(value) => setField('allow_asomac_reports', value)}
                      label="Allow company reports"
                    />
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <button type="button" onClick={closeForm} className="rounded-xl border border-slate-200 px-5 py-3 font-bold text-slate-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving} className="primary-button">
                    {saving ? 'Saving…' : selected ? 'Save Company' : 'Register Company'}
                  </button>
                </div>
              </form>

              <div className="mt-8 pt-8 border-t border-slate-200">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <h3 className="font-black text-[#00194C] text-lg">Company Leadership & Users</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Assign the Company Chairperson and maintain company-level access. The Chairperson will receive a secure invitation.
                    </p>
                  </div>
                </div>

                {selected && (
                  <>
                    <div className="grid md:grid-cols-4 gap-3 mt-5 rounded-2xl bg-slate-50 p-4">
                      <input className="rounded-xl border border-slate-200 px-3 py-3" placeholder="Full name" value={companyAdminName} onChange={(e) => setCompanyAdminName(e.target.value)} />
                      <input className="rounded-xl border border-slate-200 px-3 py-3" type="email" placeholder="Email" value={companyAdminEmail} onChange={(e) => setCompanyAdminEmail(e.target.value)} />
                      <div className="flex gap-2">
                        <select className="rounded-xl border border-slate-200 px-2 py-3 bg-white" value={companyAdminCountryCode} onChange={(e) => setCompanyAdminCountryCode(e.target.value)}>
                          <option value="+256">+256 UG</option>
                          <option value="+254">+254 KE</option>
                          <option value="+255">+255 TZ</option>
                          <option value="+250">+250 RW</option>
                        </select>
                        <input className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-3" placeholder="Phone" value={companyAdminPhone} onChange={(e) => setCompanyAdminPhone(e.target.value)} />
                      </div>
                      <button type="button" onClick={assignCompanyChairperson} disabled={assigningCompanyAdmin} className="primary-button">
                        {assigningCompanyAdmin ? 'Creating…' : 'Assign Company Chairperson'}
                      </button>
                    </div>

                    {companyAdminInviteLink && (
                      <div className="mt-3 rounded-xl bg-green-50 border border-green-200 p-3">
                        <p className="text-xs font-bold text-green-800">Secure invitation link</p>
                        <div className="mt-2 flex gap-2">
                          <input readOnly value={companyAdminInviteLink} className="min-w-0 flex-1 rounded-lg border border-green-200 bg-white px-3 py-2 text-xs" />
                          <button type="button" onClick={() => navigator.clipboard?.writeText(companyAdminInviteLink)} className="rounded-lg bg-green-700 text-white px-3 py-2 text-xs font-bold">Copy</button>
                        </div>
                      </div>
                    )}

                    <div className="mt-5">
                      {loadingCompanyAdministrators ? (
                        <p className="py-5 text-sm text-slate-500">Loading company users…</p>
                      ) : companyAdministrators.length === 0 ? (
                        <p className="py-5 text-sm text-slate-400">No company-level users assigned yet.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="border-b border-slate-200 text-left">
                              <tr>
                                <th className="py-3 pr-4">User</th>
                                <th className="py-3 pr-4">Phone</th>
                                <th className="py-3 pr-4">Status</th>
                                <th className="py-3">Assigned</th>
                              </tr>
                            </thead>
                            <tbody>
                              {companyAdministrators.map((user) => (
                                <tr key={user.user_id} className="border-b border-slate-100">
                                  <td className="py-3 pr-4">
                                    <div className="font-bold text-[#00194C]">{user.full_name || 'Unnamed user'}</div>
                                    <div className="text-xs text-slate-500">{user.email || '—'}</div>
                                  </td>
                                  <td className="py-3 pr-4">{user.phone || '—'}</td>
                                  <td className="py-3 pr-4">{labelStatus(user.status)}</td>
                                  <td className="py-3">{user.assigned_at ? new Date(user.assigned_at).toLocaleDateString() : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="mt-8 pt-8 border-t border-slate-200">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
                  <div>
                    <h3 className="font-black text-[#00194C] text-lg">Board of Directors</h3>
                    <p className="text-sm text-slate-500 mt-1">
                      Official registry records maintained by the ASOMAC Administrator.
                    </p>
                  </div>
                  {!selected && (
                    <span className="text-xs text-slate-400">Save the company first.</span>
                  )}
                </div>

                {selected && (
                  <>
                    <form onSubmit={saveDirector} className="grid md:grid-cols-2 gap-4 mt-5 rounded-2xl bg-slate-50 p-4">
                      <Field label="Full name *">
                        <input value={directorForm.full_name} onChange={(e) => setDirectorForm((v) => ({ ...v, full_name: e.target.value }))} required />
                      </Field>
                      <Field label="Position / title *">
                        <input value={directorForm.position_title} onChange={(e) => setDirectorForm((v) => ({ ...v, position_title: e.target.value }))} required />
                      </Field>
                      <Field label="Phone">
                        <input value={directorForm.phone} onChange={(e) => setDirectorForm((v) => ({ ...v, phone: e.target.value }))} />
                      </Field>
                      <Field label="Email">
                        <input type="email" value={directorForm.email} onChange={(e) => setDirectorForm((v) => ({ ...v, email: e.target.value }))} />
                      </Field>
                      <Field label="Display order">
                        <input type="number" value={directorForm.sort_order} onChange={(e) => setDirectorForm((v) => ({ ...v, sort_order: Number(e.target.value) }))} />
                      </Field>
                      <Field label="Status">
                        <select value={directorForm.status} onChange={(e) => setDirectorForm((v) => ({ ...v, status: e.target.value }))}>
                          <option value="ACTIVE">Active</option>
                          <option value="INACTIVE">Inactive</option>
                          <option value="SUSPENDED">Suspended</option>
                        </select>
                      </Field>
                      <textarea
                        className="md:col-span-2 rounded-xl border border-slate-200 px-4 py-3 min-h-[80px]"
                        value={directorForm.notes}
                        onChange={(e) => setDirectorForm((v) => ({ ...v, notes: e.target.value }))}
                        placeholder="Board member notes..."
                      />
                      <div className="md:col-span-2 flex gap-2 justify-end">
                        {editingDirectorId && (
                          <button type="button" onClick={resetDirectorForm} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">
                            Cancel edit
                          </button>
                        )}
                        <button type="submit" disabled={savingDirector} className="primary-button">
                          {savingDirector ? 'Saving…' : editingDirectorId ? 'Update Board Member' : 'Add Board Member'}
                        </button>
                      </div>
                    </form>

                    <div className="mt-5 overflow-x-auto">
                      {loadingDirectors ? (
                        <p className="py-8 text-center text-slate-500">Loading board…</p>
                      ) : directors.length === 0 ? (
                        <p className="py-8 text-center text-slate-400">No board members recorded yet.</p>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="border-b border-slate-200 text-left">
                            <tr>
                              <th className="py-3 pr-4">Name</th>
                              <th className="py-3 pr-4">Position</th>
                              <th className="py-3 pr-4">Contact</th>
                              <th className="py-3 pr-4">Status</th>
                              <th className="py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {directors.map((director) => (
                              <tr key={director.id} className="border-b border-slate-100">
                                <td className="py-3 pr-4 font-bold text-[#00194C]">{director.full_name}</td>
                                <td className="py-3 pr-4">{director.position_title}</td>
                                <td className="py-3 pr-4">
                                  <div>{director.phone || '—'}</div>
                                  <div className="text-xs text-slate-500">{director.email || ''}</div>
                                </td>
                                <td className="py-3 pr-4">{labelStatus(director.status)}</td>
                                <td className="py-3 text-right whitespace-nowrap">
                                  <button onClick={() => startDirectorEdit(director)} className="text-[#00194C] font-bold mr-3">Edit</button>
                                  <button onClick={() => deleteDirector(director)} className="text-red-600 font-bold">Delete</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-bold text-slate-600 mb-1.5">{label}</span>
      <div className="[&>input]:w-full [&>input]:rounded-xl [&>input]:border [&>input]:border-slate-200 [&>input]:px-4 [&>input]:py-3 [&>input]:outline-none [&>input]:focus:ring-2 [&>input]:focus:ring-[#f35a02]/20 [&>select]:w-full [&>select]:rounded-xl [&>select]:border [&>select]:border-slate-200 [&>select]:px-4 [&>select]:py-3 [&>select]:bg-white">{children}</div>
    </label>
  );
}

function ConsentToggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-start gap-3 rounded-xl bg-white border border-slate-200 p-3 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1"
      />
      <span className="text-sm font-bold text-slate-700">{label}</span>
    </label>
  );
}
