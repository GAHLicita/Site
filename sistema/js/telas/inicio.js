/* Tela Início: o que precisa de atenção hoje. */
(function () {
  const { esc, moeda, dataBR, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;

  function itemAviso(ev, selo) {
    return (
      '<li><div class="data-bloco"><b>' + ev.data.slice(8, 10) + '</b><span>' + MESES_CURTOS[Number(ev.data.slice(5, 7)) - 1] + (ev.data.slice(0, 4) !== calc.hoje().slice(0, 4) ? ' ' + ev.data.slice(2, 4) : '') + '</span></div>' +
      '<div class="titulo"><a href="' + esc(ev.link || '#/agenda') + '">' + esc(ev.titulo) + '</a><span class="detalhe">' + esc(ev.detalhe || '') + (ev.hora ? ' · ' + esc(ev.hora) : '') + '</span></div>' +
      (selo || '') + '</li>'
    );
  }

  function lista(eventos, vazioTitulo, vazioTexto, seloFn) {
    if (!eventos.length) return '<div class="vazio"><strong>' + esc(vazioTitulo) + '</strong>' + esc(vazioTexto) + '</div>';
    return '<ul class="avisos">' + eventos.map((e) => itemAviso(e, seloFn ? seloFn(e) : '')).join('') + '</ul>';
  }

  GAH.telas.inicio = function (main) {
    const hoje = calc.hoje();
    const em7 = calc.addDias(hoje, 7);
    const em30 = calc.addDias(hoje, 30);
    const cfg = D.configuracao();
    const emAviso = calc.addDias(hoje, cfg.diasAvisoVigencia);
    const contratos = D.lista('contratos');
    const geral = calc.resumoGeral(contratos, D.lista('despesas'), D.lista('clientes'), hoje);
    const auto = GAH.eventosAutomaticos();
    const manuais = D.lista('agenda')
      .filter((a) => !a.concluido && a.data)
      .map((a) => ({ data: a.data, hora: a.hora, tipo: a.tipo, titulo: a.titulo, detalhe: [a.tipo, a.local].filter(Boolean).join(' · '), link: '#/agenda' }));

    const atrasados = auto.filter((e) => e.tipo === 'receber' && e.data < hoje).sort((a, b) => a.data.localeCompare(b.data));
    const receber30 = auto.filter((e) => e.tipo === 'receber' && e.data >= hoje && e.data <= em30).sort((a, b) => a.data.localeCompare(b.data));
    const pagar30 = auto.filter((e) => e.tipo === 'pagar' && e.data <= em30).sort((a, b) => a.data.localeCompare(b.data));
    const renovacoes = auto.filter((e) => e.tipo === 'renovacao' && e.data >= hoje && e.data <= emAviso).sort((a, b) => a.data.localeCompare(b.data));
    const compromissos = manuais.concat(auto.filter((e) => e.tipo === 'disputa')).filter((e) => e.data >= hoje && e.data <= calc.addDias(hoje, 14)).sort((a, b) => (a.data + (a.hora || '')).localeCompare(b.data + (b.hora || '')));
    const receberSemana = auto.filter((e) => e.tipo === 'receber' && e.data >= hoje && e.data <= em7).reduce((s, e) => s + e.valor, 0);
    const pagarMes = pagar30.reduce((s, e) => s + e.valor, 0);

    const h = new Date().getHours();
    const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const dataExtenso = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>' + saudacao + '!</h1><p>' + esc(dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)) + '. Veja o que precisa de atenção.</p></div>' +
      '<div class="acoes"><button class="botao secundario" id="ini-orgao">+ Órgão</button><button class="botao secundario" id="ini-compromisso">+ Compromisso</button><button class="botao" id="ini-contrato">+ Contrato</button></div></div>' +
      '<div class="kpis">' +
      '<div class="kpi destaque"><span class="kpi-rotulo">A receber (total)</span><span class="kpi-valor">' + moeda(geral.aReceber) + '</span><span class="kpi-nota">' + geral.contratosAtivos + ' contratos ativos</span></div>' +
      '<div class="kpi' + (geral.valorAtrasado ? ' alerta' : '') + '"><span class="kpi-rotulo">Recebimentos em atraso</span><span class="kpi-valor">' + moeda(geral.valorAtrasado) + '</span><span class="kpi-nota">' + geral.parcelasAtrasadas + ' parcela(s)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Entra nos próximos 7 dias</span><span class="kpi-valor">' + moeda(receberSemana) + '</span><span class="kpi-nota">até ' + dataBR(em7) + '</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">A pagar em 30 dias</span><span class="kpi-valor">' + moeda(pagarMes) + '</span><span class="kpi-nota">' + pagar30.length + ' pagamento(s) de compras</span></div>' +
      '</div>' +
      '<div class="grade grade-2">' +
      '<section class="painel"><div class="painel-cab"><h2>Recebimentos em atraso</h2><span class="sub">Cobrar o órgão</span></div>' +
      lista(atrasados, 'Nada em atraso', 'Todos os órgãos estão em dia.', () => '<span class="selo critico">atrasado</span>') + '</section>' +
      '<section class="painel"><div class="painel-cab"><h2>Agenda dos próximos 14 dias</h2><a href="#/agenda" class="sub">Abrir agenda</a></div>' +
      lista(compromissos, 'Nenhum compromisso marcado', 'Cadastre disputas, reuniões e prazos na Agenda.', (e) => (e.tipo === 'disputa' || e.tipo === 'Disputa' ? '<span class="selo info">disputa</span>' : '')) + '</section>' +
      '<section class="painel"><div class="painel-cab"><h2>A receber nos próximos 30 dias</h2><span class="sub">' + moeda(receber30.reduce((s, e) => s + e.valor, 0)) + '</span></div>' +
      lista(receber30, 'Nenhum vencimento', 'Não há parcelas para receber nos próximos 30 dias.') + '</section>' +
      '<section class="painel"><div class="painel-cab"><h2>Compras a pagar em 30 dias</h2><span class="sub">' + moeda(pagarMes) + '</span></div>' +
      lista(pagar30, 'Nada a pagar', 'Nenhuma parcela de compra vence nos próximos 30 dias.', (e) => (e.data < hoje ? '<span class="selo critico">vencida</span>' : '')) + '</section>' +
      '</div>' +
      '<section class="painel"><div class="painel-cab"><h2>Contratos que vencem em até ' + cfg.diasAvisoVigencia + ' dias</h2><span class="sub">Oportunidades de renovação</span></div>' +
      lista(renovacoes, 'Nenhum contrato vencendo', 'Nenhuma vigência termina nos próximos ' + cfg.diasAvisoVigencia + ' dias.', (e) => { const n = calc.diasEntre(hoje, e.data); return '<span class="selo alerta">' + (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : n + ' dias') + '</span>'; }) + '</section>';

    main.querySelector('#ini-orgao').addEventListener('click', () => GAH.formCliente(null, (c) => (location.hash = '#/clientes/' + c.id)));
    main.querySelector('#ini-contrato').addEventListener('click', () => GAH.formContrato(null));
    main.querySelector('#ini-compromisso').addEventListener('click', () => GAH.formCompromisso(null, hoje));
  };
})();
