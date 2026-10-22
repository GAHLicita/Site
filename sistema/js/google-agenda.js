/* Sincronização com o Google Agenda (conta contato@gahlicita.com.br), nos dois sentidos.
   - Sistema → Google: compromissos da Agenda e datas de disputa das Licitações viram eventos no Google.
     Os lançamentos automáticos (parcelas a pagar, fins de vigência, custos e mensalidade do contador) também
     vão, do dia de hoje em diante, sem alarme, e somem do Google quando forem pagos ou mudarem. Parcelas a
     receber não vão. Disputas avisam 15 minutos antes do horário.
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
  let conexaoDoLogin = null;
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

  /* A permissão do Google (vale ~1 hora) fica guardada só nesta aba (sessionStorage). Assim, ao clicar em
     "Atualizar agora" ou apertar F5, a Agenda continua conectada sem pedir nada. Fechar a aba, sair do
     sistema ou ir para outro site apaga a permissão. */
  const CHAVE_TOKEN = 'gah-google-token';
  function guardarToken() {
    try { sessionStorage.setItem(CHAVE_TOKEN, JSON.stringify({ token, expira: tokenExpira })); } catch (e) { /* ignora */ }
  }
  function apagarTokenGuardado() {
    try { sessionStorage.removeItem(CHAVE_TOKEN); } catch (e) { /* ignora */ }
  }
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE_TOKEN) || 'null');
    if (salvo && salvo.token && Date.now() < salvo.expira) { token = salvo.token; tokenExpira = salvo.expira; }
    else apagarTokenGuardado();
  } catch (e) { /* ignora */ }

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
          guardarToken();
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
    if (r.status === 401) { token = null; apagarTokenGuardado(); avisar(); throw Object.assign(new Error('A conexão com o Google expirou. Conecte de novo.'), { semToken: true }); }
    if (r.status === 404 || r.status === 410) return null;
    if (!r.ok) throw new Error('Google Agenda: ' + r.status + ' ' + (await r.text()).slice(0, 200));
    return r.status === 204 ? null : r.json();
  }

  /* Alarmes no Google: só as disputas (licitações e compromissos do tipo Disputa) avisam, 15 minutos antes
     do horário. O resto (fins de vigência, pagamentos, reuniões, prazos) fica na agenda sem alarme. */
  const SEM_ALARME = { useDefault: false, overrides: [] };
  const alarme = (item) => (item.disputa && item.hora ? { useDefault: false, overrides: [{ method: 'popup', minutes: 15 }] } : SEM_ALARME);
  // Sobe quando muda o formato dos eventos: os já enviados ao Google são reenviados uma vez.
  const VERSAO_EVENTO = 2;

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
      reminders: alarme(item),
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
    await D.salvar(colecao, Object.assign({}, D.obter(colecao, doc.id) || doc, { googleEventId: ev.id, googlePendente: false, googleAtualizado: ev.updated, googleVersao: VERSAO_EVENTO }));
  }

  async function apagar(doc) {
    if (doc.googleEventId) await api('/events/' + encodeURIComponent(doc.googleEventId), { method: 'DELETE' }).catch((e) => { if (!/404|410/.test(e.message)) throw e; });
  }

  /* ---------- lançamentos automáticos: vencimentos, fins de vigência e custos ---------- */
  const COR_AUTO = { pagar: '6', renovacao: '11' };
  const ROTULO_AUTO = { pagar: 'A pagar', renovacao: 'Fim de vigência' };
  // Id fixo por lançamento (o Google aceita letras de a a v e números): o mesmo vencimento nunca vira dois eventos.
  function idAuto(chave) {
    return 'gah' + Array.from(new TextEncoder().encode(chave), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  function eventoAuto(e) {
    return {
      id: idAuto(e.chave),
      summary: e.titulo,
      description: [ROTULO_AUTO[e.tipo], e.detalhe, 'Lançado automaticamente pelo Sistema GAH Licita. Para mudar, altere no sistema.'].filter(Boolean).join('\n\n'),
      start: { date: e.data },
      end: { date: calc.addDias(e.data, 1) },
      colorId: COR_AUTO[e.tipo],
      transparency: 'transparent',
      reminders: SEM_ALARME,
      extendedProperties: { private: { gahAuto: '1', gahChave: e.chave } }
    };
  }
  const semAlarme = (ev) => !!ev.reminders && ev.reminders.useDefault === false && !(ev.reminders.overrides || []).length;
  const assinatura = (ev) => [ev.summary, ev.description, ev.start && ev.start.date, ev.colorId, semAlarme(ev)].join('|');

  async function listarAutomaticos(desde) {
    const itens = [];
    let pagina = '';
    do {
      const q = new URLSearchParams({ privateExtendedProperty: 'gahAuto=1', timeMin: desde + 'T00:00:00-03:00', singleEvents: 'true', maxResults: '2500' });
      if (pagina) q.set('pageToken', pagina);
      const r = await api('/events?' + q.toString());
      itens.push(...((r && r.items) || []));
      pagina = r && r.nextPageToken;
    } while (pagina);
    return itens;
  }

  let sincronizandoAuto = null;
  function sincronizarAutomaticos() {
    if (sincronizandoAuto) return sincronizandoAuto;
    sincronizandoAuto = (async () => {
      const hoje = calc.hoje();
      const desejados = new Map();
      GAH.eventosAutomaticos().forEach((e) => {
        if (e.chave && COR_AUTO[e.tipo] && e.data >= hoje) desejados.set(idAuto(e.chave), eventoAuto(e));
      });
      // sem os dados carregados (banco fora do ar), não mexe no Google para não apagar nada por engano
      if (D.erroBanco || !D.lista('contratos').length) return { enviados: 0, removidos: 0, erros: [] };
      const existentes = new Map((await listarAutomaticos(hoje)).map((ev) => [ev.id, ev]));
      const r = { enviados: 0, removidos: 0, erros: [] };
      for (const [id, ev] of desejados) {
        const atual = existentes.get(id);
        if (atual && assinatura(atual) === assinatura(ev)) continue;
        try {
          if (atual) await api('/events/' + id, { method: 'PUT', body: JSON.stringify(ev) });
          else {
            try { await api('/events', { method: 'POST', body: JSON.stringify(ev) }); } catch (e) {
              // 409: o evento já existiu e foi apagado; reaproveita o mesmo id
              if (!/ 409 /.test(e.message)) throw e;
              await api('/events/' + id, { method: 'PUT', body: JSON.stringify(Object.assign({ status: 'confirmed' }, ev)) });
            }
          }
          r.enviados++;
        } catch (e) { if (e.semToken) throw e; r.erros.push(e.message); }
      }
      // pago, cancelado ou com outra data: sai do Google (o que já passou fica como histórico)
      for (const [id, ev] of existentes) {
        if (desejados.has(id) || ev.status === 'cancelled' || (ev.start && ev.start.date < hoje)) continue;
        try { await api('/events/' + id, { method: 'DELETE' }); r.removidos++; } catch (e) { if (e.semToken) throw e; r.erros.push(e.message); }
      }
      return r;
    })().finally(() => { sincronizandoAuto = null; });
    return sincronizandoAuto;
  }

  GAH.google = {
    configurado: () => !!cfg().clientId,
    conectado: () => !!token && Date.now() < tokenExpira,
    lembrado,
    aoMudar(f) { ouvintes.add(f); return () => ouvintes.delete(f); },

    async conectar(silencioso) {
      await pedirToken(silencioso);
      Object.keys(cache).forEach((k) => delete cache[k]);
      avisar();
      // envia em segundo plano: na primeira vez podem ser dezenas de vencimentos
      GAH.google.sincronizarPendentes().then((r) => {
        if (r.erros.length) GAH.u.aviso('Alguns itens não foram para o Google Agenda: ' + r.erros[0], true);
        else if (r.enviados) GAH.u.aviso(r.enviados + ' item(ns) enviados ao Google Agenda');
        avisar();
      }).catch((e) => GAH.u.aviso('Google Agenda: ' + e.message, true));
    },

    /* Conexão automática no login: se este navegador já conectou o Google antes, o clique em "Entrar"
       também pede a permissão ao Google (sem perguntar de novo). Os navegadores só deixam abrir a
       janelinha do Google a partir de um clique, por isso o pedido sai junto com o login. */
    preparar() {
      if (GAH.google.configurado() && lembrado()) carregarGis().catch(() => {});
    },
    conectarNoLogin() {
      if (!GAH.google.configurado() || !lembrado() || !(window.google && google.accounts && google.accounts.oauth2)) return;
      conexaoDoLogin = pedirToken(true).then(() => { Object.keys(cache).forEach((k) => delete cache[k]); avisar(); }).catch((e) => { console.warn('Google Agenda não conectou no login', e); });
    },
    /* Chamado quando o sistema abre (dados já carregados): termina a conexão do login e sincroniza. */
    async aoEntrar() {
      if (!conexaoDoLogin) return;
      const espera = conexaoDoLogin;
      conexaoDoLogin = null;
      await espera;
      if (!GAH.google.conectado()) return;
      try {
        const r = await GAH.google.sincronizarPendentes();
        if (r.erros.length) GAH.u.aviso('Alguns itens não foram para o Google Agenda: ' + r.erros[0], true);
        avisar();
      } catch (e) { console.warn(e); }
    },

    /* Esquece a permissão desta aba sem desligar a conexão automática do próximo login. */
    esquecerToken() {
      token = null;
      tokenExpira = 0;
      apagarTokenGuardado();
      Object.keys(cache).forEach((k) => delete cache[k]);
      avisar();
    },

    desconectar() {
      if (token && window.google) google.accounts.oauth2.revoke(token, () => {});
      token = null;
      apagarTokenGuardado();
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

    /* Envia o que ficou pendente, os compromissos/disputas futuros que ainda não estão no Google e os
       lançamentos automáticos. Devolve { enviados, removidos, erros }. */
    async sincronizarPendentes() {
      if (!GAH.google.conectado()) throw new Error('Conecte o Google Agenda.');
      const hoje = calc.hoje();
      const fila = [];
      D.lista('agenda').forEach((x) => {
        const desatualizado = x.googleEventId && (x.googleVersao || 1) < VERSAO_EVENTO && x.data >= hoje;
        if (x.googlePendente || desatualizado || (!x.googleEventId && !x.concluido && x.data >= hoje)) fila.push(['agenda', x]);
      });
      D.lista('licitacoes').forEach((x) => {
        const desatualizado = x.googleEventId && (x.googleVersao || 1) < VERSAO_EVENTO && paraSincronizar('licitacoes', x) && x.dataDisputa >= hoje;
        if (x.googlePendente || desatualizado || (!x.googleEventId && paraSincronizar('licitacoes', x) && x.dataDisputa >= hoje)) fila.push(['licitacoes', x]);
      });
      const r = { enviados: 0, removidos: 0, erros: [] };
      for (const [c, doc] of fila) {
        try { await enviar(c, doc); r.enviados++; } catch (e) {
          if (e.semToken) throw e;
          console.warn('Falha ao enviar ' + c + ' ' + doc.id, e);
          r.erros.push((doc.titulo || doc.orgao || '') + ': ' + e.message);
        }
      }
      const a = await sincronizarAutomaticos();
      r.enviados += a.enviados;
      r.removidos = a.removidos;
      r.erros.push(...a.erros);
      Object.keys(cache).forEach((k) => delete cache[k]);
      return r;
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
        if (priv.gahAuto) continue; // vencimentos e custos já aparecem pelo próprio sistema
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

  // Pagou uma parcela, mudou um vencimento ou criou um custo: atualiza o Google alguns segundos depois.
  let esperaAuto = null;
  D.aoMudar(() => {
    if (!GAH.google.conectado()) return;
    clearTimeout(esperaAuto);
    esperaAuto = setTimeout(() => {
      if (!GAH.google.conectado()) return;
      sincronizarAutomaticos().then((r) => { if (r.enviados || r.removidos) avisar(); }).catch((e) => console.warn(e));
    }, 5000);
  });

  // Mantém a conexão viva: se já autorizou antes, renova sozinho perto de expirar (sem abrir janela).
  setInterval(() => {
    if (token && Date.now() > tokenExpira - 120000 && clienteToken) clienteToken.requestAccessToken({ prompt: '' });
  }, 60000);
})();
