// agency.js
import { supabase } from './supabaseClient.js';

const contestSelect = document.getElementById('contestSelect');
const categorySelect = document.getElementById('categorySelect');
const roundSelect = document.getElementById('roundSelect');

const titleInput = document.getElementById('title');
const clientInput = document.getElementById('client');
const mediaTypeSelect = document.getElementById('mediaType');
const creativeFileInput = document.getElementById('creativeFile');
const notesInput = document.getElementById('notes');
const saveBtn = document.getElementById('saveEntryBtn');
const msgEl = document.getElementById('message');
const entriesContainer = document.getElementById('entriesContainer');


const STORAGE_BUCKET = 'creatives'; // názov bucketu v Supabase Storage

function setMessage(text, type = 'ok') {
  msgEl.textContent = text;
  msgEl.className = 'msg ' + type;
}

async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  console.log('getUser:', { data, error });
  if (error || !data?.user) {
    return null;
  }
  return data.user;
}

async function loadContestsCategoriesRounds() {
  const { data: contests, error: contestsError } = await supabase
    .from('contests')
    .select('*')
    .order('created_at', { ascending: false });

  contestSelect.innerHTML = '';
  categorySelect.innerHTML = '';
  roundSelect.innerHTML = '';

  if (contestsError) {
    console.error('load contests error:', contestsError);
    contestSelect.innerHTML = '<option value="">Chyba pri načítaní súťaží</option>';
    return;
  }

  if (!contests || contests.length === 0) {
    contestSelect.innerHTML = '<option value="">Žiadne súťaže, kontaktuj admina</option>';
    return;
  }

  contests.forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.name;
    contestSelect.appendChild(opt);
  });

  await loadCategoriesForContest();
  await loadRoundsForContest();
}

async function loadCategoriesForContest() {
  const contestId = contestSelect.value;
  categorySelect.innerHTML = '';

  if (!contestId) {
    categorySelect.innerHTML = '<option value="">Vyber súťaž</option>';
    return;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('load categories error:', error);
    categorySelect.innerHTML = '<option value="">Chyba pri načítaní kategórií</option>';
    return;
  }

  if (!data || data.length === 0) {
    categorySelect.innerHTML = '<option value="">Žiadne kategórie v tejto súťaži</option>';
    return;
  }

  data.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });
}

async function loadRoundsForContest() {
  const contestId = contestSelect.value;
  roundSelect.innerHTML = '';

  if (!contestId) {
    roundSelect.innerHTML = '<option value="">Vyber súťaž</option>';
    return;
  }

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('load rounds error:', error);
    roundSelect.innerHTML = '<option value="">Chyba pri načítaní kôl</option>';
    return;
  }

  if (!data || data.length === 0) {
    roundSelect.innerHTML = '<option value="">Žiadne kolá v tejto súťaži</option>';
    return;
  }

  data.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    roundSelect.appendChild(opt);
  });
}

async function loadEntries(user) {
  entriesContainer.innerHTML = 'Načítavam kampane...';

  const { data, error } = await supabase
    .from('entries')
    .select(`
      *,
      contests ( name ),
      categories ( name ),
      rounds ( name )
    `)
    .eq('agency_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('loadEntries error:', error);
    entriesContainer.textContent = 'Nepodarilo sa načítať kampane.';
    return;
  }

  if (!data || data.length === 0) {
    entriesContainer.textContent = 'Zatiaľ nemáš žiadne kampane.';
    return;
  }

  entriesContainer.innerHTML = '';
  data.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'entry-item';

    const contestName = entry.contests?.name || '-';
    const categoryName = entry.categories?.name || '-';
    const roundName = entry.rounds?.name || '-';

    let creativeHtml = '';
    const videoHtml = entry.video_url
      ? `<div><strong>Video URL:</strong> <a href="${entry.video_url}" target="_blank">${entry.video_url}</a></div>`
      : '';
    if (entry.creative_url) {
      if (entry.media_type === 'banner') {
        creativeHtml = `<div><strong>Náhľad:</strong><br><img src="${entry.creative_url}" alt="creative" style="max-width:200px;max-height:100px;object-fit:contain;border:1px solid #ccc;border-radius:4px;margin-top:4px;"></div>`;
      } else {
        creativeHtml = `<div><a href="${entry.creative_url}" target="_blank">Otvoriť kreatívu</a></div>`;
      }
    }

    div.innerHTML = `
      <div><strong>Súťaž:</strong> ${contestName}</div>
      <div><strong>Kategória:</strong> ${categoryName}</div>
      <div><strong>Kolo:</strong> ${roundName}</div>
      <div><strong>Názov:</strong> ${entry.title}</div>
      <div><strong>Klient:</strong> ${entry.client || '-'}</div>
      <div><strong>Typ:</strong> ${entry.media_type}</div>
      ${creativeHtml}
      ${videoHtml}
      <div><strong>Vytvorené:</strong> ${new Date(entry.created_at).toLocaleString()}</div>
      <div>
  <button class="delete-entry-btn" data-entry-id="${entry.id}" data-creative-url="${entry.creative_url || ''}">
    Zmazať
  </button>
</div>

    `;
    entriesContainer.appendChild(div);
  });
}

