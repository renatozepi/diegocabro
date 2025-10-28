// admin.js (aislado, sin globals y tolerante a nulls)
(() => {
  document.addEventListener('DOMContentLoaded', init);

  async function init(){
    if (!window.supabase) return console.error('Supabase no inicializado');

    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) logoutBtn.onclick = async () => {
      await supabase.auth.signOut();
      location.href = 'index.html';
    };

    // Este JS solo debe correr en admin.html
    const createBtn = document.getElementById('btn-create');
    const emailInput = document.getElementById('new-email');
    const codePop   = document.getElementById('code-pop');
    const usersList = document.getElementById('users-list');
    const usersMsg  = document.getElementById('users-msg');
    const reqs      = document.getElementById('reqs');
    const reqsMsg   = document.getElementById('reqs-msg');

    // Si no existen estos nodos, salimos silenciosamente
    if (!createBtn || !emailInput || !usersList) return;

    await requireAdmin();     // redirige si no es admin
    await loadUsers();
    await loadRequests();

let creating = false;
createBtn.addEventListener('click', async ()=>{
  if (creating) return;
  const email = (emailInput.value || '').trim().toLowerCase();
  usersMsg.textContent = ''; codePop.textContent = '';
  if (!email){ usersMsg.textContent='Ingrese un correo válido.'; return; }

creating = true;
createBtn.disabled = true;
try {
  const { data, error } = await supabase.rpc('issue_temp_code', { p_email: email });
  if (error) { usersMsg.textContent = 'No se pudo crear el usuario.'; return; }

  if (data?.status === 'duplicate') {
    usersMsg.textContent = 'Ya existe un código activo para este correo. Espere y reintente.';
    return;
  }

  codePop.textContent = `Código generado para ${data.email}: ${data.code} (expira ${new Date(data.expires_at).toLocaleString()})`;
  emailInput.value = '';
  await loadUsers();
} finally {
  setTimeout(()=>{ creating=false; createBtn.disabled=false; }, 1200);
}

});


    async function requireAdmin(){
      const { data: { user } } = await supabase.auth.getUser();
      if (!user){ location.href='index.html'; return; }
      const { data, error } = await supabase.from('users_profiles').select('rol').eq('id', user.id).single();
      if (error || !data || data.rol !== 'admin'){ location.href='usuario.html'; }
    }

    async function loadUsers(){
      usersList.innerHTML = '';
      const { data, error } = await supabase
        .from('users_profiles')
        .select('id,email,username,nombres,apellidos,rol,created_at')
        .order('created_at',{ascending:false});
      if (error){ usersMsg.textContent='Error al cargar usuarios.'; return; }
      data.forEach(u=>{
        const card = document.createElement('div');
        card.className='card grid';
        card.innerHTML = `
          <div><strong>${u.username || '(sin usuario)'} </strong> — ${u.email}</div>
          <div>${u.nombres||''} ${u.apellidos||''} • Rol: ${u.rol}</div>
          <div class="actions">
            <button class="btn secondary" data-edit="${u.id}">Editar</button>
            <button class="btn" data-del="${u.id}">Eliminar</button>
          </div>
        `;
        usersList.appendChild(card);
      });

      usersList.querySelectorAll('[data-del]').forEach(btn=>{
        btn.onclick = async ()=>{
          const id = btn.getAttribute('data-del');
          const { error } = await supabase.from('users_profiles').delete().eq('id', id);
          if (error){ usersMsg.textContent='No se pudo eliminar.'; return; }
          await loadUsers();
        };
      });

      usersList.querySelectorAll('[data-edit]').forEach(btn=>{
        btn.onclick = async ()=>{
          const id = btn.getAttribute('data-edit');
          const email = prompt('Nuevo correo (vacío = sin cambio):');
          const rol = prompt('Rol (admin|user). Vacío = sin cambio:');
          const update = {};
          if (email) update.email = email.toLowerCase();
          if (rol) update.rol = rol;
          if (!Object.keys(update).length) return;
          const { error } = await supabase.from('users_profiles').update(update).eq('id', id);
          if (error){ usersMsg.textContent='No se pudo editar.'; return; }
          await loadUsers();
        };
      });
    }

    async function loadRequests(){
      if (!reqs) return;
      const { data, error } = await supabase
        .from('credential_change_requests')
        .select('id,user_id,payload,status,created_at')
        .eq('status','pendiente')
        .order('created_at',{ascending:false});
      if (error){ if (reqsMsg) reqsMsg.textContent='Error al cargar solicitudes.'; return; }
      reqs.innerHTML='';
      data.forEach(r=>{
        const card = document.createElement('div');
        card.className='card grid';
        const pre = document.createElement('pre');
        pre.textContent = JSON.stringify(r.payload, null, 2);
        card.append(
          document.createTextNode(`Solicitud #${r.id} — ${new Date(r.created_at).toLocaleString()}`),
          pre
        );
        const act = document.createElement('div');
        act.className='actions';
        const ok = document.createElement('button'); ok.className='btn'; ok.textContent='Aprobar';
        const no = document.createElement('button'); no.className='btn secondary'; no.textContent='Rechazar';
        ok.onclick = ()=>reviewRequest(r.id, true);
        no.onclick = ()=>reviewRequest(r.id, false);
        act.append(ok,no);
        card.append(act);
        reqs.append(card);
      });
    }

    async function reviewRequest(id, approve){
      const { error } = await supabase.rpc('apply_credential_change', { p_request_id: id, p_approve: approve });
      if (error){ if (reqsMsg) reqsMsg.textContent='No se pudo actualizar la solicitud.'; return; }
      await loadRequests();
    }
  }
})();
