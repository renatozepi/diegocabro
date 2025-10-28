const supabase = window.supabase.createClient(
  "https://krzatkarucysnhoeyipt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyemF0a2FydWN5c25ob2V5aXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MjQxMTMsImV4cCI6MjA3NzIwMDExM30.4SxY8dIKlPSY2LBP-3dtj4f3aOWWiphGK3uR9ZA487g"
);

document.addEventListener("DOMContentLoaded", init);

let PAGE = 0;
const PAGE_SIZE = 10;
let cachedProfiles = new Map(); // id -> username

async function init(){
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { location.href = "index.html"; return; }

  // UI
  const $ = sel => document.querySelector(sel);
  $("#logout").onclick = async ()=>{ await supabase.auth.signOut(); location.href="index.html"; };
  $("#publish").onclick = publishPost;
  $("#btn-search").onclick = ()=>{ PAGE=0; loadPosts(true); };
  $("#btn-clear").onclick = ()=>{ $("#q-text").value=""; $("#q-user").value=""; PAGE=0; loadPosts(true); };
  $("#more").onclick = ()=>{ PAGE++; loadPosts(false); };

  await loadPosts(true);
}

/* -------- data helpers -------- */

function sanitize(s){ const d=document.createElement('div'); d.textContent=s??''; return d.innerHTML; }

async function fetchUsernames(ids){
  const missing = ids.filter(id => !cachedProfiles.has(id));
  if (missing.length){
    const { data } = await supabase.from('users_profiles').select('id,username').in('id', missing);
    (data||[]).forEach(p => cachedProfiles.set(p.id, p.username || 'Anónimo'));
  }
}

async function listPosts({reset=false}={}){
  const qtext = (document.getElementById('q-text').value||'').trim();
  const quser = (document.getElementById('q-user').value||'').trim();

  // base query
  let query = supabase.from('posts').select('id,content,tags,created_at,edited_at,author_id')
                .order('created_at', { ascending:false })
                .range(PAGE*PAGE_SIZE, PAGE*PAGE_SIZE + PAGE_SIZE - 1);

  // filtro texto en post
  if (qtext) query = query.ilike('content', `%${qtext}%`);

  // si hay filtro por usuario, obtén ids y filtra
  let filterIds = null;
  if (quser){
    const { data: pf } = await supabase.from('users_profiles')
      .select('id,username').ilike('username', `%${quser}%`);
    filterIds = (pf||[]).map(p=>p.id);
    if (!filterIds.length) return []; // nada que mostrar
    query = query.in('author_id', filterIds);
  }

  const { data, error } = await query;
  if (error) return [];

  // cachea usernames
  const ids = [...new Set(data.map(p=>p.author_id))];
  await fetchUsernames(ids);

  return data;
}

