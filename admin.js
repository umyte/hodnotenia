// admin.js - KOMPLETNÝ SÚBOR
import { supabase } from './supabaseClient.js';

// Súťaže
const contestNameInput = document.getElementById('contestName');
const contestYearInput = document.getElementById('contestYear');
const createContestBtn = document.getElementById('createContestBtn');
const contestMsgEl = document.getElementById('contestMsg');
const contestListEl = document.getElementById('contestList');

// Kategórie
const categoryContestSelect = document.getElementById('categoryContestSelect');
const categoryNameInput = document.getElementById('categoryName');
const createCategoryBtn = document.getElementById('createCategoryBtn');
const categoryMsgEl = document.getElementById('categoryMsg');
const categoryListEl = document.getElementById('categoryList');

// Kolá
const roundContestSelect = document.getElementById('roundContestSelect');
const roundNameInput = document.getElementById('roundName');
const roundStartInput = document.getElementById('roundStart');
const roundEndInput = document.getElementById('roundEnd');
const createRoundBtn = document.getElementById('createRoundBtn');
const roundMsgEl = document.getElementById('roundMsg');
const roundListEl = document.getElementById('roundList');

// Výsledky v kategórii
const resultsContestSelect = document.getElementById('resultsContestSelect');
const resultsRoundSelect = document.getElementById('resultsRoundSelect');
const resultsCategorySelect = document.getElementById('resultsCategorySelect');
const resultsMsgEl = document.getElementById('resultsMsg');
const resultsEntriesListEl = document.getElementById('resultsEntriesList');

// Modálne okno
const editModal = document.getElementById('editModal');
const editModalTitle = document.getElementById('editModalTitle');
const editModalBody = document.getElementById('editModalBody');
const editModalSaveBtn = document.getElementById('editModalSaveBtn');

// Globálne stav pre edit
let editState = {
  type: null,
  id: null,
  data: {}
};

function setMessage(el, text, type = 'ok') {
  el.textContent = text;
  el.className = 'msg ' + type;
}

function showEditModal(title, content) {
  editModalTitle.textContent = title;
  editModalBody.innerHTML = content;
  editModal.classList.add('show');
}

function closeEditModal() {
  editModal.classList.remove('show');
  editState = { type: null, id: null, data: {} };
}

async function saveEdit() {
  const { type, id, data } = editState;
  if (!type || !id) return;

  editModalSaveBtn.disabled = true;

  try {
    switch (type) {
      case 'contest': {
        const name = document.getElementById('editContestName')?.value.trim();
        const year = document.getElementById('editContestYear')?.value.trim();
        if (!name) {
          alert('Názov súťaže je povinný.');
          editModalSaveBtn.disabled = false;
          return;
        }
        const { error } = await supabase
          .from('contests')
          .update({ name, year: year ? parseInt(year, 10) : null })
          .eq('id', id);
        if (error) throw error;
        closeEditModal();
        await loadContests();
        setMessage(contestMsgEl, 'Súťaž upravená.', 'ok');
        break;
      }
      case 'category': {
        const name = document.getElementById('editCategoryName')?.value.trim();
        if (!name) {
          alert('Názov kategórie je povinný.');
          editModalSaveBtn.disabled = false;
          return;
        }
        const { error } = await supabase
          .from('categories')
          .update({ name })
          .eq('id', id);
        if (error) throw error;
        closeEditModal();
        await loadCategoriesForSelectedContest();
        await loadResultsCategories();
        setMessage(categoryMsgEl, 'Kategória upravená.', 'ok');
        break;
      }
      case 'round': {
        const name = document.getElementById('editRoundName')?.value.trim();
        const startAt = document.getElementById('editRoundStart')?.value
          ? new Date(document.getElementById('editRoundStart').value).toISOString()
          : null;
        const endAt = document.getElementById('editRoundEnd')?.value
          ? new Date(document.getElementById('editRoundEnd').value).toISOString()
          : null;
        if (!name) {
          alert('Názov kola je povinný.');
          editModalSaveBtn.disabled = false;
          return;
        }
        const { error } = await supabase
          .from('rounds')
          .update({ name, start_at: startAt, end_at: endAt })
          .eq('id', id);
        if (error) throw error;
        closeEditModal();
        await loadRoundsForSelectedContest();
        await loadResultsRounds();
        setMessage(roundMsgEl, 'Kolo upravené.', 'ok');
        break;
      }
      case 'entry': {
        const title = document.getElementById('editEntryTitle')?.value.trim();
        const client = document.getElementById('editEntryClient')?.value.trim();
        const notes = document.getElementById('editEntryNotes')?.value.trim();
        if (!title) {
          alert('Názov kampane je povinný.');
          editModalSaveBtn.disabled = false;
          return;
        }
        const { error } = await supabase
          .from('entries')
          .update({ title, client, notes })
          .eq('id', id);
        if (error) throw error;
        closeEditModal();
        await loadResultsEntries();
        setMessage(resultsMsgEl, 'Kampaň upravená.', 'ok');
        break;
      }
    }
  } catch (error) {
    console.error('saveEdit error:', error);
    alert('Chyba pri ukladaní: ' + error.message);
  }

  editModalSaveBtn.disabled = false;
}

