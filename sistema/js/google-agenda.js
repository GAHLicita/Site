/* Sincronização com o Google Agenda (conta contato@gahlicita.com.br), nos dois sentidos.
   - Sistema → Google: compromissos da Agenda e datas de disputa das Licitações viram eventos no Google.
   - Google → Sistema: os eventos do Google aparecem no calendário do sistema; se um evento criado pelo
     sistema for alterado ou apagado no Google, o compromisso do sistema acompanha.
   Usa o login do Google no navegador (Google Identity Services) e a Google Calendar API.
   Fica desligado enquanto GAH.googleConfig.clientId estiver vazio (veja js/config.js). */
(function () {
  const D = GAH.dados;
  const calc = GAH.calc;
  const ESCOPO = 'https://www.googleapis.com/auth/calendar.events';
  const API = 'https://www.googleapis.com/calendar/v3/calendars/';
  const FUSO = 'America/Sao_Paulo';
  const CHAVE_LEMBRAR = 'gah-google-conectado';

  let token = null;
  let tokenExpira = 0;
  let clienteToken = null;
  let carregandoGis = null;
  const cache = {}; // eventos do Google por intervalo 'ini|fim'
  const ouvintes = new Set();
  const avisar = () => ouvintes.forEach((f) => f());

  const cfg = () => GAH.googleConfig || {};
  const agendaId = () => encodeURIComponent(cfg().calendarId || 'primary');

  function lembrar(v) {
    try { if (v) localStorage.setItem(CHAVE_LEMBRAR, '1'); else localStorage.removeItem(CHAVE_LEMBRAR); } catch (e) { /* ignora */ }
  }
  function lembrado() {
    try { return localStorage.getItem(CHAVE_LEMBRAR) === '1'; } catch (e) { return false; }
  }

  function carregarGis() {
    if (window.google && google.accounts && google.accounts.oauth2) return Promise.resolve();
    if (carregandoGis) return carregandoGis;
    carregandoGis = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { carregandoGis = null; reject(new Error('Não foi possível carregar o login do Google.')); };
      document.head.appendChild(s);
    });
    return carregandoGis;
  }

  /* Pede (ou renova) a permissão. Precisa ser chamado a partir de um clique na primeira vez. */
  function pedirToken(silencioso) {
    return carregarGis().then(() => new Promise((resolve, reject) => {
      clienteToken = google.accounts.oauth2.initTokenClient({
        client_id: cfg().clientId,
        scope: ESCOPO,
        hint: cfg().conta || '',
        callback: (r) => {
          if (r.error) { reject(new Error(r.error_description || r.error)); return; }
          token = r.access_token;
          tokenExpira = Date.now() + (Number(r.expires_in) || 3600) * 1000 - 60000;
          lembrar(true);
          resolve();
        },
        error_callback: (e) => reject(new Error(e && e.type === 'popup_closed' ? 'A janela do Google foi fechada antes de autorizar.' : (e && e.message) || 'Login do Google cancelado.'))
      });
      clienteToken.requestAccessToken({ prompt: silencioso ? '' : 'consent' });
    }));
  }

  async function api(caminho, opcoes) {
    if (!token || Date.now() > tokenExpira) throw Object.assign(new Error('Conecte o Google Agenda.'), { semToken: true });
    const r = await fetch(API + agendaId() + caminho, Object.assign({}, opcoes, {
      headers: Object.assign({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, (opcoes || {}).headers)
    }));
    if (r.status === 401) { token = null; avisar(); throw Object.assign(new Error('A conexão com o Google expirou. Conecte de novo.'), { semToken: true }); }
    if (r.status === 404 || r.status === 410) return null;
    if (!r.ok) throw new Error('Google Agenda: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r.status === 204 ? null : r.json();
  }

  /* ---------- conversão compromisso ↔ evento ---------- */
  function evento(item) {
    const fimDia = calc.addDias(item.data, 1);
    const tempo = item.hora
      ? { start: { dateTime: item.data + 'T' + item.hora + ':00', timeZone: FUSO }, end: { dateTime: item.data + 'T' + somarHora(item.hora) + ':00', timeZone: FUSO } }
      : { start: { date: item.data }, end: { date: fimDia } };
    return Object.assign(tempo, {
      summary: item.titulo,
      location: item.local || '',
      description: [item.descricao, item.orgao ? 'Órgão: ' + item.orgao : '', 'Criado pelo Sistema GAH Licita'].filter(Boolean).join('\n\n'),
      colorId: item.disputa ? '9' : undefined,
      extendedProperties: { private: { gahColecao: item.colecao, gahId: item.id } }
    });
  }
  function somarHora(h) {
    const [hh, mm] = h.split(':').map(Number);
    const t = Math.min(hh * 60 + mm + 60, 23 * 60 + 59);
    return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
  }
  function dataDoEvento(ev) {
    if (ev.start.date) return { data: ev.start.date, hora: '' };
    const dt = new Date(ev.start.dateTime);
    const local = new Date(dt.toLocaleString('en-US', { timeZone: FUSO }));
    const p = (n) => String(n).padStart(2, '0');
    return { data: local.getFullYear() + '-' + p(local.getMonth() + 1) + '-' + p(local.getDate()), hora: p(local.getHours()) + ':' + p(local.getMinutes()) };
  }

  /* O que vai para o Google: compromissos da Agenda e disputas das Licitações em andamento. */
  function paraSincronizar(colecao, doc) {
    if (colecao === 'agenda') {
      return { colecao, id: doc.id, titulo: doc.titulo, data: doc.data, hora: doc.hora, local: doc.local, descricao: doc.descricao,
        orgao: doc.clienteId ? GAH.u.nomeCliente(doc.clienteId) : '', disputa: doc.tipo === 'Disputa' };
    }
    if (colecao === 'licitacoes' && doc.dataDisputa && ['analise', 'proposta', 'disputa'].includes(doc.status)) {
      return { colecao, id: doc.id, titulo: 'Disputa — ' + (doc.orgao || 'licitação'), data: doc.dataDisputa, hora: doc.horaDisputa,
        local: [doc.portal, doc.linkEdital].filter(Boolean).join(' · '), descricao: [doc.numeroEdital ? 'Edital ' + doc.numeroEdital : '', doc.objeto].filter(Boolean).join('\n'),
        orgao: doc.orgao, disputa: true };
    }
    return null;
  }

  async function enviar(colecao, doc) {
    const item = paraSincronizar(colecao, doc);
    if (!item) return apagar(doc); // licitação sem disputa futura: tira do Google, se estava lá
    const corpo = JSON.stringify(evento(item));
    let ev = doc.googleEventId ? await api('/events/' + encodeURIComponent(doc.googleEventId), { method: 'PATCH', body: corpo }) : null;
    if (!ev) ev = await api('/events', { method: 'POST', body: corpo });
    await D.salvar(colecao, Object.assign({}, D.obter(colecao, doc.id) || doc, { googleEventId: ev.id, googlePendente: false, googleAtualizado: ev.updated }));
  }

  async function apagar(doc) {
    if (doc.googleEventId) await api('/events/' + encodeURIComponent(doc.googleEventId), { method: 'DELETE' }).catch((e) => { if (!/404|410/.test(e.message)) throw e; });
  }

  GAH.google = {
    configurado: () => !!cfg().clientId,
    conectado: () => !!token && Date.now() < tokenExpira,
    lembrado,
    aoMudar(f) { ouvintes.add(f); return () => ouvintes.delete(f); },

    async conectar(silencioso) {
      await pedirToken(silencioso);
      Object.keys(cache).forEach((k) => delete cache[k]);
      await GAH.google.sincronizarPendentes().catch((e) => console.warn(e));
      avisar();
    },

    desconectar() {
      if (token && window.google) google.accounts.oauth2.revoke(token, () => {});
      token = null;
      lembrar(false);
      Object.keys(cache).forEach((k) => delete cache[k]);
      avisar();
    },

    /* Sistema → Google, chamado depois de salvar ou excluir no sistema. Sem conexão, fica pendente. */
    async aoSalvar(colecao, doc) {
      if (!GAH.google.configurado()) return;
      if (!GAH.google.conectado()) {
        if (paraSincronizar(colecao, doc) || doc.googleEventId) await D.salvar(colecao, Object.assign({}, doc, { googlePendente: true }));
        return;
      }
      try { await enviar(colecao, doc); avisar(); } catch (e) {
        console.warn(e);
        await D.salvar(colecao, Object.assign({}, D.obter(colecao, doc.id) || doc, { googlePendente: true }));
        GAH.u.aviso('Salvo no sistema, mas não foi para o Google Agenda: ' + e.message, true);
      }
    },
    async aoExcluir(doc) {
      if (!GAH.google.configurado() || !doc.googleEventId) return;
      if (!GAH.google.conectado()) { GAH.u.aviso('Excluído no sistema. Conecte o Google Agenda e apague o evento lá também.', true); return; }
      try { await apagar(doc); avisar(); } catch (e) { GAH.u.aviso('Não foi possível apagar no Google Agenda: ' + e.message, true); }
    },

    /* Envia o que ficou pendente e os compromissos/disputas futuros que ainda não estão no Google. */
    async sincronizarPendentes() {
      if (!GAH.google.conectado()) return 0;
      const hoje = calc.hoje();
      const fila = [];
      D.lista('agenda').forEach((x) => {
        if (x.googlePendente || (!x.googleEventId && !x.concluido && x.data >= hoje)) fila.push(['agenda', x]);
      });
      D.lista('licitacoes').forEach((x) => {
        if (x.googlePendente || (!x.googleEventId && paraSincronizar('licitacoes', x) && x.dataDisputa >= hoje)) fila.push(['licitacoes', x]);
      });
      let n = 0;
      for (const [c, doc] of fila) {
        try { await enviar(c, doc); n++; } catch (e) { console.warn('Falha ao enviar ' + c + ' ' + doc.id, e); }
      }
      return n;
    },

    /* Google → Sistema: eventos do intervalo para mostrar no calendário, e atualização dos
       compromissos do sistema que foram mudados ou apagados no Google. */
    async eventos(ini, fim) {
      if (!GAH.google.conectado()) return [];
      const chave = ini + '|' + fim;
      if (cache[chave] && Date.now() - cache[chave].em < 60000) return cache[chave].lista;
      const q = new URLSearchParams({ timeMin: ini + 'T00:00:00-03:00', timeMax: calc.addDias(fim, 1) + 'T00:00:00-03:00', singleEvents: 'true', showDeleted: 'true', maxResults: '500', orderBy: 'startTime' });
      const r = await api('/events?' + q.toString());
      const lista = [];
      for (const ev of (r && r.items) || []) {
        const priv = (ev.extendedProperties && ev.extendedProperties.private) || {};
        if (priv.gahId) {
          const doc = D.obter(priv.gahColecao, priv.gahId);
          if (!doc) continue;
          if (ev.status === 'cancelled') {
            if (priv.gahColecao === 'agenda') await D.excluir('agenda', doc.id);
            else await D.salvar('licitacoes', Object.assign({}, doc, { googleEventId: '' }));
            continue;
          }
          if (ev.updated && doc.googleAtualizado && ev.updated > doc.googleAtualizado && !doc.googlePendente) {
            const { data, hora } = dataDoEvento(ev);
            const mudancas = priv.gahColecao === 'agenda'
              ? { titulo: ev.summary || doc.titulo, data, hora, local: ev.location || '' }
              : { dataDisputa: data, horaDisputa: hora };
            await D.salvar(priv.gahColecao, Object.assign({}, doc, mudancas, { googleAtualizado: ev.updated }));
          }
          continue; // já aparece como compromisso do sistema
        }
        if (ev.status === 'cancelled') continue;
        const { data, hora } = dataDoEvento(ev);
        lista.push({ data, hora, titulo: ev.summary || '(sem título)', tipo: 'google', link: ev.htmlLink, detalhe: ['Google Agenda', ev.location].filter(Boolean).join(' · ') });
      }
      cache[chave] = { em: Date.now(), lista };
      return lista;
    }
  };

  // Mantém a conexão viva: se já autorizou antes, renova sozinho perto de expirar (sem abrir janela).
  setInterval(() => {
    if (token && Date.now() > tokenExpira - 120000 && clienteToken) clienteToken.requestAccessToken({ prompt: '' });
  }, 60000);
})();
