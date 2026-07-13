/* ============================================================
 * Administracion.tsx — RF-018, RF-019, SRS §22.1
 * Solo Administrador puede acceder.
 * Gestión de usuarios y asignación de roles.
 * ============================================================ */
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { User as AppUser, Role, RoleName } from '../types/database';
import { useAuth } from '../contexts/AuthContext';
import { Settings, ShieldCheck, Save, Plus, AlertTriangle, Trash2 } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

const ROLES_ORDER: RoleName[] = ['Administrador','Analista','Supervisor','Invitado'];

const MOCK_USERS: (AppUser & { roles?: Role })[] = [
  { id:'u1', email:'analista@demo.com', full_name:'Ana García',    role_id:'r2', created_at: new Date(Date.now()-10*24*3600*1000).toISOString(), roles:{ id:'r2', name:'Analista', description:'Revisa noticias y señales' } },
  { id:'u2', email:'supervisor@demo.com', full_name:'Carlos López', role_id:'r3', created_at: new Date(Date.now()-8*24*3600*1000).toISOString(),  roles:{ id:'r3', name:'Supervisor', description:'Aprueba briefings' } },
  { id:'u3', email:'invitado@demo.com',   full_name:'María Torres', role_id:'r4', created_at: new Date(Date.now()-3*24*3600*1000).toISOString(),  roles:{ id:'r4', name:'Invitado', description:'Solo lectura' } },
];