// MAZANIE FUNKCIÍ

async function deleteContest(contestId, contestName) {
  if (!confirm(`Naozaj chceš zmazať súťaž "${contestName}"? Vymaže sa všetko (kategórie, kolá, kampane, hlasy)!`)) {
    return;
  }

  try {
    // 1. Zmaž všetky votes pre entries v tejto súťaži
    const { data: entries } = await supabase
      .from('entries')
      .select('id, creative_url')
      .eq('contest_id', contestId);

    if (entries && entries.length > 0) {
      const entryIds = entries.map(e => e.id);
      await supabase
        .from('votes')
        .delete()
        .in('entry_id', entryIds);

      // 2. Zmaž entries a ich Storage súbory
      for (const entry of entries) {
        if (entry.creative_url) {
          try {
            const parts = entry.creative_url.split('/creatives/');
            if (parts.length === 2) {
              await supabase.storage
                .from('creatives')
                .remove([parts[1]]);
            }
          } catch (e) {
            console.error('storage remove error:', e);
          }
        }
      }

      await supabase
        .from('entries')
        .delete()
        .eq('contest_id', contestId);
    }

    // 3. Zmaž všetky rounds v tejto súťaži
    await supabase
      .from('rounds')
      .delete()
      .eq('contest_id', contestId);

    // 4. Zmaž všetky categories v tejto súťaži
    await supabase
      .from('categories')
      .delete()
      .eq('contest_id', contestId);

    // 5. Zmaž samotnú súťaž
    const { error } = await supabase
      .from('contests')
      .delete()
      .eq('id', contestId);

    if (error) throw error;

    setMessage(contestMsgEl, 'Súťaž a všetko viazané bolo zmazané.', 'ok');
    await loadContests();
    await loadResultsRounds();
    await loadResultsCategories();
    await loadResultsEntries();
  } catch (error) {
    console.error('deleteContest error:', error);
    setMessage(contestMsgEl, 'Chyba pri mazaní: ' + error.message, 'error');
  }
}

