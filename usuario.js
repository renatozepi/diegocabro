// usuario.js
(() => {
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (!window.supabase) return console.error('Supabase no inicializado');

    // UI refs (tolerantes a null)
    const btnLogout   = document.getElementById('logout');
    const btnOpen     = document.getElementById('open-portal');
    const btnRefresh  = document.getElementById('refresh');
    const msgPosts    = document.getElementById('posts-msg');

    const inUser      = document.getElementById('rq-username');
    const inNames     = document.getElementById('rq-nombres');
    const inSurnames  = document.getElementById('rq-apellidos');
    const inEmail     = document.getElementById('rq-email');
    const inPass      = document.getElementById('rq-pass');
    const btnSend     = document.getElementById('rq-send');
    const reqMsg      = document.getElementById('reqMsg');

    // listeners seguros
    if (btnLogout) btnLogout.onclick = async () => {
      await supabase.auth.signOut();
      location.href = 'index.html';
    };

    if (btnOpen) btnOpen.onclick = () => location.href = 'posts.html';

    if (btnRefresh) btnRefresh.onclick = async () => {
      if (msgPosts) msgPosts.textContent = 'Actualizando...';
      await loadMyPostsCount();
    };

    if (btnSend) btnSend.onclick = async () => {
      if (reqMsg) reqMsg.textContent = '';
      const payload = {};
      const setIf = (k, v) => { if (v && v.trim && v.trim() !== '') payload[k] = v.trim(); };

      setIf('username',  inUser?.value || '');
      setIf('nombres',   inNames?.value || '');
      setIf('apellidos', inSurnames?.value || '');
      setIf('email',     inEmail?.value?.toLowerCase() || '');
      if (inPass?.value) payload.password = inPass.value;

      if (!Object.keys(payload).length) { if (reqMsg) reqMsg.textContent = 'Nada que enviar.'; return; }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { if (reqMsg) reqMsg.textContent = 'Sesión no válida.'; return; }

      const { error } = await supabase
        .from('credential_change_requests')
        .insert({ user_id: user.id, payload, status: 'pendiente' });

      if (error) { if (reqMsg) reqMsg.textContent = 'No se pudo enviar la solicitud.'; return; }
      if (reqMsg) reqMsg.textContent = 'Solicitud enviada. Pendiente de aprobación.';
      if (inPass) inPass.value = '';
    };

    // precarga perfil y contador
    await prefillProfileForm();
    await loadMyPostsCount();
  }

  async function prefillProfileForm() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from('users_profiles')
      .select('username,nombres,apellidos,email')
      .eq('id', user.id).single();
    if (error || !data) return;
    const s = (id, v) => { const el = document.getElementById(id); if (el && !el.value) el.value = v || ''; };
    s('rq-username',  data.username);
    s('rq-nombres',   data.nombres);
    s('rq-apellidos', data.apellidos);
    s('rq-email',     data.email);
  }

  async function loadMyPostsCount() {
    const { data: { user } } = await supabase.auth.getUser();
    const el = document.getElementById('posts-msg');
    if (!user || !el) return;
    const { count, error } = await supabase
      .from('posts')
      .select('id', { count: 'exact', head: true })
      .eq('author_id', user.id);
    if (error) { el.textContent = 'Error al cargar posts.'; return; }
    el.textContent = `Tienes ${count ?? 0} post(s).`;
  }
})();
