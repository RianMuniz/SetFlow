const state = {
  user: null,
  bands: [],
  band: null,
  music: [],
  setlists: [],
  drafts: [],
  history: [],
  expandedBands: {},
  bandMembers: {},
  memberErrors: {},
  screen: 'home',
  authMode: 'login',
  selectedSetlist: null,
  csrfToken: null
};

const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));
const formatDuration = (seconds) => `${Math.floor(Number(seconds || 0) / 60)}m ${Number(seconds || 0) % 60}s`;
const dateLabel = (value) => new Date(`${String(value ?? '').slice(0, 10)}T00:00:00`).toLocaleDateString('pt-BR');

// Sessão encerrada (ex.: login em outro dispositivo, já que cada usuário mantém uma só sessão):
// volta para a tela de login em vez de deixar o app travado com erros.
function handleSessionLost() {
  state.user = null; state.band = null; state.csrfToken = null; state.drafts = [];
  document.querySelectorAll('.modal-backdrop').forEach((modal) => modal.remove());
  render();
  $('#auth-info').textContent = '';
  $('#auth-error').textContent = 'Sua sessão terminou, por exemplo por ter entrado em outro dispositivo. Entre novamente.';
}

async function api(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.csrfToken && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    headers['X-CSRF-Token'] = state.csrfToken;
  }
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers,
    ...options,
    body: options.body && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error?.message || 'Não foi possível concluir a operação.');
    error.status = response.status;
    error.code = data.error?.code;
    if (response.status === 401 && state.user && !url.startsWith('/api/auth/')) handleSessionLost();
    throw error;
  }
  return data;
}

