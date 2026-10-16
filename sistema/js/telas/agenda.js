/* Tela Agenda: calendário do mês com compromissos, disputas e vencimentos automáticos. */
(function () {
  const { esc, dataBR, opcoes, janela, lerForm, aviso, botaoExcluir, MESES, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const TIPOS = ['Disputa', 'Reunião', 'Prazo de entrega', 'Envio de proposta', 'Assinatura de contrato', 'Cobrança', 'Outro'];
  const estado = { mes: '', automaticos: true, google: { chave: '', em: 0, lista: [], erro: '', buscando: false } };

  GAH.formCompromisso = function (item, dataPadrao) {
    const a = item || { data: dataPadrao || calc.hoje(), tipo: 'Disputa' };
    const clientes = D.lista('clientes').slice().sort((x, y) => x.nome.localeCompare(y.nome));
    const corpo =
      '<form id="form-agenda" class="form-grade">' +
      '<div class="campo largo"><label for="ag-titulo">Título *</label><input id="ag-titulo" name="titulo" required value="' + esc(a.titulo) + '" placeholder="Ex.: Pregão 45/2026 — Prefeitura de Lins"></div>' +
      '<div class="campo"><label for="ag-tipo">Tipo</label><select id="ag-tipo" name="tipo">' + opcoes(TIPOS, a.tipo) + '</select></div>' +
      '<div class="campo"><label for="ag-data">Data *</label><input id="ag-data" name="data" type="date" required value="' + esc(a.data) + '"></div>' +
      '<div class="campo"><label for="ag-hora">Hora</label><input id="ag-hora" name="hora" type="time" value="' + esc(a.hora) + '"></div>' +
      '<div class="campo"><label for="ag-cliente">Órgão (opcional)</label><select id="ag-cliente" name="clienteId">' + opcoes(clientes.map((x) => [x.id, x.nome]), a.clienteId, 'Nenhum') + '</select></div>' +
      '<div class="campo largo"><label for="ag-local">Local, portal ou link</label><input id="ag-local" name="local" value="' + esc(a.local) + '" placeholder="Ex.: Compras.gov.br, BLL, sala de reunião, link do Meet"></div>' +
      '<div class="campo largo"><label for="ag-desc">Anotações</label><textarea id="ag-desc" name="descricao">' + esc(a.descricao) + '</textarea></div>' +
      '<label class="parcela-check largo"><input type="checkbox" name="concluido"' + (a.concluido ? ' checked' : '') + '> Concluído</label>' +
      '</form>';
    const rodape = (a.id ? '<button type="button" class="botao perigo" id="excluir-ag">Excluir</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-agenda" class="botao">Salvar</button></div>';
    const j = janela({ titulo: a.id ? 'Editar compromisso' : 'Novo compromisso', corpo, rodape, estreita: true });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    botaoExcluir(j.el, '#excluir-ag', 'Excluir este compromisso?', async () => {
      if (GAH.google) GAH.google.aoExcluir(a);
      await D.excluir('agenda', a.id);
      j.fechar();
      aviso('Compromisso excluído');
    });
    j.el.querySelector('#form-agenda').addEventListener('submit', async (e) => {
      e.preventDefault();
      const salvo = await D.salvar('agenda', Object.assign({}, a, lerForm(e.target)));
      j.fechar();
      aviso('Compromisso salvo');
      if (GAH.google) GAH.google.aoSalvar('agenda', salvo);
    });
  };

  function eventosDoPeriodo(ini, fim) {
    const manuais = D.lista('agenda').filter((a) => a.data >= ini && a.data <= fim).map((a) => ({
      data: a.data, hora: a.hora, titulo: a.titulo, tipo: a.tipo === 'Disputa' ? 'disputa' : 'manual', id: a.id, feito: a.concluido,
      detalhe: [a.tipo, a.local, a.clienteId ? GAH.u.nomeCliente(a.clienteId) : ''].filter(Boolean).join(' · ')
    }));
    const auto = estado.automaticos ? GAH.eventosAutomaticos().filter((e) => e.data >= ini && e.data <= fim) : [];
    const google = estado.google.lista.filter((e) => e.data >= ini && e.data <= fim);
    return manuais.concat(auto, google).sort((a, b) => (a.data + (a.hora || '99')).localeCompare(b.data + (b.hora || '99')));
  }

  function faixaGoogle() {
    const G = GAH.google;
    if (!G) return '';
    if (!G.configurado()) {
      return '<div class="faixa-google"><span class="g-logo" aria-hidden="true">G</span><span>Google Agenda ainda não ligado. Falta cadastrar a credencial do Google (veja o LEIAME).</span></div>';
    }
    if (!G.conectado()) {
      return '<div class="faixa-google"><span class="g-logo" aria-hidden="true">G</span><span>' + (G.lembrado() ? 'Clique para reconectar o Google Agenda (contato@gahlicita.com.br).' : 'Conecte o Google Agenda para sincronizar os compromissos nos dois sentidos.') + '</span>' +
        '<button type="button" class="botao pequeno" id="g-conectar">' + (G.lembrado() ? 'Reconectar' : 'Conectar Google Agenda') + '</button></div>';
    }
    const pend = D.lista('agenda').concat(D.lista('licitacoes')).filter((x) => x.googlePendente).length;
    return '<div class="faixa-google conectado"><span class="g-logo" aria-hidden="true">G</span><span><b>Google Agenda sincronizado.</b> ' +
      (estado.google.erro ? '<span class="negativo">' + esc(estado.google.erro) + '</span>' : 'Compromissos, disputas, vencimentos, fins de vigência e custos vão para o Google, e os eventos do Google aparecem aqui.') +
      (pend ? ' ' + pend + ' pendente(s).' : '') + '</span>' +
      '<button type="button" class="botao secundario pequeno" id="g-sincronizar">Sincronizar agora</button><button type="button" class="link-botao" id="g-desconectar">Desconectar</button></div>';
  }

  GAH.telas.agenda = function (main) {
    const hoje = calc.hoje();
    if (!estado.mes) estado.mes = hoje.slice(0, 7);
    const [ano, mes] = estado.mes.split('-').map(Number);
    const primeiro = estado.mes + '-01';
    const diaSemana = new Date(ano, mes - 1, 1).getDay();
    const inicioGrade = calc.addDias(primeiro, -diaSemana);
    const ultimoDia = new Date(ano, mes, 0).getDate();
    const semanas = Math.ceil((diaSemana + ultimoDia) / 7);
    const fimGrade = calc.addDias(inicioGrade, semanas * 7 - 1);
    const gIni = inicioGrade < hoje ? inicioGrade : hoje;
    const fim30 = calc.addDias(hoje, 30);
    const gFim = fimGrade > fim30 ? fimGrade : fim30;
    const gChave = gIni + '|' + gFim;
    const G = GAH.google;
    if (G && G.conectado() && !estado.google.buscando && (estado.google.chave !== gChave || Date.now() - estado.google.em > 60000)) {
      estado.google.buscando = true;
      G.eventos(gIni, gFim)
        .then((lista) => { estado.google = { chave: gChave, em: Date.now(), lista, erro: '', buscando: false }; })
        .catch((e) => { estado.google = { chave: gChave, em: Date.now(), lista: [], erro: e.message, buscando: false }; })
        .then(() => { if (location.hash.startsWith('#/agenda')) GAH.telas.agenda(main); });
    }
    if (G && !G.conectado()) estado.google.lista = [];
    const eventos = eventosDoPeriodo(inicioGrade, fimGrade);
    const porDia = {};
    eventos.forEach((e) => (porDia[e.data] = porDia[e.data] || []).push(e));
    const proximos = eventosDoPeriodo(hoje, calc.addDias(hoje, 30)).filter((e) => !e.feito);

    let grade = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'].map((d) => '<div class="dia-semana">' + d + '</div>').join('');
    for (let i = 0; i < semanas * 7; i++) {
      const d = calc.addDias(inicioGrade, i);
      const evs = porDia[d] || [];
      grade += '<div class="dia' + (d.slice(0, 7) !== estado.mes ? ' fora' : '') + (d === hoje ? ' hoje' : '') + '" data-dia="' + d + '"><span class="n">' + Number(d.slice(8)) + '</span>' +
        evs.slice(0, 3).map((e) => '<button type="button" class="evento ' + e.tipo + (e.feito ? ' feito' : '') + '" title="' + esc(e.titulo + (e.hora ? ' · ' + e.hora : '')) + '"' + (e.id ? ' data-ag="' + esc(e.id) + '"' : ' data-link="' + esc(e.link || '') + '"') + '>' + (e.hora ? esc(e.hora) + ' ' : '') + esc(e.titulo) + '</button>').join('') +
        (evs.length > 3 ? '<span class="mais-eventos">+' + (evs.length - 3) + ' mais</span>' : '') + '</div>';
    }

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Agenda</h1><p>Disputas, reuniões e prazos. Vencimentos de parcelas e fins de vigência entram sozinhos.</p></div>' +
      '<div class="acoes"><button class="botao" id="novo-ag">+ Novo compromisso</button></div></div>' +
      faixaGoogle() +
      '<div class="grade grade-lateral">' +
      '<section class="painel"><div class="painel-cab"><div class="acoes"><button class="botao secundario pequeno" id="mes-ant" aria-label="Mês anterior">‹</button>' +
      '<h2 style="min-width:170px;text-align:center">' + MESES[mes - 1].charAt(0).toUpperCase() + MESES[mes - 1].slice(1) + ' ' + ano + '</h2>' +
      '<button class="botao secundario pequeno" id="mes-prox" aria-label="Próximo mês">›</button><button class="botao secundario pequeno" id="mes-hoje">Hoje</button></div>' +
      '<label class="parcela-check"><input type="checkbox" id="ag-auto"' + (estado.automaticos ? ' checked' : '') + '> Mostrar vencimentos automáticos</label></div>' +
      '<div class="tabela-rolagem"><div class="calendario">' + grade + '</div></div>' +
      '<div class="painel-corpo legenda" style="margin:0"><span><i style="background:var(--navy)"></i>Disputa</span><span><i style="background:var(--info-fundo);border:1px solid var(--info)"></i>Compromisso</span><span><i style="background:var(--ok-fundo);border:1px solid var(--ok)"></i>A receber</span><span><i style="background:var(--alerta-fundo);border:1px solid var(--alerta)"></i>A pagar</span><span><i style="background:var(--critico-fundo);border:1px solid var(--critico)"></i>Fim de vigência</span>' + (GAH.google && GAH.google.conectado() ? '<span><i class="leg-google"></i>Google Agenda</span>' : '') + '</div>' +
      '</section>' +
      '<section class="painel"><div class="painel-cab"><h2>Próximos 30 dias</h2></div>' +
      (proximos.length
        ? '<ul class="avisos">' + proximos.map((e) =>
            '<li><div class="data-bloco"><b>' + e.data.slice(8, 10) + '</b><span>' + MESES_CURTOS[Number(e.data.slice(5, 7)) - 1] + '</span></div><div class="titulo">' +
            (e.id ? '<button type="button" class="link-botao" style="text-decoration:none;color:var(--tinta);font-weight:600;text-align:left" data-ag="' + esc(e.id) + '">' + esc(e.titulo) + '</button>' : '<a href="' + esc(e.link || '#/agenda') + '"' + (/^https?:/.test(e.link || '') ? ' target="_blank" rel="noopener"' : '') + '>' + esc(e.titulo) + '</a>') +
            '<span class="detalhe">' + esc((e.hora ? e.hora + ' · ' : '') + (e.detalhe || '')) + '</span></div><span class="evento ' + e.tipo + '" style="width:auto">' + ({ disputa: 'disputa', receber: 'receber', pagar: 'pagar', renovacao: 'vigência', manual: 'agenda', google: 'Google' }[e.tipo] || '') + '</span></li>'
          ).join('') + '</ul>'
        : '<div class="vazio"><strong>Nada nos próximos 30 dias</strong>Clique em um dia do calendário para marcar um compromisso.</div>') +
      '</section></div>';

    const mudarMes = (n) => { estado.mes = calc.addMeses(estado.mes + '-01', n).slice(0, 7); GAH.telas.agenda(main); };
    main.querySelector('#mes-ant').addEventListener('click', () => mudarMes(-1));
    main.querySelector('#mes-prox').addEventListener('click', () => mudarMes(1));
    main.querySelector('#mes-hoje').addEventListener('click', () => { estado.mes = hoje.slice(0, 7); GAH.telas.agenda(main); });
    main.querySelector('#ag-auto').addEventListener('change', (e) => { estado.automaticos = e.target.checked; GAH.telas.agenda(main); });
    main.querySelector('#novo-ag').addEventListener('click', () => GAH.formCompromisso(null, hoje));
    const gBtn = (id, f) => { const b = main.querySelector(id); if (b) b.addEventListener('click', f); };
    gBtn('#g-conectar', async () => {
      try { await GAH.google.conectar(false); estado.google.chave = ''; aviso('Google Agenda conectado'); GAH.telas.agenda(main); }
      catch (e) { aviso('Não foi possível conectar: ' + e.message, true); }
    });
    gBtn('#g-sincronizar', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Sincronizando…';
      try {
        const r = await GAH.google.sincronizarPendentes();
        estado.google.chave = '';
        if (r.erros.length) aviso('Não foram para o Google ' + r.erros.length + ' item(ns): ' + r.erros[0], true);
        else aviso(r.enviados || r.removidos ? [r.enviados ? r.enviados + ' item(ns) enviados ao Google' : '', r.removidos ? r.removidos + ' removido(s) do Google' : ''].filter(Boolean).join(', ') : 'Tudo sincronizado');
      } catch (err) { aviso(err.message, true); }
      GAH.telas.agenda(main);
    });
    gBtn('#g-desconectar', () => { GAH.google.desconectar(); estado.google.lista = []; GAH.telas.agenda(main); });
    main.onclick = (e) => {
      const ag = e.target.closest('[data-ag]');
      if (ag) { GAH.formCompromisso(D.obter('agenda', ag.dataset.ag)); return; }
      const lk = e.target.closest('[data-link]');
      if (lk) {
        const destino = lk.dataset.link;
        if (/^https?:/.test(destino)) window.open(destino, '_blank', 'noopener');
        else if (destino) location.hash = destino;
        return;
      }
      const dia = e.target.closest('[data-dia]');
      if (dia) GAH.formCompromisso(null, dia.dataset.dia);
    };
  };
})();
