/* Tela Contratos: todos os contratos em uma tabela, com filtros. */
(function () {
  const { esc, moeda, dataBR, opcoes, seloVigencia, nomeCliente, ufCliente, nomeForma, janela } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const filtro = { busca: '', vigencia: '', forma: '', ano: '' };

  function abrirContrato(id) {
    const c = D.obter('contratos', id);
    if (!c) return;
    const j = janela({ titulo: nomeCliente(c.clienteId), corpo: '<div id="detalhe-contrato" style="margin:-18px -20px">' + GAH.blocoContrato(c, { mostrarOrgao: true }) + '</div>' });
    const caixa = j.el.querySelector('#detalhe-contrato');
    GAH.ligarContratos(caixa);
    const desliga = D.aoMudar(() => {
      const atual = D.obter('contratos', id);
      if (!atual) { j.fechar(); return; }
      const abertos = [...caixa.querySelectorAll('details[open]')].map((d) => d.dataset.chave);
      caixa.innerHTML = GAH.blocoContrato(atual, { mostrarOrgao: true });
      caixa.querySelectorAll('details').forEach((d) => { if (abertos.includes(d.dataset.chave)) d.open = true; });
    });
    j.el.addEventListener('click', (e) => { if (e.target.closest('a[href^="#/"]')) j.fechar(); });
    const obs = new MutationObserver(() => { if (!document.body.contains(j.el)) { desliga(); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
  }
  GAH.abrirContrato = abrirContrato;

  GAH.telas.contratos = function (main) {
    const hoje = calc.hoje();
    const todos = D.lista('contratos').map((c) => ({ c, s: calc.resumoContrato(c, hoje), orgao: nomeCliente(c.clienteId) }));
    const anos = [...new Set(todos.map(({ c }) => (c.vigenciaInicio || c.dataEntrega || '').slice(0, 4)).filter(Boolean))].sort().reverse();
    // Ordem: os que terminam a vigência primeiro no topo; vencidos sem renovação, contratos já renovados e
    // cancelados no fim. Renovação ainda não entregue mostra a vigência do contrato atual (o anterior).
    const ren = calc.renovacoes(D.lista('contratos'), hoje);
    todos.forEach((x) => {
      const r = ren[x.c.id];
      x.anterior = r && r.pendente ? D.obter('contratos', r.anterior) : null;
      x.vigIni = x.anterior ? x.anterior.vigenciaInicio : x.c.vigenciaInicio;
      x.vigFim = x.anterior ? x.anterior.vigenciaFim : x.c.vigenciaFim;
      x.grupo = x.c.status === 'cancelado' ? 4 : ren.porAnterior[x.c.id] ? 3 : !x.vigFim ? 1 : x.vigFim < hoje || x.c.status === 'encerrado' ? 2 : 0;
    });
    const visao = GAH.visaoFinanceira();
    todos.forEach((x) => (x.entregue = calc.licencasEntregues(x.c, hoje, ren)));
    const naoEntregues = todos.filter((x) => !x.entregue && x.c.status !== 'cancelado').length;
    const linhas = todos
      .filter(({ c, s, orgao, entregue }) => {
        if (visao === 'entregues' && !entregue) return false;
        const t = filtro.busca.toLowerCase();
        if (t && ![orgao, c.produto, c.fornecedor, c.numeroContrato, c.numeroEmpenho].join(' ').toLowerCase().includes(t)) return false;
        if (filtro.vigencia === 'receber' ? s.aReceber <= 0 : filtro.vigencia === 'pagar' ? s.aPagar <= 0 : filtro.vigencia === 'atraso' ? s.parcelasAtrasadas === 0 : filtro.vigencia && s.vigencia !== filtro.vigencia) return false;
        if (filtro.forma && (c.venda && c.venda.forma) !== filtro.forma) return false;
        if (filtro.ano && (c.vigenciaInicio || c.dataEntrega || '').slice(0, 4) !== filtro.ano) return false;
        return true;
      })
      .sort((a, b) => a.grupo - b.grupo || (a.grupo >= 2 ? (b.vigFim || '').localeCompare(a.vigFim || '') : (a.vigFim || '9').localeCompare(b.vigFim || '9')) || a.orgao.localeCompare(b.orgao));
    const TITULO_GRUPO = { 1: 'Sem data de vigência', 2: 'Vencidos sem renovação', 3: 'Contratos anteriores, já renovados', 4: 'Cancelados' };
    const selo = (x) => {
      if (x.grupo === 3) return '<span class="selo info">Renovado</span>';
      if (!x.anterior) return seloVigencia(x.s);
      const n = calc.diasEntre(hoje, x.vigFim);
      return '<span class="selo ' + (n < 0 ? 'critico' : 'alerta') + '">' + (n < 0 ? 'Entrega atrasada' : n === 0 ? 'Entregar hoje' : 'Entregar em ' + n + ' dias') + '</span>';
    };
    const soma = linhas.reduce((t, { s }) => ({ venda: t.venda + s.venda, recebido: t.recebido + s.recebido, aReceber: t.aReceber + s.aReceber, aPagar: t.aPagar + s.aPagar, lucro: t.lucro + s.lucro }), { venda: 0, recebido: 0, aReceber: 0, aPagar: 0, lucro: 0 });

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Contratos</h1><p>Todas as licenças vendidas, com recebimentos, compras e lucro de cada uma.</p></div>' +
      '<div class="acoes"><button class="botao" id="novo-contrato">+ Novo contrato</button></div></div>' +
      '<section class="painel"><div class="painel-cab"><div class="filtros" style="flex:1">' +
      '<input class="filtro busca" id="ct-busca" type="search" placeholder="Buscar órgão, licença, fabricante ou nº" value="' + esc(filtro.busca) + '" aria-label="Buscar">' +
      '<select class="filtro" id="ct-vig" aria-label="Situação">' + opcoes([['vigente', 'Vigentes'], ['vencendo', 'Vencendo em breve'], ['encerrada', 'Encerrados'], ['receber', 'Com valor a receber'], ['atraso', 'Com parcela atrasada'], ['pagar', 'Com compra a pagar'], ['cancelado', 'Cancelados']], filtro.vigencia, 'Todas as situações') + '</select>' +
      '<select class="filtro" id="ct-forma" aria-label="Forma de recebimento">' + opcoes([['integral', 'Integral'], ['mensal', 'Mensal'], ['parcelado', 'Parcelado']], filtro.forma, 'Toda forma de recebimento') + '</select>' +
      '<select class="filtro" id="ct-ano" aria-label="Ano de início">' + opcoes(anos, filtro.ano, 'Todos os anos') + '</select>' +
      '<div class="visao-financeira" role="group" aria-label="Quais contratos mostrar">' +
      '<button type="button" data-visao="total" aria-pressed="' + (visao === 'total') + '">Total</button>' +
      '<button type="button" data-visao="entregues" aria-pressed="' + (visao === 'entregues') + '">Só licenças entregues' + (naoEntregues ? ' (' + naoEntregues + ' fora)' : '') + '</button></div>' +
      '</div></div>' +
      (linhas.length
        ? '<div class="tabela-rolagem cabecalho-fixo"><table class="tabela tabela-contratos"><thead><tr><th>Órgão / licença</th><th>Vigência</th><th>Recebimento</th><th class="valor">Venda</th><th class="valor">Recebido</th><th class="valor">A receber</th><th class="valor">A pagar</th><th class="valor">Lucro</th><th>Situação</th></tr></thead><tbody>' +
          linhas.map((x, i) => {
            const { c, s, orgao } = x;
            const titulo = x.grupo && (i === 0 || linhas[i - 1].grupo !== x.grupo) ? '<tr class="linha-grupo"><td colspan="9">' + TITULO_GRUPO[x.grupo] + '</td></tr>' : '';
            const vig = x.anterior
              ? dataBR(x.vigIni) + '<span class="sub">até <b>' + dataBR(x.vigFim) + '</b> (atual)</span><span class="sub renovacao-info">Renovado: ' + dataBR(c.vigenciaInicio) + ' a ' + dataBR(c.vigenciaFim) + '</span>' +
                '<button type="button" class="botao verde botao-entregue" data-entregue="' + esc(c.id) + '">Licenças entregues</button>'
              : dataBR(c.vigenciaInicio) + '<span class="sub">até ' + dataBR(c.vigenciaFim) + '</span>';
            return titulo + '<tr class="clicavel' + (x.grupo >= 3 ? ' linha-apagada' : '') + '" data-id="' + esc(c.id) + '"><td><span class="nome">' + esc(orgao) + (ufCliente(c.clienteId) ? ' <span class="texto-suave">· ' + esc(ufCliente(c.clienteId)) + '</span>' : '') + '</span><span class="sub">' + esc([c.produto, c.fornecedor].filter(Boolean).join(' · ')) + '</span></td>' +
            '<td>' + vig + '</td>' +
            '<td>' + nomeForma(c.venda && c.venda.forma) + '<span class="sub">' + s.parcelasRecebidas + '/' + s.totalParcelasVenda + ' recebida(s)</span></td>' +
            '<td class="valor">' + moeda(s.venda) + '</td><td class="valor">' + moeda(s.recebido) + '</td>' +
            '<td class="valor">' + moeda(s.aReceber) + (s.parcelasAtrasadas ? '<span class="sub negativo">' + s.parcelasAtrasadas + ' atrasada(s)</span>' : '') + '</td>' +
            '<td class="valor">' + moeda(s.aPagar) + (s.parcelasPagar ? '<span class="sub">' + s.parcelasPagar + ' parcela(s)</span>' : '') + '</td>' +
            '<td class="valor ' + (s.lucro < 0 ? 'negativo' : '') + '">' + moeda(s.lucro) + '</td>' +
            '<td>' + selo(x) + '</td></tr>';
          }).join('') +
          '</tbody><tfoot><tr><td colspan="2">' + linhas.length + ' contrato(s)</td><td></td><td class="valor">' + moeda(soma.venda) + '</td><td class="valor">' + moeda(soma.recebido) + '</td><td class="valor">' + moeda(soma.aReceber) + '</td><td class="valor">' + moeda(soma.aPagar) + '</td><td class="valor">' + moeda(soma.lucro) + '</td><td></td></tr></tfoot></table></div>'
        : '<div class="vazio"><strong>' + (todos.length ? 'Nenhum contrato com esses filtros' : 'Nenhum contrato cadastrado') + '</strong>' + (todos.length ? 'Mude a busca ou os filtros.' : 'Cadastre primeiro o órgão em Clientes e depois o contrato.') + '</div>') +
      '</section>';

    main.querySelector('#novo-contrato').addEventListener('click', () => {
      if (!D.lista('clientes').length) {
        GAH.u.aviso('Cadastre o órgão primeiro, em Clientes.', true);
        return;
      }
      GAH.formContrato(null);
    });
    const reler = () => {
      filtro.busca = main.querySelector('#ct-busca').value;
      filtro.vigencia = main.querySelector('#ct-vig').value;
      filtro.forma = main.querySelector('#ct-forma').value;
      filtro.ano = main.querySelector('#ct-ano').value;
      const pos = main.querySelector('#ct-busca').selectionStart;
      GAH.telas.contratos(main);
      const b = main.querySelector('#ct-busca');
      if (document.activeElement === document.body) { b.focus(); b.setSelectionRange(pos, pos); }
    };
    main.querySelector('#ct-busca').addEventListener('input', reler);
    main.querySelectorAll('[data-visao]').forEach((bt) => bt.addEventListener('click', () => { GAH.visaoFinanceira(bt.dataset.visao); GAH.telas.contratos(main); }));
    ['#ct-vig', '#ct-forma', '#ct-ano'].forEach((s) => main.querySelector(s).addEventListener('change', reler));
    main.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('[data-entregue]')) abrirContrato(tr.dataset.id); }));
    // Ok de entrega da renovação: a partir daí o contrato passa a mostrar a nova vigência.
    main.querySelectorAll('[data-entregue]').forEach((b) => b.addEventListener('click', async () => {
      const c = D.obter('contratos', b.dataset.entregue);
      if (!c) return;
      b.disabled = true;
      await D.salvar('contratos', Object.assign({}, c, { licencasEntregues: true, dataEntrega: c.dataEntrega && c.dataEntrega <= hoje ? c.dataEntrega : hoje }));
      GAH.u.aviso('Licenças da renovação entregues: o contrato agora mostra a nova vigência');
    }));
  };
})();