async function deleteCategory(categoryId, categoryName) {
  if (!confirm(`Naozaj chceš zmazať kategóriu "${categoryName}"? Vymaže sa všetko v nej!`)) {
    return;
  }

  try {
    // 1. Zmaž votes pre entries v tejto kategórii
    const { data: entries } = await supabase
      .from('entries')
      .select('id, creative_url')
      .eq('category_id', categoryId);

    if (entries && entries.length > 0) {
      const entryIds = entries.map(e => e.id);
      await supabase
        .from('votes')
        .delete()
        .in('entry_id', entryIds);

      // 2. Zmaž entries a Storage súbory
      for (const entry of entries) {
        if (entry.creative_url) {
          try {
            const parts = entry.creative_url.split('/creatives/');
            if (parts.length === 2) {
              await supabase.storage
                .from('creatives')
                .remove([parts[1]]);
            }
          } catch (e) {
            console.error('storage remove error:', e);
          }
        }
      }

      await supabase
        .from('entries')
        .delete()
        .eq('category_id', categoryId);
    }

    // 3. Zmaž samotnú kategóriu
    const { error } = await supabase
      .from('categories')
      .delete()
      .eq('id', categoryId);

    if (error) throw error;

    setMessage(categoryMsgEl, 'Kategória a všetko viazané bolo zmazané.', 'ok');
    await loadCategoriesForSelectedContest();
    await loadResultsCategories();
    await loadResultsEntries();
  } catch (error) {
    console.error('deleteCategory error:', error);
    setMessage(categoryMsgEl, 'Chyba pri mazaní: ' + error.message, 'error');
  }
}

async function deleteRound(roundId, roundName) {
  if (!confirm(`Naozaj chceš zmazať kolo "${roundName}"? Vymaže sa všetko v ňom!`)) {
    return;
  }

  try {
    // 1. Zmaž votes pre entries v tomto kole
    const { data: entries } = await supabase
      .from('entries')
      .select('id, creative_url')
      .eq('round_id', roundId);

    if (entries && entries.length > 0) {
      const entryIds = entries.map(e => e.id);
      await supabase
        .from('votes')
        .delete()
        .in('entry_id', entryIds);

      // 2. Zmaž entries a Storage súbory
      for (const entry of entries) {
        if (entry.creative_url) {
          try {
            const parts = entry.creative_url.split('/creatives/');
            if (parts.length === 2) {
              await supabase.storage
                .from('creatives')
                .remove([parts[1]]);
            }
          } catch (e) {
            console.error('storage remove error:', e);
          }
        }
      }

      await supabase
        .from('entries')
        .delete()
        .eq('round_id', roundId);
    }

    // 3. Zmaž samotné kolo
    const { error } = await supabase
      .from('rounds')
      .delete()
      .eq('id', roundId);

    if (error) throw error;

    setMessage(roundMsgEl, 'Kolo a všetko viazané bolo zmazané.', 'ok');
    await loadRoundsForSelectedContest();
    await loadResultsRounds();
    await loadResultsEntries();
  } catch (error) {
    console.error('deleteRound error:', error);
    setMessage(roundMsgEl, 'Chyba pri mazaní: ' + error.message, 'error');
  }
}

async function deleteEntry(entryId, entryTitle, creativeUrl) {
  if (!confirm(`Naozaj chceš zmazať kampaň "${entryTitle}"?`)) {
    return;
  }

  try {
    // 1. Zmaž votes
    await supabase
      .from('votes')
      .delete()
      .eq('entry_id', entryId);

    // 2. Zmaž Storage súbor ak existuje
    if (creativeUrl) {
      try {
        const parts = creativeUrl.split('/creatives/');
        if (parts.length === 2) {
          await supabase.storage
            .from('creatives')
            .remove([parts[1]]);
        }
      } catch (e) {
        console.error('storage remove error:', e);
      }
    }

    // 3. Zmaž entry
    const { error } = await supabase
      .from('entries')
      .delete()
      .eq('id', entryId);

    if (error) throw error;

    setMessage(resultsMsgEl, 'Kampaň zmazaná.', 'ok');
    await loadResultsEntries();
  } catch (error) {
    console.error('deleteEntry error:', error);
    setMessage(resultsMsgEl, 'Chyba pri mazaní: ' + error.message, 'error');
  }
}

// ÚPRAVY FUNKCIÍ

