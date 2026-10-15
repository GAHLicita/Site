/* Tela Agenda: calendário do mês com compromissos, disputas e vencimentos automáticos. */
(function () {
  const { esc, dataBR, opcoes, janela, lerForm, aviso, botaoExcluir, MESES, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const TIPOS = ['Disputa', 'Reunião', 'Prazo de entrega', 'Envio de proposta', 'Assinatura de contrato', 'Cobrança', 'Outro'];
  const estado = { mes: '', automaticos: true };

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
      await D.excluir('agenda', a.id);
      j.fechar();
      aviso('Compromisso excluído');
    });
    j.el.querySelector('#form-agenda').addEventListener('submit', async (e) => {
      e.preventDefault();
      await D.salvar('agenda', Object.assign({}, a, lerForm(e.target)));
      j.fechar();
      aviso('Compromisso salvo');
    });
  };

  function eventosDoPeriodo(ini, fim) {
    const manuais = D.lista('agenda').filter((a) => a.data >= ini && a.data <= fim).map((a) => ({
      data: a.data, hora: a.hora, titulo: a.titulo, tipo: a.tipo === 'Disputa' ? 'disputa' : 'manual', id: a.id, feito: a.concluido,
      detalhe: [a.tipo, a.local, a.clienteId ? GAH.u.nomeCliente(a.clienteId) : ''].filter(Boolean).join(' · ')
    }));
    const auto = estado.automaticos ? GAH.eventosAutomaticos().filter((e) => e.data >= ini && e.data <= fim) : [];
    return manuais.concat(auto).sort((a, b) => (a.data + (a.hora || '99')).localeCompare(b.data + (b.hora || '99')));
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
      '<div class="grade grade-lateral">' +
      '<section class="painel"><div class="painel-cab"><div class="acoes"><button class="botao secundario pequeno" id="mes-ant" aria-label="Mês anterior">‹</button>' +
      '<h2 style="min-width:170px;text-align:center">' + MESES[mes - 1].charAt(0).toUpperCase() + MESES[mes - 1].slice(1) + ' ' + ano + '</h2>' +
      '<button class="botao secundario pequeno" id="mes-prox" aria-label="Próximo mês">›</button><button class="botao secundario pequeno" id="mes-hoje">Hoje</button></div>' +
      '<label class="parcela-check"><input type="checkbox" id="ag-auto"' + (estado.automaticos ? ' checked' : '') + '> Mostrar vencimentos automáticos</label></div>' +
      '<div class="tabela-rolagem"><div class="calendario">' + grade + '</div></div>' +
      '<div class="painel-corpo legenda" style="margin:0"><span><i style="background:var(--navy)"></i>Disputa</span><span><i style="background:var(--info-fundo);border:1px solid var(--info)"></i>Compromisso</span><span><i style="background:var(--ok-fundo);border:1px solid var(--ok)"></i>A receber</span><span><i style="background:var(--alerta-fundo);border:1px solid var(--alerta)"></i>A pagar</span><span><i style="background:var(--critico-fundo);border:1px solid var(--critico)"></i>Fim de vigência</span></div>' +
      '</section>' +
      '<section class="painel"><div class="painel-cab"><h2>Próximos 30 dias</h2></div>' +
      (proximos.length
        ? '<ul class="avisos">' + proximos.map((e) =>
            '<li><div class="data-bloco"><b>' + e.data.slice(8, 10) + '</b><span>' + MESES_CURTOS[Number(e.data.slice(5, 7)) - 1] + '</span></div><div class="titulo">' +
            (e.id ? '<button type="button" class="link-botao" style="text-decoration:none;color:var(--tinta);font-weight:600;text-align:left" data-ag="' + esc(e.id) + '">' + esc(e.titulo) + '</button>' : '<a href="' + esc(e.link || '#/agenda') + '">' + esc(e.titulo) + '</a>') +
            '<span class="detalhe">' + esc((e.hora ? e.hora + ' · ' : '') + (e.detalhe || '')) + '</span></div><span class="evento ' + e.tipo + '" style="width:auto">' + ({ disputa: 'disputa', receber: 'receber', pagar: 'pagar', renovacao: 'vigência', manual: 'agenda' }[e.tipo] || '') + '</span></li>'
          ).join('') + '</ul>'
        : '<div class="vazio"><strong>Nada nos próximos 30 dias</strong>Clique em um dia do calendário para marcar um compromisso.</div>') +
      '</section></div>';

    const mudarMes = (n) => { estado.mes = calc.addMeses(estado.mes + '-01', n).slice(0, 7); GAH.telas.agenda(main); };
    main.querySelector('#mes-ant').addEventListener('click', () => mudarMes(-1));
    main.querySelector('#mes-prox').addEventListener('click', () => mudarMes(1));
    main.querySelector('#mes-hoje').addEventListener('click', () => { estado.mes = hoje.slice(0, 7); GAH.telas.agenda(main); });
    main.querySelector('#ag-auto').addEventListener('change', (e) => { estado.automaticos = e.target.checked; GAH.telas.agenda(main); });
    main.querySelector('#novo-ag').addEventListener('click', () => GAH.formCompromisso(null, hoje));
    main.onclick = (e) => {
      const ag = e.target.closest('[data-ag]');
      if (ag) { GAH.formCompromisso(D.obter('agenda', ag.dataset.ag)); return; }
      const lk = e.target.closest('[data-link]');
      if (lk) { if (lk.dataset.link) location.hash = lk.dataset.link; return; }
      const dia = e.target.closest('[data-dia]');
      if (dia) GAH.formCompromisso(null, dia.dataset.dia);
    };
  };
})();