export default function Administracion() {
  const { roleName, user } = useAuth();
  const [users, setUsers]   = useState<(AppUser & { roles?: Role })[]>(MOCK_USERS);
  const [roles, setRoles]   = useState<Role[]>([]);
  const [usingMock, setUsingMock] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved]   = useState<string | null>(null);

  // States for user creation
  const [creating, setCreating] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', full_name: '', role_id: '' });
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Confirm Modal state
  const [confirmRole, setConfirmRole] = useState<{ userId: string, roleId: string } | null>(null);
  const [confirmCreateUser, setConfirmCreateUser] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ id: string, name: string } | null>(null);

  // Solo Administrador (RF-019)
  if (roleName !== 'Administrador') {
    return (
      <div className="empty-state">
        <ShieldCheck size={36} />
        <h3>Acceso restringido</h3>
        <p>Solo el Administrador puede gestionar usuarios y roles. (RF-019, SRS §22.1)</p>
      </div>
    );
  }

  useEffect(() => {
    async function load() {
      const [uRes, rRes] = await Promise.all([
        supabase.from('users').select('*, roles(*)').order('created_at'),
        supabase.from('roles').select('*'),
      ]);
      if (!uRes.error && uRes.data?.length) { setUsers(uRes.data as (AppUser & { roles?: Role })[]); setUsingMock(false); }
      if (!rRes.error && rRes.data) setRoles(rRes.data as Role[]);
    }
    load();
  }, []);

  async function executeChangeRole() {
    if (!confirmRole) return;
    const { userId, roleId } = confirmRole;
    setConfirmRole(null);
    setSaving(userId);
    const { error } = await supabase.from('users').update({ role_id: roleId }).eq('id', userId);
    if (!error) {
      const role = roles.find(r => r.id === roleId);
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role_id: roleId, roles: role } : u));
    }
    setSaving(null);
    setSaved(userId);
    setTimeout(() => setSaved(null), 2000);
  }

  async function executeDeleteUser() {
    if (!confirmDeleteUser) return;
    const { id } = confirmDeleteUser;
    setConfirmDeleteUser(null);
    setUsers(prev => prev.filter(u => u.id !== id));
    if (!usingMock) {
      await supabase.from('users').delete().eq('id', id);
    }
  }

  function requestCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);

    if (!newUser.email || !newUser.password || !newUser.role_id) {
      setCreateError('El correo, contraseña y el rol son obligatorios.');
      return;
    }

    setConfirmCreateUser(true);
  }

  async function executeCreateUser() {
    setConfirmCreateUser(false);
    setIsCreating(true);

    // Validación de email duplicado en la tabla `users` (Mejora 1)
    const { data: existingUser } = await supabase.from('users').select('id').eq('email', newUser.email).maybeSingle();

    if (existingUser || users.some(u => u.email === newUser.email)) {
      setCreateError('Ya existe un usuario registrado con este correo electrónico.');
      setIsCreating(false);
      return;
    }

    const role = roles.find(r => r.id === newUser.role_id);

    if (usingMock) {
      const mockCreatedUser: AppUser & { roles?: Role } = {
        id: `u-${Date.now()}`,
        email: newUser.email,
        full_name: newUser.full_name,
        role_id: newUser.role_id,
        created_at: new Date().toISOString(),
        roles: role
      };
      setUsers(prev => [...prev, mockCreatedUser]);
    } else {
      // Registrar usuario en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: { full_name: newUser.full_name }
        }
      });
      
      if (authError) {
        setCreateError(authError.message);
        setIsCreating(false);
        return;
      }
      
      // Actualizar el rol del nuevo usuario si fue creado exitosamente y tenemos su ID
      if (authData.user) {
        const { error: updateError } = await supabase
          .from('users')
          .update({ role_id: newUser.role_id })
          .eq('id', authData.user.id);
          
        if (updateError) {
          console.error("Error asignando rol al usuario:", updateError.message);
        }
        
        // Agregar al estado local (solo visual, recargar para actualizar de DB)
        const mockCreatedUser: AppUser & { roles?: Role } = {
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role_id: newUser.role_id,
          created_at: new Date().toISOString(),
          roles: role
        };
        setUsers(prev => [...prev, mockCreatedUser]);
      }
    }

    setNewUser({ email: '', password: '', full_name: '', role_id: '' });
    setCreating(false);
    setIsCreating(false);
  }

  return (
    <div>
      <div className="page-header" style={{ marginBottom: '16px' }}>
        <div>
          <h1 className="page-title" style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <Settings size={24} style={{ color:'var(--accent-light)' }} />
            Administración
          </h1>
          <p className="page-subtitle">Gestión de usuarios y asignación de roles (RF-018, RF-019)</p>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button className="btn btn-primary" onClick={() => setCreating(!creating)}>
          <Plus size={14} /> Nuevo usuario
        </button>
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '16px' }}>Crear nuevo usuario</h3>
          <form onSubmit={requestCreateUser} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label" htmlFor="new-user-email">Correo Electrónico *</label>
              <input id="new-user-email" type="email" className="form-input" value={newUser.email} onChange={e => setNewUser(prev => ({ ...prev, email: e.target.value }))} placeholder="usuario@empresa.com" required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label" htmlFor="new-user-password">Contraseña *</label>
              <input id="new-user-password" type="password" className="form-input" value={newUser.password} onChange={e => setNewUser(prev => ({ ...prev, password: e.target.value }))} placeholder="••••••••" required />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label" htmlFor="new-user-name">Nombre Completo</label>
              <input id="new-user-name" type="text" className="form-input" value={newUser.full_name} onChange={e => setNewUser(prev => ({ ...prev, full_name: e.target.value }))} placeholder="Ej. María López" />
            </div>
            <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
              <label className="form-label" htmlFor="new-user-role">Rol *</label>
              <select id="new-user-role" className="form-select" value={newUser.role_id} onChange={e => setNewUser(prev => ({ ...prev, role_id: e.target.value }))} required>
                <option value="">Seleccionar rol...</option>
                {roles.length > 0
                  ? roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                  : ROLES_ORDER.map(n => <option key={n} value={n}>{n}</option>)
                }
              </select>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setCreating(false)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={isCreating}>
                {isCreating ? <span className="spinner" style={{ width:14, height:14 }} /> : 'Crear'}
              </button>
            </div>
          </form>
          {createError && (
            <div style={{ color: 'var(--negativo)', fontSize: '13px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <AlertTriangle size={14} />
              {createError}
            </div>
          )}
        </div>
      )}

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol actual</th>
              <th>Registrado</th>
              <th>Cambiar rol</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.id}>
                <td style={{ fontWeight:600 }}>{u.full_name ?? '—'}</td>
                <td style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>{u.email}</td>
                <td>
                  <span style={{
                    display:'inline-flex', alignItems:'center', gap:'5px', fontWeight:700, fontSize:'12px',
                    color: u.roles?.name === 'Administrador' ? 'var(--negativo)' :
                           u.roles?.name === 'Supervisor'    ? '#8b5cf6' :
                           u.roles?.name === 'Analista'      ? 'var(--accent-light)' : 'var(--text-muted)',
                  }}>
                    <ShieldCheck size={13} />
                    {u.roles?.name ?? 'Sin rol'}
                  </span>
                </td>
                <td style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                  {new Date(u.created_at).toLocaleDateString('es-MX')}
                </td>
                <td>
                  <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
                    <select
                      id={`user-role-${u.id}`}
                      className="filter-select"
                      value={u.role_id ?? ''}
                      onChange={e => {
                        const targetRoleName = roles.length > 0 ? roles.find(r => r.id === e.target.value)?.name : e.target.value;
                        setConfirmRole({ userId: u.id, roleId: e.target.value });
                      }}
                      disabled={saving === u.id}
                      style={{ minWidth:'130px' }}
                    >
                      {roles.length > 0
                        ? roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)
                        : ROLES_ORDER.map(n => <option key={n} value={n}>{n}</option>)
                      }
                    </select>
                    {saving === u.id && <span className="spinner" style={{ width:14, height:14 }} />}
                    {saved === u.id && <span style={{ fontSize:'12px', color:'var(--positivo)' }}><Save size={13} /> Guardado</span>}
                    
                    {u.id !== user?.id && (
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => setConfirmDeleteUser({ id: u.id, name: u.full_name || u.email })}
                        title="Eliminar usuario"
                      >
                        <Trash2 size={16} style={{ color: 'var(--negativo)' }} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        isOpen={!!confirmRole}
        title="Confirmar cambio de rol"
        message="¿Estás seguro de que deseas cambiar el rol de este usuario? Esto modificará sus permisos de acceso en el sistema inmediatamente."
        confirmText="Cambiar rol"
        onConfirm={executeChangeRole}
        onCancel={() => setConfirmRole(null)}
      />

      <ConfirmModal
        isOpen={!!confirmDeleteUser}
        title="Eliminar usuario"
        message={`¿Estás seguro de que deseas eliminar al usuario ${confirmDeleteUser?.name}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        onConfirm={executeDeleteUser}
        onCancel={() => setConfirmDeleteUser(null)}
      />

      <ConfirmModal
        isOpen={confirmCreateUser}
        title="Confirmar nuevo usuario"
        message={`¿Confirmas crear el usuario ${newUser.email} con rol "${(roles.find(r => r.id === newUser.role_id)?.name) ?? newUser.role_id}"?`}
        confirmText="Crear usuario"
        isDestructive={false}
        onConfirm={executeCreateUser}
        onCancel={() => setConfirmCreateUser(false)}
      />
    </div>
  );
}