function editContest(contestId, currentName, currentYear) {
  editState = { type: 'contest', id: contestId, data: {} };
  const content = `
    <label for="editContestName">Názov súťaže</label>
    <input id="editContestName" type="text" value="${currentName || ''}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
    <label for="editContestYear" style="margin-top:12px;">Rok</label>
    <input id="editContestYear" type="number" value="${currentYear || ''}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
  `;
  showEditModal('Upraviť súťaž', content);
}

function editCategory(categoryId, currentName) {
  editState = { type: 'category', id: categoryId, data: {} };
  const content = `
    <label for="editCategoryName">Názov kategórie</label>
    <input id="editCategoryName" type="text" value="${currentName || ''}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
  `;
  showEditModal('Upraviť kategóriu', content);
}

function editRound(roundId, currentName, currentStart, currentEnd) {
  editState = { type: 'round', id: roundId, data: {} };
  
  const formatForInput = (isoString) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toISOString().slice(0, 16);
  };

  const content = `
    <label for="editRoundName">Názov kola</label>
    <input id="editRoundName" type="text" value="${currentName || ''}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
    <label for="editRoundStart" style="margin-top:12px;">Začiatok (voliteľné)</label>
    <input id="editRoundStart" type="datetime-local" value="${formatForInput(currentStart)}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
    <label for="editRoundEnd" style="margin-top:12px;">Koniec (voliteľné)</label>
    <input id="editRoundEnd" type="datetime-local" value="${formatForInput(currentEnd)}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
  `;
  showEditModal('Upraviť kolo', content);
}

function editEntry(entryId, currentTitle, currentClient, currentNotes) {
  editState = { type: 'entry', id: entryId, data: {} };
  const content = `
    <label for="editEntryTitle">Názov kampane</label>
    <input id="editEntryTitle" type="text" value="${currentTitle || ''}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
    <label for="editEntryClient" style="margin-top:12px;">Klient</label>
    <input id="editEntryClient" type="text" value="${currentClient || ''}" style="width:100%; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;" />
    <label for="editEntryNotes" style="margin-top:12px;">Poznámky</label>
    <textarea id="editEntryNotes" style="width:100%; min-height:60px; padding:8px 10px; border:1px solid #ccc; border-radius:4px; font-size:14px; box-sizing:border-box;">${currentNotes || ''}</textarea>
  `;
  showEditModal('Upraviť kampaň', content);
}

async function ensureAdmin() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data?.user) {
    alert('Nie si prihlásený. Vráť sa na login.');
    window.location.href = 'index.html';
    return null;
  }

  const user = data.user;
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profileError || profile.role !== 'admin') {
    alert('Na túto stránku má prístup len admin.');
    window.location.href = 'index.html';
    return null;
  }

  return user;
}