async function uploadCreativeFile(user, contestId, entryId) {
  const file = creativeFileInput.files[0];
  if (!file) return null;

  // log pre kontrolu
  console.log('Uploading file:', {
    name: file.name,
    size: file.size,
    type: file.type
  });

  // 1) odstránime diakritiku a nahradíme nepovolené znaky
  const originalName = file.name;
  const normalized = originalName
    .normalize('NFD')                  // rozbij diakritiku
    .replace(/[\u0300-\u036f]/g, '');  // vyhoď diakritiku
  const safeName = normalized
    .replace(/[^\w.\-]/g, '_');        // všetko okrem písmen, číslic, _.- na _

  // 2) postavíme cestu bez medzier a divných znakov
  const path = `${contestId}/${entryId}/${Date.now()}_${safeName}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true
    });

  console.log('upload result:', { data, error });

  if (error) {
    console.error('upload error:', error);
    throw error;
  }

  const { data: publicUrlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(path);

  return publicUrlData.publicUrl;
}


saveBtn.addEventListener('click', async () => {
  const title = titleInput.value.trim();
  const client = clientInput.value.trim();
  const mediaType = mediaTypeSelect.value;
  const notes = notesInput.value.trim();
  const contestId = contestSelect.value;
  const categoryId = categorySelect.value;
  const roundId = roundSelect.value;

  if (!contestId) {
    setMessage('Vyber súťaž.', 'error');
    return;
  }
  if (!categoryId) {
    setMessage('Vyber kategóriu.', 'error');
    return;
  }
  if (!roundId) {
    setMessage('Vyber kolo.', 'error');
    return;
  }
  if (!title) {
    setMessage('Názov kampane je povinný.', 'error');
    return;
  }

  saveBtn.disabled = true;
  setMessage('Ukladám kampaň...', 'ok');

  const user = await getCurrentUser();
  if (!user) {
    setMessage('Nie si prihlásený. Skús sa znova prihlásiť.', 'error');
    saveBtn.disabled = false;
    return;
  }

const videoUrlInput = document.getElementById('videoUrl');

  // 1) najprv vytvoríme entry bez creative_url
  const { data: inserted, error: insertError } = await supabase
    .from('entries')
    .insert({
      agency_id: user.id,
      contest_id: contestId,
      category_id: categoryId,
      round_id: roundId,
      title,
      client,
      media_type: mediaType,
      notes,
      creative_url: null,
      video_url: videoUrl
    })
    .select()
    .single();

  console.log('insert entry:', { inserted, insertError });

  if (insertError || !inserted) {
    setMessage('Nepodarilo sa uložiť kampaň: ' + (insertError?.message || ''), 'error');
    saveBtn.disabled = false;
    return;
  }

  let creativeUrl = null;

  try {
    if (creativeFileInput.files[0]) {
      creativeUrl = await uploadCreativeFile(user, contestId, inserted.id);

      const { error: updateError } = await supabase
        .from('entries')
        .update({ creative_url: creativeUrl })
        .eq('id', inserted.id);

      if (updateError) {
        console.error('update creative_url error:', updateError);
        setMessage('Kampaň uložená, ale nastal problém pri ukladaní URL kreatívy.', 'error');
        saveBtn.disabled = false;
        await loadEntries(user);
        return;
      }
    }
  } catch (e) {
    console.error('uploadCreativeFile error:', e);
    setMessage('Kampaň uložená, ale upload súboru zlyhal.', 'error');
    saveBtn.disabled = false;
    await loadEntries(user);
    return;
  }

  setMessage('Kampaň uložená.', 'ok');

  titleInput.value = '';
  clientInput.value = '';
  notesInput.value = '';
  creativeFileInput.value = '';
    videoUrlInput.value = '';


  saveBtn.disabled = false;

  await loadEntries(user);
});

// pri načítaní stránky
(async () => {
  const user = await getCurrentUser();
  if (!user) {
    setMessage('Nie si prihlásený. Vráť sa na login.', 'error');
    return;
  }

  await loadContestsCategoriesRounds();
  await loadEntries(user);

  contestSelect.addEventListener('change', async () => {
    await loadCategoriesForContest();
    await loadRoundsForContest();
  });

  // mazanie kampaní (delegovaný handler na container)
  entriesContainer.addEventListener('click', async (e) => {
    const btn = e.target.closest('.delete-entry-btn');
    if (!btn) return;

    const entryId = btn.dataset.entryId;
    const creativeUrl = btn.dataset.creativeUrl;

    if (!confirm('Naozaj chceš zmazať túto kampaň?')) return;

    const currentUser = await getCurrentUser();
    if (!currentUser) {
      setMessage('Nie si prihlásený.', 'error');
      return;
    }

    // 1) ak je kreatíva, odstráň súbor zo Storage
    if (creativeUrl) {
      try {
        const parts = creativeUrl.split('/creatives/');
        if (parts.length === 2) {
          const path = parts[1];
          const { error: removeError } = await supabase.storage
            .from(STORAGE_BUCKET)
            .remove([path]);
          if (removeError) {
            console.error('storage remove error:', removeError);
          }
        }
      } catch (err) {
        console.error('parse/remove creative error:', err);
      }
    }

    // 2) zmaž riadok v entries
    const { error: deleteError } = await supabase
      .from('entries')
      .delete()
      .eq('id', entryId)
      .eq('agency_id', currentUser.id);

    if (deleteError) {
      console.error('delete entry error:', deleteError);
      setMessage('Nepodarilo sa zmazať kampaň.', 'error');
      return;
    }

    setMessage('Kampaň zmazaná.', 'ok');
    await loadEntries(currentUser);
  });
})();
