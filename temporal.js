const supabase = window.supabase.createClient(
  "https://krzatkarucysnhoeyipt.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtyemF0a2FydWN5c25ob2V5aXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MjQxMTMsImV4cCI6MjA3NzIwMDExM30.4SxY8dIKlPSY2LBP-3dtj4f3aOWWiphGK3uR9ZA487g"
);

const email = sessionStorage.getItem("onboarding_email");
document.getElementById("detected-email").textContent = email ? `Correo detectado: ${email}` : "Correo no detectado";

document.getElementById("guardar").onclick = async () => {
  const username = document.getElementById("username").value.trim();
  const password = document.getElementById("password").value.trim();
  const password2 = document.getElementById("password2").value.trim();
  const nombres = document.getElementById("nombres").value.trim();
  const apellidos = document.getElementById("apellidos").value.trim();
  const msg = document.getElementById("msg");

  msg.textContent = "";

  if (!username || !password || !password2 || !nombres || !apellidos) {
    msg.textContent = "Completa todos los campos.";
    return;
  }
  if (password !== password2) {
    msg.textContent = "Las contraseñas no coinciden.";
    return;
  }
  if (password.length < 8) {
    msg.textContent = "La contraseña debe tener al menos 8 caracteres.";
    return;
  }

  try {
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
      options: {
        data: { username, nombres, apellidos },
        emailRedirectTo: `${location.origin}/index.html` // ruta a la app
      }
    });

    if (error) throw error;

    // oculta el formulario y muestra pantalla de espera
    document.getElementById("form-container").style.display = "none";
    document.getElementById("waiting").style.display = "block";

    // inserta el perfil en users_profiles si el registro ya genera id
    if (data?.user) {
      await supabase.from("users_profiles").upsert({
        id: data.user.id,
        email,
        username,
        nombres,
        apellidos,
        rol: "user"
      });
    }

  } catch (err) {
    console.error(err);
    msg.textContent = "Error: " + err.message;
  }
};