// Súťaže – načítanie pre všetky selecty
async function loadContests() {
  const { data, error } = await supabase
    .from('contests')
    .select('*')
    .order('created_at', { ascending: false });

  contestListEl.innerHTML = '';
  [categoryContestSelect, roundContestSelect, resultsContestSelect].forEach(sel => {
    sel.innerHTML = '';
  });

  if (error) {
    console.error('loadContests error:', error);
    contestListEl.innerHTML = '<li>Chyba pri načítaní súťaží.</li>';
    return;
  }

  if (!data || data.length === 0) {
    contestListEl.innerHTML = '<li>Zatiaľ žiadne súťaže.</li>';
    return;
  }

  data.forEach((contest) => {
    const li = document.createElement('li');
    const safeName = (contest.name || '').replace(/'/g, "\\'");
    li.innerHTML = `
      ${contest.name} (${contest.year || 'rok nešpecifikovaný'})
      <div class="item-actions">
        <button class="edit-btn" onclick="editContest('${contest.id}', '${safeName}', '${contest.year || ''}')">Upraviť</button>
        <button class="delete-btn" onclick="deleteContest('${contest.id}', '${safeName}')">Zmazať</button>
      </div>
    `;
    contestListEl.appendChild(li);

    [categoryContestSelect, roundContestSelect, resultsContestSelect].forEach(sel => {
      const opt = document.createElement('option');
      opt.value = contest.id;
      opt.textContent = contest.name;
      sel.appendChild(opt);
    });
  });
}

// Kategórie – sekcia kategórií
async function loadCategoriesForSelectedContest() {
  const contestId = categoryContestSelect.value;
  categoryListEl.innerHTML = '';

  if (!contestId) {
    categoryListEl.innerHTML = '<li>Vyber súťaž.</li>';
    return;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadCategories error:', error);
    categoryListEl.innerHTML = '<li>Chyba pri načítaní kategórií.</li>';
    return;
  }

  if (!data || data.length === 0) {
    categoryListEl.innerHTML = '<li>Zatiaľ žiadne kategórie.</li>';
    return;
  }

  data.forEach((cat) => {
    const li = document.createElement('li');
    const safeName = (cat.name || '').replace(/'/g, "\\'");
    li.innerHTML = `
      ${cat.name}
      <div class="item-actions">
        <button class="edit-btn" onclick="editCategory('${cat.id}', '${safeName}')">Upraviť</button>
        <button class="delete-btn" onclick="deleteCategory('${cat.id}', '${safeName}')">Zmazať</button>
      </div>
    `;
    categoryListEl.appendChild(li);
  });
}

// Kolá – sekcia kôl
async function loadRoundsForSelectedContest() {
  const contestId = roundContestSelect.value;
  roundListEl.innerHTML = '';

  if (!contestId) {
    roundListEl.innerHTML = '<li>Vyber súťaž.</li>';
    return;
  }

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadRounds error:', error);
    roundListEl.innerHTML = '<li>Chyba pri načítaní kôl.</li>';
    return;
  }

  if (!data || data.length === 0) {
    roundListEl.innerHTML = '<li>Zatiaľ žiadne kolá.</li>';
    return;
  }

  data.forEach((r) => {
    const li = document.createElement('li');
    const start = r.start_at ? new Date(r.start_at).toLocaleString() : '–';
    const end = r.end_at ? new Date(r.end_at).toLocaleString() : '–';
    const safeName = (r.name || '').replace(/'/g, "\\'");
    li.innerHTML = `
      ${r.name} (od ${start} do ${end})
      <div class="item-actions">
        <button class="edit-btn" onclick="editRound('${r.id}', '${safeName}', '${r.start_at || ''}', '${r.end_at || ''}')">Upraviť</button>
        <button class="delete-btn" onclick="deleteRound('${r.id}', '${safeName}')">Zmazať</button>
      </div>
    `;
    roundListEl.appendChild(li);
  });
}

// Výsledky – rounds/categories pre filter
async function loadResultsRounds() {
  const contestId = resultsContestSelect.value;
  resultsRoundSelect.innerHTML = '';

  if (!contestId) {
    resultsRoundSelect.innerHTML = '<option value="">Vyber súťaž</option>';
    return;
  }

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('load results rounds error:', error);
    resultsRoundSelect.innerHTML = '<option value="">Chyba pri načítaní kôl</option>';
    return;
  }

  if (!data || data.length === 0) {
    resultsRoundSelect.innerHTML = '<option value="">Žiadne kolá</option>';
    return;
  }

  data.forEach((r) => {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = r.name;
    resultsRoundSelect.appendChild(opt);
  });
}

async function loadResultsCategories() {
  const contestId = resultsContestSelect.value;
  resultsCategorySelect.innerHTML = '';

  if (!contestId) {
    resultsCategorySelect.innerHTML = '<option value="">Vyber súťaž</option>';
    return;
  }

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('contest_id', contestId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('load results categories error:', error);
    resultsCategorySelect.innerHTML = '<option value="">Chyba pri načítaní kategórií</option>';
    return;
  }

  if (!data || data.length === 0) {
    resultsCategorySelect.innerHTML = '<option value="">Žiadne kategórie</option>';
    return;
  }

  data.forEach((cat) => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.name;
    resultsCategorySelect.appendChild(opt);
  });
}

