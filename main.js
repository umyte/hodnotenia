// main.js
import { supabase } from './supabaseClient.js';

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const roleSelect = document.getElementById('role');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const msgEl = document.getElementById('message');

function setMessage(text, type = 'ok') {
  msgEl.textContent = text;
  msgEl.className = 'msg ' + type;
}

async function redirectByRole(user) {
  const { data: profileData, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || !profileData) {
    console.error('Profile load error:', profileError);
    setMessage('Prihlásený, ale nepodarilo sa načítať rolu.', 'error');
    return;
  }

  const userRole = profileData.role;

  if (userRole === 'admin') {
    window.location.href = 'admin.html';
  } else if (userRole === 'agency') {
    window.location.href = 'agency.html';
  } else if (userRole === 'judge') {
    window.location.href = 'judge.html';
  } else {
    setMessage('Neznáma rola používateľa.', 'error');
  }
}

// LOGIN existujúceho účtu
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    setMessage('Zadaj e‑mail aj heslo.', 'error');
    return;
  }

  loginBtn.disabled = true;
  registerBtn.disabled = true;
  setMessage('Prihlasujem...', 'ok');

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  console.log('LOGIN result:', { data, error });

  if (error) {
    setMessage('Login zlyhal: ' + error.message, 'error');
    loginBtn.disabled = false;
    registerBtn.disabled = false;
    return;
  }

  if (!data.user) {
    setMessage('Login zlyhal: používateľ neexistuje.', 'error');
    loginBtn.disabled = false;
    registerBtn.disabled = false;
    return;
  }

  setMessage('Login OK, načítavam rolu...', 'ok');
  await redirectByRole(data.user);

  loginBtn.disabled = false;
  registerBtn.disabled = false;
});

// REGISTRÁCIA nového účtu
registerBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const role = roleSelect.value;

  if (!email || !password) {
    setMessage('Zadaj e‑mail aj heslo.', 'error');
    return;
  }

  loginBtn.disabled = true;
  registerBtn.disabled = true;
  setMessage('Registrujem nový účet...', 'ok');

  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  console.log('REGISTER result:', { signUpData, signUpError });

  if (signUpError) {
    setMessage('Registrácia zlyhala: ' + signUpError.message, 'error');
    loginBtn.disabled = false;
    registerBtn.disabled = false;
    return;
  }

  const user = signUpData.user;

  if (user) {
    // skontroluj, či už profil neexistuje
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          role: role
        });

      if (profileError) {
        console.error('Profile insert error:', profileError);
        setMessage('Účet vytvorený, ale nepodarilo sa uložiť rolu: ' + profileError.message, 'error');
        loginBtn.disabled = false;
        registerBtn.disabled = false;
        return;
      }
    }
  }

  setMessage(`Vytvorený nový účet (${role}). Skontroluj mail (${email}) na potvrdenie.`, 'ok');
  loginBtn.disabled = false;
  registerBtn.disabled = false;
});
