// admin.js
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

function setMessage(el, text, type = 'ok') {
  el.textContent = text;
  el.className = 'msg ' + type;
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
    li.textContent = `${contest.name} (${contest.year || 'rok nešpecifikovaný'})`;
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
    li.textContent = cat.name;
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
    li.textContent = `${r.name} (od ${start} do ${end})`;
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

    const header = document.createElement('div');
    header.innerHTML = `<strong>${row.title}</strong> — priemer: ${avg}/10, počet hlasov: ${row.votes_count}`;
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
