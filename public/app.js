const state = {
  user: null,
  bands: [],
  band: null,
  music: [],
  setlists: [],
  history: [],
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
const dateLabel = (value) => new Date(`${value}T00:00:00`).toLocaleDateString('pt-BR');

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
  if (!response.ok) throw new Error(data.error?.message || 'Não foi possível concluir a operação.');
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
  const [music, setlists, history] = await Promise.all([
    api(`/api/bandas/${id}/musicas`),
    api(`/api/bandas/${id}/setlists-confirmados`),
    state.band.role === 'leader' ? api(`/api/bandas/${id}/historico`) : Promise.resolve({ historico: [] })
  ]);
  state.music = music.music;
  state.setlists = setlists.setlists;
  state.history = history.historico;
}

function render() {
  $('#auth-view').classList.toggle('hidden', Boolean(state.user));
  $('#main-view').classList.toggle('hidden', !state.user);
  if (!state.user) return;
  $('#page-title').textContent = { home: 'Início', music: 'Repertório', setlists: 'Setlists', history: 'Histórico' }[state.screen];
  document.querySelectorAll('.bottom-nav button').forEach((button) => button.classList.toggle('active', button.dataset.screen === state.screen));
  const views = { home: renderHome, music: renderMusic, setlists: renderSetlists, history: renderHistory };
  views[state.screen]();
}

function renderHome() {
  const bandOptions = state.bands.map((band) => `
    <button class="card band-card" data-switch-band="${band.id}">
      <span><strong>${escapeHtml(band.name)}</strong><small class="muted">${band.memberCount} membro(s) · ${band.role === 'leader' ? 'Líder' : 'Músico'}</small></span>
      <span>›</span>
    </button>`).join('');
  $('#content').innerHTML = `
    <div class="card">
      <span class="eyebrow">OLÁ, ${escapeHtml(state.user.nickname || '')}</span>
      <h2>${state.band ? escapeHtml(state.band.name) : 'Crie sua primeira banda'}</h2>
      <p class="muted">${state.band ? 'Escolha uma área para continuar.' : 'Comece organizando seu repertório.'}</p>
      ${state.band?.role === 'leader' ? `<button class="secondary" data-action="new-band">+ Nova banda</button>` : ''}
    </div>
    <div class="toolbar"><h2>Minhas bandas</h2><button class="secondary" data-action="new-band">Adicionar</button></div>
    <div class="grid">${bandOptions || '<div class="card empty">Nenhuma banda cadastrada.</div>'}</div>
    ${state.band?.role === 'leader' ? `<div class="card" style="margin-top:12px"><div class="toolbar"><div><h3>Limiar de transição</h3><small class="muted">Atual: ${state.band.transitionThresholdSemitones} semitons</small></div><button class="secondary" data-action="threshold">Editar</button></div><button class="secondary" data-action="member" style="width:100%">+ Adicionar músico</button></div>` : ''}`;
}