async function listComments(postId){
  const { data, error } = await supabase
    .from('comments')
    .select('id,post_id,parent_id,author_id,content,created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending:true });
  if (error) return [];

  // cachea usernames
  const ids = [...new Set(data.map(c=>c.author_id))];
  await fetchUsernames(ids);

  // index por id y por parent
  const byId = new Map(data.map(c=>[c.id,c]));
  const children = {};
  data.forEach(c=>{
    const key = c.parent_id || 'root';
    (children[key] ||= []).push(c);
  });
  return { byId, children };
}

/* -------- UI render -------- */

async function loadPosts(reset){
  const wrap = document.getElementById('posts');
  if (reset){ wrap.innerHTML=''; PAGE=0; }

  const posts = await listPosts({reset});
  if (!posts.length && reset){ wrap.innerHTML='<p class="muted">No hay posts.</p>'; return; }

  const frag = document.createDocumentFragment();
  const { data: { user } } = await supabase.auth.getUser();

  posts.forEach(p=>{
    const art = document.createElement('article');
    art.className='post';
    art.setAttribute('role','listitem');

    const uname = cachedProfiles.get(p.author_id) || 'Anónimo';
    const date = new Date(p.created_at).toLocaleString();
    const edited = p.edited_at ? `<span class="post-date"> (editado)</span>` : '';

    const tagHTML = (p.tags||[]).map(t=>`<span class="tag">#${sanitize(t)}</span>`).join(' ');

    art.innerHTML = `
      <div class="post-header">
        <span class="post-username">${sanitize(uname)}</span>
        <span class="post-date">— ${date}${edited}</span>
      </div>
      <div class="post-body">${sanitize(p.content)}</div>
      <div class="tags">${tagHTML}</div>

      <div class="actions">
        <button class="btn ghost" data-act="toggle" aria-expanded="false" aria-controls="thread-${p.id}">
          Mostrar respuestas
        </button>
        ${p.author_id===user.id ? `
          <button class="btn ghost" data-act="edit">Editar</button>
          <button class="btn ghost" data-act="del">Eliminar</button>
        `:''}
      </div>

      <div id="thread-${p.id}" class="thread" hidden></div>

      <div class="reply-box" id="replybox-${p.id}">
        <textarea class="input area" id="reply-${p.id}" placeholder="Responder…"></textarea>
        <div class="actions">
          <button class="btn" data-act="send-reply">Enviar</button>
          <button class="btn ghost" data-act="cancel-reply">Cancelar</button>
        </div>
      </div>
    `;

    // Listeners delegados
    art.addEventListener('click', async (ev)=>{
      const t = ev.target.closest('button'); if(!t) return;
      const act = t.dataset.act;

      if (act==='toggle'){
        const thread = art.querySelector(`#thread-${p.id}`);
        const expanded = t.getAttribute('aria-expanded')==='true';
        if (expanded){
          thread.hidden = true;
          t.setAttribute('aria-expanded','false');
          t.textContent='Mostrar respuestas';
        } else {
          await renderThread(p.id, thread);
          thread.hidden = false;
          t.setAttribute('aria-expanded','true');
          t.textContent='Ocultar respuestas';
        }
      }

      if (act==='edit'){
        const curr = art.querySelector('.post-body').textContent;
        const next = prompt('Nuevo contenido:', curr);
        if (!next || next.trim()===curr) return;
        await supabase.from('posts').update({ content: next.trim(), edited_at:new Date().toISOString() }).eq('id', p.id);
        await loadPosts(true);
      }

      if (act==='del'){
        if (!confirm('¿Eliminar post?')) return;
        await supabase.from('posts').delete().eq('id', p.id);
        await loadPosts(true);
      }

      if (act==='send-reply'){
        const area = art.querySelector(`#reply-${p.id}`);
        const text = (area?.value||'').trim(); if (!text) return;
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('comments').insert({ post_id:p.id, parent_id:null, author_id:user.id, content:text });
        // Oculta el input tras enviar
        const box = art.querySelector(`#replybox-${p.id}`);
        if (box){ box.classList.remove('active'); area.value=''; }
        // refresca hilo si visible
        const toggleBtn = art.querySelector('[data-act="toggle"]');
        if (toggleBtn && toggleBtn.getAttribute('aria-expanded')==='true'){
          const thread = art.querySelector(`#thread-${p.id}`);
          await renderThread(p.id, thread);
        }
      }

      if (act==='cancel-reply'){
        const box = art.querySelector(`#replybox-${p.id}`);
        const area = art.querySelector(`#reply-${p.id}`);
        if (box){ box.classList.remove('active'); }
        if (area){ area.value=''; }
      }
    });

    // abrir caja de respuesta al enfocar
    const postBody = art.querySelector('.post-body');
    postBody.addEventListener('click', ()=>{
      const box = art.querySelector(`#replybox-${p.id}`);
      box.classList.add('active');
    });

    frag.appendChild(art);
  });

  if (reset) wrap.innerHTML='';
  wrap.appendChild(frag);
}

/* ----- render de hilos anidados (colapsables) ----- */
async function renderThread(postId, mount){
  mount.innerHTML = '<p class="muted">Cargando…</p>';
  const tree = await listComments(postId);
  const root = tree.children['root'] || [];

  const makeNode = (c, depth=0)=>{
    const uname = cachedProfiles.get(c.author_id) || 'Anónimo';
    const node = document.createElement('div');
    node.className='comment';

    node.innerHTML = `
      <div class="meta"><strong>${sanitize(uname)}</strong> — ${new Date(c.created_at).toLocaleString()}</div>
      <div class="body">${sanitize(c.content)}</div>
      <div class="actions">
        <button class="btn ghost" data-act="toggle-children" aria-expanded="false" aria-controls="children-${c.id}">
          Mostrar respuestas
        </button>
        <button class="btn ghost" data-act="reply" data-id="${c.id}">Responder</button>
      </div>
      <div id="children-${c.id}" class="thread" hidden></div>
      <div class="reply-box" id="replybox-${c.id}">
        <textarea class="input area" id="reply-${c.id}" placeholder="Responder…"></textarea>
        <div class="actions">
          <button class="btn" data-act="send-child" data-id="${c.id}">Enviar</button>
          <button class="btn ghost" data-act="cancel-child" data-id="${c.id}">Cancelar</button>
        </div>
      </div>
    `;

    // eventos del nodo
    node.addEventListener('click', async ev=>{
      const btn = ev.target.closest('button'); if(!btn) return;
      const act = btn.dataset.act;
      const cid = btn.dataset.id;

      if (act==='toggle-children'){
        const box = node.querySelector(`#children-${c.id}`);
        const expanded = btn.getAttribute('aria-expanded')==='true';
        if (expanded){ box.hidden=true; btn.setAttribute('aria-expanded','false'); btn.textContent='Mostrar respuestas'; }
        else {
          // render hijos si no renderizados
          const kids = tree.children[c.id] || [];
          box.innerHTML='';
          kids.forEach(k=> box.appendChild(makeNode(k, depth+1)));
          box.hidden=false; btn.setAttribute('aria-expanded','true'); btn.textContent='Ocultar respuestas';
        }
      }

      if (act==='reply'){
        node.querySelector(`#replybox-${c.id}`).classList.add('active');
      }

      if (act==='cancel-child'){
        const area = node.querySelector(`#reply-${c.id}`); if (area) area.value='';
        node.querySelector(`#replybox-${c.id}`).classList.remove('active');
      }

      if (act==='send-child'){
        const area = node.querySelector(`#reply-${c.id}`);
        const text = (area?.value||'').trim(); if (!text) return;
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('comments').insert({ post_id:postId, parent_id:cid, author_id:user.id, content:text });
        // Oculta input tras enviar
        node.querySelector(`#replybox-${c.id}`).classList.remove('active');
        if (area) area.value='';
        // si el contenedor de hijos está abierto, re-render
        const tbtn = node.querySelector('[data-act="toggle-children"]');
        if (tbtn && tbtn.getAttribute('aria-expanded')==='true'){
          const box = node.querySelector(`#children-${c.id}`);
          const kids = (await supabase
            .from('comments')
            .select('id,post_id,parent_id,author_id,content,created_at')
            .eq('post_id', postId).eq('parent_id', cid)
            .order('created_at', { ascending:true })).data || [];
          await fetchUsernames([...new Set(kids.map(k=>k.author_id))]);
          box.innerHTML='';
          kids.forEach(k=> box.appendChild(makeNode(k, depth+1)));
        }
      }
    });

    return node;
  };

  mount.innerHTML='';
  root.forEach(c => mount.appendChild(makeNode(c, 0)));
}

/* ----- crear post ----- */
async function publishPost(){
  const msg = document.getElementById('post-msg');
  msg.textContent='';
  const content = (document.getElementById('post-content').value||'').trim();
  const tagsStr = (document.getElementById('tags').value||'').trim();

  if (!content){ msg.textContent='El contenido no puede estar vacío.'; return; }

  const tagArr = tagsStr
    ? [...new Set(tagsStr.split(',').map(t=>t.trim().toLowerCase()).filter(Boolean))].slice(0,5)
    : [];

  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from('posts').insert({ author_id:user.id, content, tags:tagArr });

  if (error){ msg.textContent='Error al publicar.'; return; }

  document.getElementById('post-content').value='';
  document.getElementById('tags').value='';
  msg.textContent='Publicado.';
  await loadPosts(true);
}
