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
    const linhas = todos
      .filter(({ c, s, orgao }) => {
        const t = filtro.busca.toLowerCase();
        if (t && ![orgao, c.produto, c.fornecedor, c.numeroContrato, c.numeroEmpenho].join(' ').toLowerCase().includes(t)) return false;
        if (filtro.vigencia === 'receber' ? s.aReceber <= 0 : filtro.vigencia === 'pagar' ? s.aPagar <= 0 : filtro.vigencia === 'atraso' ? s.parcelasAtrasadas === 0 : filtro.vigencia && s.vigencia !== filtro.vigencia) return false;
        if (filtro.forma && (c.venda && c.venda.forma) !== filtro.forma) return false;
        if (filtro.ano && (c.vigenciaInicio || c.dataEntrega || '').slice(0, 4) !== filtro.ano) return false;
        return true;
      })
      .sort((a, b) => (b.c.vigenciaInicio || b.c.dataEntrega || '').localeCompare(a.c.vigenciaInicio || a.c.dataEntrega || ''));
    const soma = linhas.reduce((t, { s }) => ({ venda: t.venda + s.venda, recebido: t.recebido + s.recebido, aReceber: t.aReceber + s.aReceber, aPagar: t.aPagar + s.aPagar, lucro: t.lucro + s.lucro }), { venda: 0, recebido: 0, aReceber: 0, aPagar: 0, lucro: 0 });

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Contratos</h1><p>Todas as licenças vendidas, com recebimentos, compras e lucro de cada uma.</p></div>' +
      '<div class="acoes"><button class="botao" id="novo-contrato">+ Novo contrato</button></div></div>' +
      '<section class="painel"><div class="painel-cab"><div class="filtros" style="flex:1">' +
      '<input class="filtro busca" id="ct-busca" type="search" placeholder="Buscar órgão, licença, fabricante ou nº" value="' + esc(filtro.busca) + '" aria-label="Buscar">' +
      '<select class="filtro" id="ct-vig" aria-label="Situação">' + opcoes([['vigente', 'Vigentes'], ['vencendo', 'Vencendo em breve'], ['encerrada', 'Encerrados'], ['receber', 'Com valor a receber'], ['atraso', 'Com parcela atrasada'], ['pagar', 'Com compra a pagar'], ['cancelado', 'Cancelados']], filtro.vigencia, 'Todas as situações') + '</select>' +
      '<select class="filtro" id="ct-forma" aria-label="Forma de recebimento">' + opcoes([['integral', 'Integral'], ['mensal', 'Mensal'], ['parcelado', 'Parcelado']], filtro.forma, 'Toda forma de recebimento') + '</select>' +
      '<select class="filtro" id="ct-ano" aria-label="Ano de início">' + opcoes(anos, filtro.ano, 'Todos os anos') + '</select>' +
      '</div></div>' +
      (linhas.length
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Órgão / licença</th><th>Vigência</th><th>Recebimento</th><th class="valor">Venda</th><th class="valor">Recebido</th><th class="valor">A receber</th><th class="valor">A pagar</th><th class="valor">Lucro</th><th>Situação</th></tr></thead><tbody>' +
          linhas.map(({ c, s, orgao }) =>
            '<tr class="clicavel" data-id="' + esc(c.id) + '"><td><span class="nome">' + esc(orgao) + (ufCliente(c.clienteId) ? ' <span class="texto-suave">· ' + esc(ufCliente(c.clienteId)) + '</span>' : '') + '</span><span class="sub">' + esc([c.produto, c.fornecedor].filter(Boolean).join(' · ')) + '</span></td>' +
            '<td>' + dataBR(c.vigenciaInicio) + '<span class="sub">até ' + dataBR(c.vigenciaFim) + '</span></td>' +
            '<td>' + nomeForma(c.venda && c.venda.forma) + '<span class="sub">' + s.parcelasRecebidas + '/' + s.totalParcelasVenda + ' recebida(s)</span></td>' +
            '<td class="valor">' + moeda(s.venda) + '</td><td class="valor">' + moeda(s.recebido) + '</td>' +
            '<td class="valor">' + moeda(s.aReceber) + (s.parcelasAtrasadas ? '<span class="sub negativo">' + s.parcelasAtrasadas + ' atrasada(s)</span>' : '') + '</td>' +
            '<td class="valor">' + moeda(s.aPagar) + (s.parcelasPagar ? '<span class="sub">' + s.parcelasPagar + ' parcela(s)</span>' : '') + '</td>' +
            '<td class="valor ' + (s.lucro < 0 ? 'negativo' : '') + '">' + moeda(s.lucro) + '</td>' +
            '<td>' + seloVigencia(s) + '</td></tr>'
          ).join('') +
          '</tbody><tfoot><tr><td colspan="3">' + linhas.length + ' contrato(s)</td><td class="valor">' + moeda(soma.venda) + '</td><td class="valor">' + moeda(soma.recebido) + '</td><td class="valor">' + moeda(soma.aReceber) + '</td><td class="valor">' + moeda(soma.aPagar) + '</td><td class="valor">' + moeda(soma.lucro) + '</td><td></td></tr></tfoot></table></div>'
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
    ['#ct-vig', '#ct-forma', '#ct-ano'].forEach((s) => main.querySelector(s).addEventListener('change', reler));
    main.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', () => abrirContrato(tr.dataset.id)));
  };
})();