function showToast(message, error = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast ${error ? 'error' : 'success'}`;
  setTimeout(() => toast.classList.add('hidden'), 3200);
}

function showModal(title, content) {
  const existing = $('.modal-backdrop');
  if (existing) existing.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `<div class="modal"><div class="toolbar"><h2>${title}</h2><button class="icon-button" data-close-modal>×</button></div>${content}</div>`;
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-modal]')) backdrop.remove();
  });
  document.body.appendChild(backdrop);
  return backdrop.querySelector('.modal');
}

async function loadBands() {
  const data = await api('/api/bandas');
  state.bands = data.bands;
  state.band = state.bands.find((band) => band.id === data.activeBandId) || state.bands[0] || null;
  if (state.band && state.band.id !== data.activeBandId) await api(`/api/bandas/${state.band.id}/ativa`, { method: 'POST' });
}

async function loadBandData() {
  if (!state.band) return;
  const id = state.band.id;
  const isLeader = state.band.role === 'leader';
  const [music, setlists, history, drafts] = await Promise.all([
    api(`/api/bandas/${id}/musicas`),
    api(`/api/bandas/${id}/setlists-confirmados`),
    isLeader ? api(`/api/bandas/${id}/historico`) : Promise.resolve({ historico: [] }),
    isLeader ? api(`/api/bandas/${id}/setlists`) : Promise.resolve({ setlists: [] })
  ]);
  state.music = music.music;
  state.setlists = setlists.setlists;
  state.history = history.historico;
  state.drafts = drafts.setlists;
}

function render() {
  $('#auth-view').classList.toggle('hidden', Boolean(state.user));
  $('#main-view').classList.toggle('hidden', !state.user);
  if (!state.user) { state.expandedBands = {}; state.bandMembers = {}; state.memberErrors = {}; return; }
  $('#page-title').textContent = { home: 'Início', music: 'Repertório', setlists: 'Setlists', history: 'Histórico' }[state.screen];
  document.querySelectorAll('.bottom-nav button').forEach((button) => button.classList.toggle('active', button.dataset.screen === state.screen));
  const views = { home: renderHome, music: renderMusic, setlists: renderSetlists, history: renderHistory };
  views[state.screen]();
}

const roleLabel = (role) => (role === 'leader' ? 'Líder' : 'Músico');

// Líder primeiro, depois ordem alfabética por nickname.
const byRoleThenNickname = (a, b) => (a.role === b.role ? 0 : a.role === 'leader' ? -1 : 1)
  || String(a.nickname || '').localeCompare(String(b.nickname || ''), 'pt-BR', { sensitivity: 'base' });

async function loadBandMembers(id) {
  try {
    const data = await api(`/api/bandas/${id}`);
    state.bandMembers[id] = [...data.band.members].sort(byRoleThenNickname);
    delete state.memberErrors[id];
  } catch (error) {
    delete state.bandMembers[id];
    state.memberErrors[id] = error.message;
  }
}

async function toggleBand(id) {
  if (state.expandedBands[id]) { delete state.expandedBands[id]; render(); return; }
  state.expandedBands[id] = true;
  if (!state.bandMembers[id]) { render(); await loadBandMembers(id); }
  render();
}

function bandMembersHtml(id) {
  const members = state.bandMembers[id];
  if (members) {
    return members.length
      ? `<ul class="member-list">${members.map((member) => `<li><span>${escapeHtml(member.nickname || 'sem nickname')}${member.userId === state.user.id ? ' <small class="muted">(você)</small>' : ''}</span><span class="badge ${member.role === 'leader' ? 'warn' : ''}">${roleLabel(member.role)}</span></li>`).join('')}</ul>`
      : '<small class="muted">Nenhum membro.</small>';
  }
  if (state.memberErrors[id]) return `<small class="error">${escapeHtml(state.memberErrors[id])}</small>`;
  return '<small class="muted">Carregando membros…</small>';
}

function renderHome() {
  const bandOptions = state.bands.map((band) => {
    const open = Boolean(state.expandedBands[band.id]);
    const active = Boolean(state.band && state.band.id === band.id);
    return `
    <div class="card band-item${open ? ' open' : ''}">
      <button class="band-card" type="button" data-toggle-band="${band.id}" aria-expanded="${open}" aria-controls="band-members-${band.id}">
        <span><strong>${escapeHtml(band.name)}</strong><small class="muted">${band.memberCount} membro(s) · ${roleLabel(band.role)}</small></span>
        <span class="band-meta">${active ? '<span class="badge ok">Ativa</span>' : ''}<span class="chevron" aria-hidden="true">›</span></span>
      </button>
      ${open ? `<div class="band-members" id="band-members-${band.id}">${bandMembersHtml(band.id)}${band.role === 'leader' || !active ? `<div class="band-actions">${band.role === 'leader' ? `<button class="secondary" type="button" data-rename-band="${band.id}">Editar nome</button>` : ''}${active ? '' : `<button class="secondary" type="button" data-switch-band="${band.id}">Usar esta banda</button>`}</div>` : ''}</div>` : ''}
    </div>`;
  }).join('');
  $('#content').innerHTML = `
    <div class="card">
      <span class="eyebrow">OLÁ, ${escapeHtml(state.user.nickname || '')}</span>
      <h2>${state.band ? escapeHtml(state.band.name) : 'Crie sua primeira banda'}</h2>
      <p class="muted">${state.band ? 'Escolha uma área para continuar.' : 'Comece organizando seu repertório.'}</p>
      <button class="secondary" data-action="new-band">+ Nova banda</button>
    </div>
    <div class="toolbar"><h2>Minhas bandas</h2></div>
    <div class="grid">${bandOptions || '<div class="card empty">Nenhuma banda cadastrada.</div>'}</div>
    ${state.band?.role === 'leader' ? `<div class="card" style="margin-top:12px"><div class="toolbar"><div><h3>Limiar de transição</h3><small class="muted">Atual: ${state.band.transitionThresholdSemitones} semitons</small></div><button class="secondary" data-action="threshold">Editar</button></div><button class="secondary" data-action="member" style="width:100%">+ Adicionar músico</button></div>` : ''}`;
}

function renderMusic() {
  const rows = state.music.map((song) => `
    <div class="music-row">
      <div><strong>${escapeHtml(song.titulo)}</strong><div class="track-meta">${song.tom} · ${song.bpm} BPM · ${formatDuration(song.duracaoSegundos)}</div>${song.cifraArquivo ? `<div class="track-meta">${chordLink(song)}</div>` : ''}</div>
      ${state.band.role === 'leader' ? `<button class="secondary" data-edit-music="${song.id}">Editar</button>` : ''}
    </div>`).join('');
  $('#content').innerHTML = `
    <div class="toolbar"><div><h2>Repertório</h2><small class="muted">${state.music.length} música(s)</small></div>${state.band.role === 'leader' ? '<button class="primary" data-action="new-music">+ Música</button>' : ''}</div>
    <div class="card">${rows || '<div class="empty">Nenhuma música cadastrada.</div>'}</div>
    ${state.band.role === 'leader' ? '<div class="card" style="margin-top:12px"><small class="muted">O líder pode cadastrar e editar músicas e configurar o limiar na tela inicial.</small></div>' : ''}`;
}

function setlistCard(setlist, action = '') {
  return `<button class="card setlist-card" ${action}><span><strong>${escapeHtml(setlist.nome)}</strong><small class="muted">${dateLabel(setlist.data)} · ${setlist.musicas?.length || 0} música(s)</small></span><span class="badge ${setlist.estado === 'Tocado' ? 'ok' : ''}">${setlist.estado}</span></button>`;
}

function renderSetlists() {
  const drafts = state.band.role === 'leader' && state.drafts.length
    ? `<div class="toolbar" style="margin-top:12px"><div><h2>Rascunhos</h2><small class="muted">Toque para ordenar e confirmar</small></div></div><div class="grid">${state.drafts.map((setlist) => setlistCard(setlist, `data-open-draft="${setlist.id}"`)).join('')}</div>`
    : '';
  const leaderAction = state.band.role === 'leader' ? '<button class="primary" data-action="new-setlist">+ Setlist</button>' : '';
  $('#content').innerHTML = `
    <div class="toolbar"><div><h2>Setlists</h2><small class="muted">Confirmados disponíveis para a banda</small></div>${leaderAction}</div>
    <div class="grid">${state.setlists.map((setlist) => setlistCard(setlist, `data-open-setlist="${setlist.id}"`)).join('') || '<div class="card empty">Nenhum setlist confirmado ainda.</div>'}</div>
    ${drafts}`;
}

function renderHistory() {
  if (state.band.role !== 'leader') {
    $('#content').innerHTML = '<div class="card empty">O histórico é uma área exclusiva do líder.</div>';
    return;
  }
  $('#content').innerHTML = `
    <div class="toolbar"><div><h2>Histórico</h2><small class="muted">Setlists já tocados</small></div></div>
    <div class="grid">${state.history.map((setlist) => setlistCard(setlist)).join('') || '<div class="card empty">Nenhum setlist tocado.</div>'}</div>`;
}

function formModal(title, fields, onSubmit) {
  const modal = showModal(title, `<form class="form-stack">${fields}<button class="primary" type="submit">Salvar</button><p class="error form-error"></p></form>`);
  modal.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await onSubmit(new FormData(event.currentTarget)); modal.closest('.modal-backdrop').remove(); } catch (error) { modal.querySelector('.form-error').textContent = error.message; }
  });
}

function openBandForm() {
  formModal('Nova banda', '<label>Nome da banda<input name="name" maxlength="60" required></label>', async (form) => {
    const data = await api('/api/bandas', { method: 'POST', body: { name: form.get('name') } });
    await loadBands(); state.band = state.bands.find((band) => band.id === data.band.id); await loadBandData(); render(); showToast('Banda criada.');
  });
}

function openBandRename(bandId) {
  const target = state.bands.find((band) => band.id === bandId);
  if (!target) return;
  formModal('Editar nome da banda', `<label>Nome da banda<input name="name" maxlength="60" required value="${escapeHtml(target.name)}"></label>`, async (form) => {
    await api(`/api/bandas/${bandId}`, { method: 'PUT', body: { name: form.get('name') } });
    await loadBands(); render(); showToast('Nome da banda atualizado.');
  });
}

function openThresholdForm() {
  formModal('Limiar de transição', `<label>Semitons<input name="value" type="number" min="0" max="12" value="${state.band.transitionThresholdSemitones}" required></label>`, async (form) => {
    await api(`/api/bandas/${state.band.id}/limiar-transicao`, { method: 'PUT', body: { limiarTransicaoSemitons: Number(form.get('value')) } });
    await loadBands(); state.band = state.bands.find((band) => band.id === state.band.id); render(); showToast('Limiar atualizado.');
  });
}

const MAX_CHORD_BYTES = 5 * 1024 * 1024;
const CHORD_ACCEPT = '.pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain';
const chordUrl = (songId) => `/api/bandas/${state.band.id}/musicas/${songId}/cifra`;
const formatBytes = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const chordLink = (song) => (song.cifraArquivo
  ? `<a class="file-link" href="${chordUrl(song.id)}" target="_blank" rel="noopener">📎 ${escapeHtml(song.cifraArquivo.nome)}</a>`
  : '');

async function uploadChord(songId, file) {
  const headers = { 'Content-Type': 'application/octet-stream', 'X-File-Name': encodeURIComponent(file.name) };
  if (state.csrfToken) headers['X-CSRF-Token'] = state.csrfToken;
  const response = await fetch(chordUrl(songId), { method: 'PUT', credentials: 'same-origin', headers, body: file });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && state.user) handleSessionLost();
  if (!response.ok) throw new Error(data.error?.message || 'Não foi possível enviar a cifra.');
}

function openMusicForm(song = {}) {
  const current = song.cifraArquivo
    ? `<div class="file-current">Cifra atual: ${chordLink(song)} <small class="muted">(${formatBytes(song.cifraArquivo.tamanhoBytes)})</small><label class="check"><input type="checkbox" name="removeCifra"> Remover cifra</label></div>`
    : '';
  formModal(song.id ? 'Editar música' : 'Nova música', `
    <label>Título<input name="titulo" value="${escapeHtml(song.titulo || '')}" required></label>
    <div class="grid two"><label>Tom<select name="tom">${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((key) => `<option ${key === song.tom ? 'selected' : ''}>${key}</option>`).join('')}</select></label><label>BPM<input name="bpm" type="number" min="1" value="${song.bpm || 120}" required></label></div>
    <label>Duração (segundos)<input name="duracaoSegundos" type="number" min="1" value="${song.duracaoSegundos || 180}" required></label>
    <label>Observações<textarea name="observacoes">${escapeHtml(song.observacoes || '')}</textarea></label>
    <label>Cifra (PDF, PNG, JPG ou TXT · até 5 MB)<input name="cifra" type="file" accept="${CHORD_ACCEPT}"></label>${current}`, async (form) => {
    const file = form.get('cifra');
    const hasFile = file instanceof File && file.size > 0;
    if (hasFile && file.size > MAX_CHORD_BYTES) throw new Error('A cifra deve ter no máximo 5 MB.');
    const body = { titulo: form.get('titulo'), tom: form.get('tom'), bpm: Number(form.get('bpm')), duracaoSegundos: Number(form.get('duracaoSegundos')), observacoes: form.get('observacoes') };
    const saved = await api(`/api/bandas/${state.band.id}/musicas${song.id ? `/${song.id}` : ''}`, { method: song.id ? 'PUT' : 'POST', body });
    let chordError = null;
    try {
      if (hasFile) await uploadChord(saved.music.id, file);
      else if (song.cifraArquivo && form.get('removeCifra')) await api(chordUrl(saved.music.id), { method: 'DELETE' });
    } catch (error) { chordError = error; }
    await loadBandData(); render();
    if (chordError) showToast(`Música salva, mas a cifra falhou: ${chordError.message}`, true);
    else showToast(song.id ? 'Música atualizada.' : 'Música cadastrada.');
  });
}

function openSetlistForm() {
  const choices = state.music.map((song) => `<label><input type="checkbox" name="music" value="${song.id}"> ${escapeHtml(song.titulo)} <small class="muted">(${song.tom})</small></label>`).join('');
  formModal('Novo setlist', `<label>Nome<input name="nome" required></label><label>Data<input name="data" type="date" required></label><label>Tempo disponível (segundos)<input name="tempo" type="number" min="1" value="3600" required></label><div class="card form-stack"><strong>Selecione as músicas</strong>${choices || '<small class="muted">Cadastre músicas primeiro.</small>'}</div>`, async (form) => {
    const musicaIds = form.getAll('music');
    const result = await api(`/api/bandas/${state.band.id}/setlists`, { method: 'POST', body: { nome: form.get('nome'), data: form.get('data'), tempoDisponivelSegundos: Number(form.get('tempo')), musicaIds } });
    await loadBandData(); render();
    await openDraft(result.setlist);
  });
}

async function openDraft(setlist) {
  if (!setlist) return;
  const base = `/api/bandas/${state.band.id}/setlists/${setlist.id}`;
  const detalhar = (musicaId) => ({ ...(state.music.find((song) => song.id === musicaId) || {}), musicaId });
  const ordenar = (musicas) => [...musicas].sort((a, b) => a.ordem - b.ordem).map((item) => detalhar(item.musicaId));
  let items = ordenar(setlist.musicas);
  const duracaoTotalSegundos = items.reduce((total, item) => total + Number(item.duracaoSegundos || 0), 0);
  let info = {
    duracaoTotalSegundos,
    alertaTempoExcedido: duracaoTotalSegundos > Number(setlist.tempoDisponivelSegundos || Infinity)
  };
  let adding = false;
  let selected = new Set();
  const available = () => state.music.filter((song) => !items.some((item) => item.musicaId === song.id));
  const modal = showModal(escapeHtml(setlist.nome), '<div id="draft-body"></div>');
  const body = modal.querySelector('#draft-body');
  const run = async (task) => { try { await task(); } catch (error) { showToast(error.message, true); } };
  const saveOrder = async () => {
    const result = await api(`${base}/ordem`, { method: 'PUT', body: { musicaIds: items.map((item) => item.musicaId) } });
    info = result.alerts;
  };
  const renderDraft = () => {
    const free = available();
    const addSection = adding
      ? `<div class="card picker">${free.map((song) => `<label class="pick-row"><input type="checkbox" value="${song.id}" ${selected.has(song.id) ? 'checked' : ''}><span><strong>${escapeHtml(song.titulo)}</strong><small class="track-meta">${escapeHtml(song.tom)} · ${formatDuration(song.duracaoSegundos)}</small></span></label>`).join('')}</div><div class="actions" style="margin-top:12px"><button class="secondary" type="button" data-add-cancel>Cancelar</button><button class="primary" type="button" data-add-confirm ${selected.size ? '' : 'disabled'}>${selected.size ? `Adicionar (${selected.size})` : 'Adicionar'}</button></div>`
      : `<button class="secondary" type="button" data-add-open ${free.length ? '' : 'disabled'} style="width:100%;margin-top:12px">+ Adicionar músicas</button>${free.length ? '' : '<small class="muted">Todas as músicas do repertório já estão neste setlist.</small>'}`;
    const mainActions = adding ? '' : '<div class="actions" style="margin-top:14px"><button class="secondary" data-draft-suggest>Sugerir ordem</button><button class="primary" data-draft-confirm>Confirmar</button></div>';
    body.innerHTML = `<p class="muted">${dateLabel(setlist.data)} · ${formatDuration(info.duracaoTotalSegundos)}</p>${info.alertaTempoExcedido ? '<div class="alert">O tempo disponível foi excedido.</div>' : ''}<div class="card">${items.map((item, index) => `<div class="track"><span class="track-index">${index + 1}</span><div class="track-main"><strong>${escapeHtml(item.titulo)}</strong><small class="track-meta">${escapeHtml(item.tom)} · ${formatDuration(item.duracaoSegundos)}</small></div><div class="actions"><button data-move="${index}" data-dir="-1">↑</button><button data-move="${index}" data-dir="1">↓</button></div></div>`).join('')}</div>${addSection}${mainActions}`;
    body.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => run(async () => {
      const from = Number(button.dataset.move), to = from + Number(button.dataset.dir);
      if (to < 0 || to >= items.length) return;
      [items[from], items[to]] = [items[to], items[from]];
      try { await saveOrder(); } catch (error) { [items[from], items[to]] = [items[to], items[from]]; throw error; }
      renderDraft();
    })));
    const on = (selector, handler) => { const element = body.querySelector(selector); if (element) element.addEventListener('click', handler); };
    on('[data-add-open]', () => { adding = true; selected = new Set(); renderDraft(); });
    on('[data-add-cancel]', () => { adding = false; selected = new Set(); renderDraft(); });
    body.querySelectorAll('.pick-row input').forEach((box) => box.addEventListener('change', () => {
      if (box.checked) selected.add(box.value); else selected.delete(box.value);
      const confirm = body.querySelector('[data-add-confirm]');
      confirm.disabled = selected.size === 0;
      confirm.textContent = selected.size ? `Adicionar (${selected.size})` : 'Adicionar';
    }));
    on('[data-add-confirm]', () => run(async () => {
      const total = selected.size;
      const result = await api(`${base}/musicas`, { method: 'POST', body: { musicaIds: [...selected] } });
      items = ordenar(result.setlist.musicas);
      info = result.alerts;
      adding = false; selected = new Set();
      renderDraft();
      showToast(total === 1 ? '1 música adicionada ao final.' : `${total} músicas adicionadas ao final.`);
      await loadBandData(); render();
    }));
    on('[data-draft-suggest]', () => run(async () => {
      const result = await api(`${base}/sugestao`, { method: 'POST' });
      items = result.sugestao.musicas.map((item) => detalhar(item.musicaId));
      await saveOrder();
      renderDraft();
    }));
    on('[data-draft-confirm]', () => run(async () => {
      await api(`${base}/confirmar`, { method: 'POST' });
      modal.closest('.modal-backdrop').remove();
      await loadBandData(); render(); showToast('Setlist confirmado.');
    }));
  };
  renderDraft();
}

async function openSetlist(id) {
  const setlist = [...state.setlists, ...state.history].find((item) => item.id === id);
  if (!setlist) return;
  const result = setlist.estado === 'Tocado'
    ? {
      setlist: {
        ...setlist,
        musicas: setlist.musicas.map((item) => ({
          ...(state.music.find((song) => song.id === item.musicaId) || {}),
          ordem: item.ordem
        }))
      }
    }
    : await api(`/api/bandas/${state.band.id}/setlists/${id}/visualizacao`);
  const leaderActions = state.band.role === 'leader' ? `<div class="actions" style="margin-top:14px">${setlist.estado === 'Confirmado' ? '<button class="secondary" data-reopen-setlist>Reabrir para editar</button><button class="primary" data-play-setlist>Marcar como tocado</button>' : ''}</div>` : '';
  const modal = showModal(escapeHtml(setlist.nome), `<p class="muted">${dateLabel(setlist.data)} · ${setlist.estado}</p><div class="card">${result.setlist.musicas.map((song, index) => `<div class="track"><span class="track-index">${index + 1}</span><div class="track-main"><strong>${escapeHtml(song.titulo)}</strong><small class="track-meta">${song.tom} · ${song.bpm} BPM · ${formatDuration(song.duracaoSegundos)}</small><small class="track-meta">${escapeHtml(song.observacoes || 'Sem observações')} ${song.cifraArquivo ? `· ${chordLink(song)}` : (song.cifraAnexo ? `· ${escapeHtml(song.cifraAnexo)}` : '')}</small></div><select data-mastery="${song.id}"><option value="">Domínio</option>${['Não Sei','Preciso Revisar','Sei Bem'].map((level) => `<option ${song.nivelDominio === level ? 'selected' : ''}>${level}</option>`).join('')}</select></div>`).join('')}</div>${leaderActions}`);
  modal.querySelectorAll('[data-mastery]').forEach((select) => select.addEventListener('change', async () => {
    if (!select.value) return;
    await api(`/api/bandas/${state.band.id}/musicas/${select.dataset.mastery}/dominio`, { method: 'PUT', body: { nivel: select.value } });
    showToast('Domínio atualizado.');
  }));
  modal.querySelector('[data-reopen-setlist]')?.addEventListener('click', async () => {
    await api(`/api/bandas/${state.band.id}/setlists/${id}/reabrir`, { method: 'POST' });
    modal.closest('.modal-backdrop').remove();
    await loadBandData(); render();
    await openDraft(state.drafts.find((item) => item.id === id));
  });
  modal.querySelector('[data-play-setlist]')?.addEventListener('click', async () => {
    await api(`/api/bandas/${state.band.id}/setlists/${id}/tocar`, { method: 'POST' });
    modal.closest('.modal-backdrop').remove();
    await loadBandData(); render(); showToast('Setlist marcado como tocado.');
  });
}

async function switchBand(id) {
  await api(`/api/bandas/${id}/ativa`, { method: 'POST' });
  state.band = state.bands.find((band) => band.id === id);
  await loadBandData(); state.screen = 'home'; render(); showToast(`Banda ${state.band.name} selecionada.`);
}

function openForgotPassword() {
  const email = $('#auth-form').elements.email.value.trim();
  const modal = showModal('Redefinir senha', `<p class="muted">Informe o e-mail da sua conta. Se ele estiver cadastrado, enviaremos um link para criar uma nova senha (válido por 30 minutos).</p><form class="form-stack"><label>E-mail<input name="email" type="email" autocomplete="email" value="${escapeHtml(email)}" required></label><button class="primary" type="submit">Enviar link</button><p class="error form-error"></p></form>`);
  modal.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      const result = await api('/api/auth/password-reset/request', { method: 'POST', body: { email: new FormData(form).get('email') } });
      form.innerHTML = `<p class="success">${escapeHtml(result.message)}</p><button class="secondary" type="button" data-close-modal>Fechar</button>`;
    } catch (error) {
      form.querySelector('.form-error').textContent = error.message;
      submit.disabled = false;
    }
  });
}

function openResetPassword(token) {
  const modal = showModal('Nova senha', `<form class="form-stack"><label>Nova senha<input name="password" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><label>Confirmar nova senha<input name="confirm" type="password" minlength="8" maxlength="128" autocomplete="new-password" required></label><button class="primary" type="submit">Redefinir senha</button><p class="error form-error"></p></form>`);
  modal.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const errorBox = modal.querySelector('.form-error');
    if (form.get('password') !== form.get('confirm')) { errorBox.textContent = 'As senhas não conferem.'; return; }
    try {
      await api('/api/auth/password-reset/confirm', { method: 'POST', body: { token, password: form.get('password') } });
      modal.closest('.modal-backdrop').remove();
      state.user = null; state.band = null; state.csrfToken = null; state.drafts = []; render();
      $('#auth-error').textContent = ''; $('#auth-info').textContent = 'Senha redefinida. Entre com a nova senha.';
    } catch (error) { errorBox.textContent = error.message; }
  });
}

// Link do e-mail: /#reset=<token>. O token sai da barra de endereço imediatamente.
function takeResetToken() {
  const token = (location.hash.match(/^#reset=([0-9a-f]{64})$/) || [])[1];
  if (token) history.replaceState(null, '', location.pathname + location.search);
  return token;
}

window.addEventListener('hashchange', () => {
  const token = takeResetToken();
  if (token) openResetPassword(token);
});

async function boot() {
  const resetToken = takeResetToken();
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    state.csrfToken = data.csrfToken || null;
    await loadBands(); await loadBandData(); render();
  } catch { render(); }
  if (resetToken) openResetPassword(resetToken);
}

document.addEventListener('click', async (event) => {
  const authMode = event.target.closest('[data-auth-mode]');
  if (authMode) {
    state.authMode = authMode.dataset.authMode;
    document.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button === authMode));
    $('#nickname-field').classList.toggle('hidden', state.authMode !== 'register');
    $('#auth-submit').textContent = state.authMode === 'register' ? 'Criar conta' : 'Entrar';
    $('#forgot-password').classList.toggle('hidden', state.authMode === 'register');
    $('#auth-info').textContent = '';
    return;
  }
  const screen = event.target.closest('[data-screen]');
  if (screen) { state.screen = screen.dataset.screen; if (state.screen === 'history') await loadBandData(); render(); return; }
  const rename = event.target.closest('[data-rename-band]');
  if (rename) { openBandRename(rename.dataset.renameBand); return; }
  const toggle = event.target.closest('[data-toggle-band]');
  if (toggle) { await toggleBand(toggle.dataset.toggleBand); return; }
  const band = event.target.closest('[data-switch-band]');
  if (band) { await switchBand(band.dataset.switchBand); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'forgot-password') openForgotPassword();
  if (action === 'new-band') openBandForm();
  if (action === 'threshold') openThresholdForm();
  if (action === 'new-music') openMusicForm();
  if (action === 'new-setlist') openSetlistForm();
  if (action === 'member') formModal('Adicionar músico', '<label>Nickname do usuário<input name="nickname" required></label>', async (form) => {
    const bandId = state.band.id;
    await api(`/api/bandas/${bandId}/membros`, { method: 'POST', body: { nickname: form.get('nickname') } });
    await loadBands(); state.band = state.bands.find((band) => band.id === bandId);
    delete state.bandMembers[bandId];
    if (state.expandedBands[bandId]) await loadBandMembers(bandId);
    render(); showToast('Músico adicionado.');
  });
  const edit = event.target.closest('[data-edit-music]');
  if (edit) openMusicForm(state.music.find((song) => song.id === edit.dataset.editMusic));
  const open = event.target.closest('[data-open-setlist]');
  if (open) await openSetlist(open.dataset.openSetlist);
  const draft = event.target.closest('[data-open-draft]');
  if (draft) await openDraft(state.drafts.find((item) => item.id === draft.dataset.openDraft));
});

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = { email: form.get('email'), password: form.get('password') };
  if (state.authMode === 'register') body.nickname = form.get('nickname');
  try {
    const result = await api(`/api/auth/${state.authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', body });
    state.csrfToken = result.csrfToken || null;
    state.user = result.user; $('#auth-error').textContent = ''; $('#auth-info').textContent = ''; await loadBands(); await loadBandData(); render();
  } catch (error) {
    // Login aceito, mas a chamada seguinte voltou 401: o navegador não guardou o cookie de sessão.
    const cookieLost = error.code === 'AUTHENTICATION_REQUIRED';
    if (cookieLost) { state.user = null; state.csrfToken = null; }
    $('#auth-error').textContent = cookieLost
      ? 'O login foi aceito, mas este navegador não guardou a sessão. Verifique se os cookies estão ativados e, se o acesso for por HTTP (sem HTTPS), configure COOKIE_SECURE=false no servidor.'
      : error.message;
  }
});

$('#logout-button').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null; state.band = null; state.csrfToken = null; state.drafts = []; render();
});

boot();