// Výsledky – kampane + rozpis hlasov
async function loadResultsEntries() {
  const contestId = resultsContestSelect.value;
  const roundId = resultsRoundSelect.value;
  const categoryId = resultsCategorySelect.value;

  resultsEntriesListEl.innerHTML = '';
  setMessage(resultsMsgEl, '', 'ok');

  if (!contestId || !roundId || !categoryId) {
    setMessage(resultsMsgEl, 'Vyber súťaž, kolo a kategóriu.', 'error');
    return;
  }

  // Načítaj kampane s priemerom a počtom hlasov z view entry_scores
  const { data: scores, error: scoresError } = await supabase
    .from('entry_scores')
    .select('*')
    .eq('contest_id', contestId)
    .eq('round_id', roundId)
    .eq('category_id', categoryId)
    .order('avg_score', { ascending: false });

  if (scoresError) {
    console.error('loadResultsEntries error:', scoresError);
    setMessage(resultsMsgEl, 'Chyba pri načítaní výsledkov: ' + scoresError.message, 'error');
    return;
  }

  if (!scores || scores.length === 0) {
    resultsEntriesListEl.innerHTML = '<li>V tejto kategórii zatiaľ nie sú žiadne kampane alebo body.</li>';
    return;
  }

  // Pre každú kampaň vytvor blok s rozpisom hlasov
  for (const row of scores) {
    const li = document.createElement('li');
    const avg = row.avg_score !== null ? Number(row.avg_score).toFixed(2) : '–';
    const safeTitle = (row.title || '').replace(/'/g, "\\'");

    const header = document.createElement('div');
    header.innerHTML = `
      <strong>${row.title}</strong> — priemer: ${avg}/10, počet hlasov: ${row.votes_count}
      <div class="item-actions">
        <button class="edit-btn" onclick="editEntry('${row.entry_id}', '${safeTitle}', '', '')">Upraviť</button>
        <button class="delete-btn" onclick="deleteEntry('${row.entry_id}', '${safeTitle}', '')">Zmazať</button>
      </div>
    `;
    li.appendChild(header);

    const detailList = document.createElement('ul');
    detailList.style.marginTop = '6px';
    detailList.style.paddingLeft = '18px';

    // načítaj detail hlasov pre túto kampaň (porotcovia + body)
    const { data: votes, error: votesError } = await supabase
      .from('votes')
      .select(`
        score,
        profiles:judge_id ( email )
      `)
      .eq('entry_id', row.entry_id)
      .order('created_at', { ascending: true });

    if (votesError) {
      console.error('load votes for entry error:', votesError);
      const errLi = document.createElement('li');
      errLi.textContent = 'Chyba pri načítaní hlasov: ' + votesError.message;
      detailList.appendChild(errLi);
    } else if (!votes || votes.length === 0) {
      const noLi = document.createElement('li');
      noLi.textContent = 'Zatiaľ žiadne hlasy.';
      detailList.appendChild(noLi);
    } else {
      votes.forEach((v) => {
        const email = v.profiles?.email || 'neznámy porotca';
        const voteLi = document.createElement('li');
        voteLi.textContent = `${email} — ${v.score}/10`;
        detailList.appendChild(voteLi);
      });
    }

    li.appendChild(detailList);
    resultsEntriesListEl.appendChild(li);
  }
}

// Handlery – vytváranie súťaží/kategórií/kôl
createContestBtn.addEventListener('click', async () => {
  const name = contestNameInput.value.trim();
  const yearValue = contestYearInput.value.trim();
  const year = yearValue ? parseInt(yearValue, 10) : null;

  if (!name) {
    setMessage(contestMsgEl, 'Názov súťaže je povinný.', 'error');
    return;
  }

  createContestBtn.disabled = true;
  setMessage(contestMsgEl, 'Ukladám súťaž...', 'ok');

  const { error } = await supabase
    .from('contests')
    .insert({ name, year });

  if (error) {
    console.error('createContest error:', error);
    setMessage(contestMsgEl, 'Chyba pri ukladaní súťaže: ' + error.message, 'error');
    createContestBtn.disabled = false;
    return;
  }

  setMessage(contestMsgEl, 'Súťaž uložená.', 'ok');
  contestNameInput.value = '';
  contestYearInput.value = '';
  createContestBtn.disabled = false;

  await loadContests();
  await loadResultsRounds();
  await loadResultsCategories();
  await loadResultsEntries();
});

createCategoryBtn.addEventListener('click', async () => {
  const contestId = categoryContestSelect.value;
  const name = categoryNameInput.value.trim();

  if (!contestId) {
    setMessage(categoryMsgEl, 'Vyber súťaž.', 'error');
    return;
  }
  if (!name) {
    setMessage(categoryMsgEl, 'Názov kategórie je povinný.', 'error');
    return;
  }

  createCategoryBtn.disabled = true;
  setMessage(categoryMsgEl, 'Ukladám kategóriu...', 'ok');

  const { error } = await supabase
    .from('categories')
    .insert({ contest_id: contestId, name });

  if (error) {
    console.error('createCategory error:', error);
    setMessage(categoryMsgEl, 'Chyba pri ukladaní kategórie: ' + error.message, 'error');
    createCategoryBtn.disabled = false;
    return;
  }

  setMessage(categoryMsgEl, 'Kategória uložená.', 'ok');
  categoryNameInput.value = '';
  createCategoryBtn.disabled = false;

  await loadCategoriesForSelectedContest();
  await loadResultsCategories();
  await loadResultsEntries();
});

createRoundBtn.addEventListener('click', async () => {
  const contestId = roundContestSelect.value;
  const name = roundNameInput.value.trim();

  if (!contestId) {
    setMessage(roundMsgEl, 'Vyber súťaž.', 'error');
    return;
  }
  if (!name) {
    setMessage(roundMsgEl, 'Názov kola je povinný.', 'error');
    return;
  }

  const startAt = roundStartInput.value ? new Date(roundStartInput.value).toISOString() : null;
  const endAt = roundEndInput.value ? new Date(roundEndInput.value).toISOString() : null;

  createRoundBtn.disabled = true;
  setMessage(roundMsgEl, 'Ukladám kolo...', 'ok');

  const { error } = await supabase
    .from('rounds')
    .insert({
      contest_id: contestId,
      name,
      start_at: startAt,
      end_at: endAt
    });

  if (error) {
    console.error('createRound error:', error);
    setMessage(roundMsgEl, 'Chyba pri ukladaní kola: ' + error.message, 'error');
    createRoundBtn.disabled = false;
    return;
  }

  setMessage(roundMsgEl, 'Kolo uložené.', 'ok');
  roundNameInput.value = '';
  roundStartInput.value = '';
  roundEndInput.value = '';
  createRoundBtn.disabled = false;

  await loadRoundsForSelectedContest();
  await loadResultsRounds();
  await loadResultsEntries();
});

// init
(async () => {
  const user = await ensureAdmin();
  if (!user) return;

  await loadContests();

  categoryContestSelect.addEventListener('change', loadCategoriesForSelectedContest);
  roundContestSelect.addEventListener('change', loadRoundsForSelectedContest);

  if (categoryContestSelect.value) {
    await loadCategoriesForSelectedContest();
  }
  if (roundContestSelect.value) {
    await loadRoundsForSelectedContest();
  }

  // Výsledky – handlers
  resultsContestSelect.addEventListener('change', async () => {
    await loadResultsRounds();
    await loadResultsCategories();
    await loadResultsEntries();
  });
  resultsRoundSelect.addEventListener('change', loadResultsEntries);
  resultsCategorySelect.addEventListener('change', loadResultsEntries);

  if (resultsContestSelect.value) {
    await loadResultsRounds();
    await loadResultsCategories();
    await loadResultsEntries();
  }
})();