function renderMusic() {
  const rows = state.music.map((song) => `
    <div class="music-row">
      <div><strong>${escapeHtml(song.titulo)}</strong><div class="track-meta">${song.tom} · ${song.bpm} BPM · ${formatDuration(song.duracaoSegundos)}</div></div>
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
  const leaderAction = state.band.role === 'leader' ? '<button class="primary" data-action="new-setlist">+ Setlist</button>' : '';
  $('#content').innerHTML = `
    <div class="toolbar"><div><h2>Setlists</h2><small class="muted">Confirmados disponíveis para a banda</small></div>${leaderAction}</div>
    <div class="grid">${state.setlists.map((setlist) => setlistCard(setlist, `data-open-setlist="${setlist.id}"`)).join('') || '<div class="card empty">Nenhum setlist confirmado ainda.</div>'}</div>
    ${state.band.role === 'leader' ? '<div class="card" style="margin-top:12px"><small class="muted">Setlists em rascunho são acessados pelo fluxo de criação do líder.</small></div>' : ''}`;
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

function openThresholdForm() {
  formModal('Limiar de transição', `<label>Semitons<input name="value" type="number" min="0" max="12" value="${state.band.transitionThresholdSemitones}" required></label>`, async (form) => {
    await api(`/api/bandas/${state.band.id}/limiar-transicao`, { method: 'PUT', body: { limiarTransicaoSemitons: Number(form.get('value')) } });
    await loadBands(); state.band = state.bands.find((band) => band.id === state.band.id); render(); showToast('Limiar atualizado.');
  });
}

function openMusicForm(song = {}) {
  formModal(song.id ? 'Editar música' : 'Nova música', `
    <label>Título<input name="titulo" value="${escapeHtml(song.titulo || '')}" required></label>
    <div class="grid two"><label>Tom<select name="tom">${['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'].map((key) => `<option ${key === song.tom ? 'selected' : ''}>${key}</option>`).join('')}</select></label><label>BPM<input name="bpm" type="number" min="1" value="${song.bpm || 120}" required></label></div>
    <label>Duração (segundos)<input name="duracaoSegundos" type="number" min="1" value="${song.duracaoSegundos || 180}" required></label>
    <label>Observações<textarea name="observacoes">${escapeHtml(song.observacoes || '')}</textarea></label>
    <label>Cifra/anexo<input name="cifraAnexo" value="${escapeHtml(song.cifraAnexo || '')}"></label>`, async (form) => {
    const body = { titulo: form.get('titulo'), tom: form.get('tom'), bpm: Number(form.get('bpm')), duracaoSegundos: Number(form.get('duracaoSegundos')), observacoes: form.get('observacoes'), cifraAnexo: form.get('cifraAnexo') };
    await api(`/api/bandas/${state.band.id}/musicas${song.id ? `/${song.id}` : ''}`, { method: song.id ? 'PUT' : 'POST', body });
    await loadBandData(); render(); showToast(song.id ? 'Música atualizada.' : 'Música cadastrada.');
  });
}

function openSetlistForm() {
  const choices = state.music.map((song) => `<label><input type="checkbox" name="music" value="${song.id}"> ${escapeHtml(song.titulo)} <small class="muted">(${song.tom})</small></label>`).join('');
  formModal('Novo setlist', `<label>Nome<input name="nome" required></label><label>Data<input name="data" type="date" required></label><label>Tempo disponível (segundos)<input name="tempo" type="number" min="1" value="3600" required></label><div class="card form-stack"><strong>Selecione as músicas</strong>${choices || '<small class="muted">Cadastre músicas primeiro.</small>'}</div>`, async (form) => {
    const musicaIds = form.getAll('music');
    const result = await api(`/api/bandas/${state.band.id}/setlists`, { method: 'POST', body: { nome: form.get('nome'), data: form.get('data'), tempoDisponivelSegundos: Number(form.get('tempo')), musicaIds } });
    await openDraft(result.setlist.id);
  });
}

async function openDraft(id) {
  const draft = await api(`/api/bandas/${state.band.id}/setlists/${id}/sugestao`).catch(() => null);
  const setlist = draft?.setlist || null;
  if (!setlist) { showToast('Setlist criado. Gere a sugestão na tela de edição.', true); return; }
  const suggested = draft.sugestao;
  const modal = showModal(setlist.nome, `<div id="draft-body"></div>`);
  const body = modal.querySelector('#draft-body');
  const renderDraft = (items) => {
    body.innerHTML = `<p class="muted">${dateLabel(setlist.data)} · ${formatDuration(suggested.duracaoTotal)}</p>${suggested.alertaTempoExcedido ? '<div class="alert">O tempo disponível foi excedido.</div>' : ''}<div class="card">${items.map((item, index) => `<div class="track"><span class="track-index">${index + 1}</span><div class="track-main"><strong>${escapeHtml(item.titulo)}</strong><small class="track-meta">${item.tom} · ${formatDuration(item.duracaoSegundos)}</small></div><div class="actions"><button data-move="${index}" data-dir="-1">↑</button><button data-move="${index}" data-dir="1">↓</button></div></div>`).join('')}</div><div class="actions" style="margin-top:14px"><button class="secondary" data-draft-suggest>Sugerir ordem</button><button class="primary" data-draft-confirm>Confirmar</button></div>`;
    body.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', async () => {
      const from = Number(button.dataset.move), to = from + Number(button.dataset.dir);
      if (to < 0 || to >= items.length) return;
      [items[from], items[to]] = [items[to], items[from]];
      await api(`/api/bandas/${state.band.id}/setlists/${id}/ordem`, { method: 'PUT', body: { musicaIds: items.map((item) => item.musicaId || item.id) } });
      renderDraft(items);
    }));
    body.querySelector('[data-draft-suggest]').addEventListener('click', async () => { const result = await api(`/api/bandas/${state.band.id}/setlists/${id}/sugestao`); renderDraft(result.sugestao.musicas); });
    body.querySelector('[data-draft-confirm]').addEventListener('click', async () => { await api(`/api/bandas/${state.band.id}/setlists/${id}/confirmar`, { method: 'POST' }); modal.closest('.modal-backdrop').remove(); await loadBandData(); render(); showToast('Setlist confirmado.'); });
  };
  renderDraft(suggested.musicas);
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
  const modal = showModal(setlist.nome, `<p class="muted">${dateLabel(setlist.data)} · ${setlist.estado}</p><div class="card">${result.setlist.musicas.map((song, index) => `<div class="track"><span class="track-index">${index + 1}</span><div class="track-main"><strong>${escapeHtml(song.titulo)}</strong><small class="track-meta">${song.tom} · ${song.bpm} BPM · ${formatDuration(song.duracaoSegundos)}</small><small class="track-meta">${escapeHtml(song.observacoes || 'Sem observações')} ${song.cifraAnexo ? `· ${escapeHtml(song.cifraAnexo)}` : ''}</small></div><select data-mastery="${song.id}"><option value="">Domínio</option>${['Não Sei','Preciso Revisar','Sei Bem'].map((level) => `<option ${song.nivelDominio === level ? 'selected' : ''}>${level}</option>`).join('')}</select></div>`).join('')}</div>${leaderActions}`);
  modal.querySelectorAll('[data-mastery]').forEach((select) => select.addEventListener('change', async () => {
    if (!select.value) return;
    await api(`/api/bandas/${state.band.id}/musicas/${select.dataset.mastery}/dominio`, { method: 'PUT', body: { nivel: select.value } });
    showToast('Domínio atualizado.');
  }));
  modal.querySelector('[data-reopen-setlist]')?.addEventListener('click', async () => {
    await api(`/api/bandas/${state.band.id}/setlists/${id}/reabrir`, { method: 'POST' });
    modal.closest('.modal-backdrop').remove();
    await openDraft(id);
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

async function boot() {
  try {
    const data = await api('/api/auth/me');
    state.user = data.user;
    state.csrfToken = data.csrfToken || null;
    await loadBands(); await loadBandData(); render();
  } catch { render(); }
}

document.addEventListener('click', async (event) => {
  const authMode = event.target.closest('[data-auth-mode]');
  if (authMode) {
    state.authMode = authMode.dataset.authMode;
    document.querySelectorAll('[data-auth-mode]').forEach((button) => button.classList.toggle('active', button === authMode));
    $('#nickname-field').classList.toggle('hidden', state.authMode !== 'register');
    $('#auth-submit').textContent = state.authMode === 'register' ? 'Criar conta' : 'Entrar';
    return;
  }
  const screen = event.target.closest('[data-screen]');
  if (screen) { state.screen = screen.dataset.screen; if (state.screen === 'history') await loadBandData(); render(); return; }
  const band = event.target.closest('[data-switch-band]');
  if (band) { await switchBand(band.dataset.switchBand); return; }
  const action = event.target.closest('[data-action]')?.dataset.action;
  if (action === 'new-band') openBandForm();
  if (action === 'threshold') openThresholdForm();
  if (action === 'new-music') openMusicForm();
  if (action === 'new-setlist') openSetlistForm();
  if (action === 'member') formModal('Adicionar músico', '<label>Nickname do usuário<input name="nickname" required></label>', async (form) => {
    await api(`/api/bandas/${state.band.id}/membros`, { method: 'POST', body: { nickname: form.get('nickname') } });
    await loadBands(); state.band = state.bands.find((band) => band.id === state.band.id); render(); showToast('Músico adicionado.');
  });
  const edit = event.target.closest('[data-edit-music]');
  if (edit) openMusicForm(state.music.find((song) => song.id === edit.dataset.editMusic));
  const open = event.target.closest('[data-open-setlist]');
  if (open) await openSetlist(open.dataset.openSetlist);
});

$('#auth-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const body = { email: form.get('email'), password: form.get('password') };
  if (state.authMode === 'register') body.nickname = form.get('nickname');
  try {
    const result = await api(`/api/auth/${state.authMode === 'register' ? 'register' : 'login'}`, { method: 'POST', body });
    state.user = result.user; $('#auth-error').textContent = ''; await loadBands(); await loadBandData(); render();
    state.csrfToken = result.csrfToken || null;
  } catch (error) { $('#auth-error').textContent = error.message; }
});

$('#logout-button').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  state.user = null; state.band = null; render();
});

boot();
