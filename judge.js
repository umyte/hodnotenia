// judge.js
import { supabase } from './supabaseClient.js';

const contestSelect = document.getElementById('contestSelect');
const roundSelect = document.getElementById('roundSelect');
const categorySelect = document.getElementById('categorySelect');
const msgEl = document.getElementById('message');
const entriesContainer = document.getElementById('entriesContainer');

function setMessage(text, type = 'ok') {
  msgEl.textContent = text;
  msgEl.className = 'msg ' + type;
}

async function getCurrentJudge() {
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

  if (profileError || profile.role !== 'judge') {
    alert('Na túto stránku majú prístup len porotcovia.');
    window.location.href = 'index.html';
    return null;
  }

  return user;
}

async function loadContestsRoundsCategories() {
  const { data: contests, error: contestsError } = await supabase
    .from('contests')
    .select('*')
    .order('created_at', { ascending: false });

  contestSelect.innerHTML = '';
  roundSelect.innerHTML = '';
  categorySelect.innerHTML = '';

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

  await loadRoundsForContest();
  await loadCategoriesForContest();
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

async function loadEntriesWithVotes(judge) {
  const contestId = contestSelect.value;
  const roundId = roundSelect.value;
  const categoryId = categorySelect.value;

  entriesContainer.innerHTML = 'Načítavam kampane...';

  if (!contestId || !roundId || !categoryId) {
    entriesContainer.innerHTML = 'Vyber súťaž, kolo a kategóriu.';
    return;
  }

  const { data: entries, error } = await supabase
    .from('entries')
    .select(`
      *,
      votes ( id, judge_id, score )
    `)
    .eq('contest_id', contestId)
    .eq('round_id', roundId)
    .eq('category_id', categoryId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('loadEntriesWithVotes error:', error);
    entriesContainer.textContent = 'Nepodarilo sa načítať kampane.';
    return;
  }

  if (!entries || entries.length === 0) {
    entriesContainer.textContent = 'Žiadne kampane v tomto kole/kategórii.';
    return;
  }

  entriesContainer.innerHTML = '';
  entries.forEach((entry) => {
    const div = document.createElement('div');
    div.className = 'entry-card';

    const existingVote = Array.isArray(entry.votes)
      ? entry.votes.find((v) => v.judge_id === judge.id)
      : null;

    const currentScore = existingVote?.score ?? 0;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'entry-info';
    infoDiv.innerHTML = `
      <div><strong>${entry.title}</strong></div>
      <div>Klient: ${entry.client || '-'}</div>
      <div>Typ: ${entry.media_type}</div>
    `;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'entry-actions';

    const scoreSelect = document.createElement('select');
    for (let i = 0; i <= 10; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i === 0 ? 'Bez hodnotenia' : i.toString();
      if (i === currentScore) opt.selected = true;
      scoreSelect.appendChild(opt);
    }

    const voteBtn = document.createElement('button');
    voteBtn.className = 'vote-btn';
    voteBtn.textContent = currentScore > 0 ? 'Upraviť body' : 'Uložiť body';

    const statusSpan = document.createElement('div');
    statusSpan.className = 'vote-status';
    statusSpan.textContent =
      currentScore > 0
        ? `Aktuálne body: ${currentScore}/10`
        : 'Zatiaľ si nehodnotil.';

    voteBtn.addEventListener('click', async () => {
      const score = parseInt(scoreSelect.value, 10);

      if (!score || score < 1 || score > 10) {
        setMessage('Vyber počet bodov 1–10.', 'error');
        return;
      }

      voteBtn.disabled = true;
      voteBtn.textContent = 'Ukladám...';

      let voteError = null;

      if (!existingVote) {
        const { error: insertError } = await supabase
          .from('votes')
          .insert({
            judge_id: judge.id,
            entry_id: entry.id,
            score
          });
        voteError = insertError;
      } else {
        const { error: updateError } = await supabase
          .from('votes')
          .update({ score })
          .eq('id', existingVote.id);
        voteError = updateError;
      }

      if (voteError) {
        console.error('vote error:', voteError);
        setMessage('Nepodarilo sa uložiť body: ' + voteError.message, 'error');
        voteBtn.disabled = false;
        voteBtn.textContent = currentScore > 0 ? 'Upraviť body' : 'Uložiť body';
        return;
      }

      setMessage('Body uložené.', 'ok');
      voteBtn.disabled = false;
      voteBtn.textContent = 'Upraviť body';
      statusSpan.textContent = `Aktuálne body: ${score}/10`;
    });

    actionsDiv.appendChild(scoreSelect);
    actionsDiv.appendChild(voteBtn);
    actionsDiv.appendChild(statusSpan);

    div.appendChild(infoDiv);
    div.appendChild(actionsDiv);
    entriesContainer.appendChild(div);
  });
}

// init
(async () => {
  const judge = await getCurrentJudge();
  if (!judge) return;

  await loadContestsRoundsCategories();
  await loadEntriesWithVotes(judge);

  contestSelect.addEventListener('change', async () => {
    await loadRoundsForContest();
    await loadCategoriesForContest();
    await loadEntriesWithVotes(judge);
  });

  roundSelect.addEventListener('change', async () => {
    await loadEntriesWithVotes(judge);
  });

  categorySelect.addEventListener('change', async () => {
    await loadEntriesWithVotes(judge);
  });
})();
