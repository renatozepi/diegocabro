// Accesibilidad: tabs
const tabPass = document.getElementById('tab-pass');
const tabCode = document.getElementById('tab-code');
const panelPass = document.getElementById('panel-pass');
const panelCode = document.getElementById('panel-code');

function activateTab(which){
  const isPass = which === 'pass';
  tabPass.classList.toggle('active', isPass);
  tabCode.classList.toggle('active', !isPass);
  tabPass.setAttribute('aria-selected', String(isPass));
  tabCode.setAttribute('aria-selected', String(!isPass));
  panelPass.hidden = !isPass;
  panelCode.hidden = isPass;
}
tabPass.addEventListener('click', ()=>activateTab('pass'));
tabCode.addEventListener('click', ()=>activateTab('code'));

// Controles contraseña
const ident = document.getElementById('ident');
const password = document.getElementById('password');
const remember = document.getElementById('remember');
const togglePw = document.getElementById('togglePw');
const btnLogin = document.getElementById('btnLogin');
const msgPass = document.getElementById('msgPass');

togglePw.addEventListener('click', ()=>{
  const isPwd = password.type === 'password';
  password.type = isPwd ? 'text' : 'password';
  togglePw.setAttribute('aria-pressed', String(isPwd));
  togglePw.textContent = isPwd ? 'Ocultar contraseña' : 'Mostrar contraseña';
});

// Código temporal
const codeEmail = document.getElementById('code-email');
const code = document.getElementById('code');
const btnCode = document.getElementById('btnCode');
const msgCode = document.getElementById('msgCode');

// Util: mapeo usuario/correo
async function resolveEmail(identifier){
  // Si ya parece correo, devolver
  if (/^[^@]+@[^@]+\.[^@]+$/.test(identifier)) return identifier.trim();
  // Si es username, consultamos función SQL
  const { data, error } = await window.supabase.rpc('find_email_by_identifier', { p_identifier: identifier.trim() });
  if (error) throw new Error('No se pudo resolver el usuario.');
  if (!data || !data.email) throw new Error('Usuario no encontrado.');
  return data.email;
}

// Redirección por rol
async function redirectByRole(){
  const { data: { user } } = await window.supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await window.supabase
    .from('users_profiles')
    .select('rol')
    .eq('id', user.id)
    .single();
  if (error) {
    // Si no hay perfil todavía, enviamos al portal de usuario por defecto
    window.location.href = 'usuario.html';
    return;
  }
  if (data.rol === 'admin') window.location.href = 'admin.html';
  else window.location.href = 'usuario.html';
}

// Inicio con contraseña
btnLogin.addEventListener('click', async ()=>{
  msgPass.textContent = '';
  try{
    const idt = ident.value.trim();
    if (!idt){
      msgPass.textContent = 'Usuario no encontrado.';
      return;
    }
    if (!password.value){
      msgPass.textContent = 'Campo de contraseña vacío.';
      return;
    }
    const email = await resolveEmail(idt);

    // Persistencia de sesión
    await window.supabase.auth.setSession({ access_token: null, refresh_token: null }); // noop para limpiar estados raros
    const { data, error } = await window.supabase.auth.signInWithPassword({
      email,
      password: password.value
    });

    if (error){
      if (error.message.match(/Invalid login credentials/i)) {
        msgPass.textContent = 'Contraseña incorrecta.';
      } else if (error.message.match(/Email not confirmed/i)) {
        msgPass.textContent = 'Correo no verificado. Revise su bandeja.';
      } else {
        msgPass.textContent = 'No se pudo iniciar sesión.';
      }
      return;
    }

    // Recuérdame: Supabase ya persiste por defecto en localStorage. Si quieres "no recordar", limpiamos al salir.
    localStorage.setItem('remember_me', remember.checked ? '1' : '0');

    await redirectByRole();
  }catch(e){
    msgPass.textContent = e.message || 'Error inesperado.';
  }
});

// Acceso con código temporal (primer ingreso)
btnCode.addEventListener('click', async ()=>{
  msgCode.textContent = '';
  const email = codeEmail.value.trim();
  const plain = code.value.trim();
  if (!email){
    msgCode.textContent = 'Ingrese su correo.';
    return;
  }
  if (!/^[A-Za-z]{10}$/.test(plain)){
    msgCode.textContent = 'Código temporal inválido.';
    return;
  }
  try{
    const { data, error } = await window.supabase.rpc('validate_temp_code', {
      p_email: email,
      p_code: plain
    });
    if (error) {
      msgCode.textContent = 'No se pudo validar el código.';
      return;
    }
    if (!data || data.status !== 'ok'){
      // Estados posibles: invalid, expired, used
      const map = { invalid:'Código temporal inválido.', expired:'Código temporal expirado.', used:'Código temporal ya usado.' };
      msgCode.textContent = map[data?.status] || 'Código temporal inválido.';
      return;
    }
    // Guardamos el correo para el paso de registro en temporal.html
    sessionStorage.setItem('onboarding_email', email);
    // Bandera de que viene de código verificado
    sessionStorage.setItem('onboarding_token', data.token_hint || '1');
    window.location.href = 'temporal.html';
  }catch(e){
    msgCode.textContent = 'Error al validar el código.';
  }
});

// Al cargar, si ya hay sesión válida, redirigir
window.addEventListener('DOMContentLoaded', async ()=>{
  const { data: { session } } = await window.supabase.auth.getSession();
  if (session) await redirectByRole();
});
