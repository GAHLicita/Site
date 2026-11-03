/* Tela Contratos: todos os contratos em uma tabela, com filtros. */
(function () {
  const { esc, moeda, dataBR, mesBR, opcoes, seloVigencia, nomeCliente, ufCliente, nomeForma, janela } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const FILTRO_INICIAL = { busca: '', vigencia: '', entrega: '', forma: '', ano: '', cartao: '', compra: '', meio: '' };
  const filtro = Object.assign({}, FILTRO_INICIAL);
  const MEIOS = [['real', 'Dinheiro em real (Pix, transferência, boleto)'], ['dolar', 'Dinheiro em dólar'], ['cartao', 'Cartão de crédito'], ['sem', 'Forma não informada']];

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

  /* Parcelas lançadas no cartão escolhido no filtro, mês a mês (fatura), com contrato e licença de cada uma. */
  function painelCartao(linhas, cartoes, hoje) {
    if (!filtro.cartao) return '';
    const itens = [];
    linhas.forEach(({ c, orgao, compraCartao }) => {
      const doCartao = compraCartao.filter((p) => p.chave === filtro.cartao).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
      doCartao.forEach((p, i) => itens.push(Object.assign({ c, orgao, n: i + 1, de: doCartao.length }, p)));
    });
    itens.sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || '') || a.orgao.localeCompare(b.orgao));
    const soma = (l) => l.reduce((t, x) => t + x.valor, 0);
    const pago = soma(itens.filter((x) => x.pago));
    const meses = [...new Set(itens.map((x) => calc.mesDe(x.vencimento || '')))];
    const situacao = (x) => x.pago ? '<span class="selo ok">Paga' + (x.dataPagamento ? ' em ' + dataBR(x.dataPagamento) : '') + '</span>' : x.vencimento < hoje ? '<span class="selo critico">Vencida</span>' : '<span class="selo">A pagar</span>';
    return '<section class="painel" id="parcelas-cartao"><div class="painel-cab"><div><h2>Parcelas no ' + esc(GAH.textoCartao(cartoes[filtro.cartao])) + '</h2>' +
      '<span class="sub">' + itens.length + ' parcela(s) dos contratos filtrados · total ' + moeda(soma(itens)) + ' · pago ' + moeda(pago) + ' · <b>a pagar ' + moeda(soma(itens) - pago) + '</b></span></div></div>' +
      (itens.length
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Vencimento</th><th>Órgão</th><th>Licença</th><th>Parcela</th><th class="valor">Valor</th><th>Situação</th></tr></thead><tbody>' +
          meses.map((m) => {
            const doMes = itens.filter((x) => calc.mesDe(x.vencimento || '') === m);
            return '<tr class="linha-grupo"><td colspan="4">Fatura de ' + esc(mesBR(m)) + '</td><td class="valor">' + moeda(soma(doMes)) + '</td><td>' + (doMes.every((x) => x.pago) ? '<span class="selo ok">Paga</span>' : '') + '</td></tr>' +
              doMes.map((x) => '<tr class="clicavel" data-abrir-contrato="' + esc(x.c.id) + '"><td>' + dataBR(x.vencimento) + '</td><td>' + esc(x.orgao) + '</td><td>' + esc(x.licencas.join(' + ')) + '</td><td>' + x.n + '/' + x.de + '</td>' +
                '<td class="valor">' + moeda(x.valor) + '</td><td>' + situacao(x) + '</td></tr>').join('');
          }).join('') + '</tbody></table></div>'
        : '<div class="vazio"><strong>Nenhuma parcela neste cartão</strong>Mude os filtros.</div>') +
      '</section>';
  }

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
    // cartão de cada parcela de compra (para o filtro por cartão)
    todos.forEach((x) => (x.compraCartao = GAH.parcelasDeCompraComCartao(x.c)));
    const cartoes = {};
    todos.forEach((x) => x.compraCartao.forEach((p) => { if (p.chave) cartoes[p.chave] = p.cartao; }));
    const opcoesCartao = Object.entries(cartoes).map(([k, c]) => [k, GAH.textoCartao(c)]).sort((a, b) => a[1].localeCompare(b[1]));
    if (filtro.meio !== 'cartao' || (filtro.cartao && !cartoes[filtro.cartao])) filtro.cartao = '';
    const visao = GAH.visaoFinanceira();
    todos.forEach((x) => (x.entregue = calc.licencasEntregues(x.c, hoje, ren)));
    const naoEntregues = todos.filter((x) => !x.entregue && x.c.status !== 'cancelado').length;
    const linhas = todos
      .filter(({ c, s, orgao, entregue }) => {
        if (visao === 'entregues' && !entregue) return false;
        const t = filtro.busca.toLowerCase();
        if (t && ![orgao, c.produto, c.fornecedor, c.numeroContrato, c.numeroEmpenho].join(' ').toLowerCase().includes(t)) return false;
        if (filtro.vigencia === 'receber' ? s.aReceber <= 0 : filtro.vigencia === 'pagar' ? s.aPagar <= 0 : filtro.vigencia === 'atraso' ? s.parcelasAtrasadas === 0 : filtro.vigencia && s.vigencia !== filtro.vigencia) return false;
        // entrega: contrato novo ou renovação ainda sem as licenças entregues (cancelados ficam de fora)
        if (filtro.entrega === 'pendente' && (entregue || c.status === 'cancelado')) return false;
        if (filtro.entrega === 'entregue' && !entregue) return false;
        if (filtro.forma && (c.venda && c.venda.forma) !== filtro.forma) return false;
        if (filtro.ano && (c.vigenciaInicio || c.dataEntrega || '').slice(0, 4) !== filtro.ano) return false;
        return true;
      })
      .filter((x) => {
        // cartão: o contrato tem parcela de compra nesse cartão; forma da compra: à vista (1 parcela) ou parcelada
        // forma de pagamento da compra (e, no cartão, qual cartão)
        let doCartao = x.compraCartao;
        if (filtro.meio) doCartao = doCartao.filter((p) => (filtro.meio === 'sem' ? !p.meio : p.meio === filtro.meio));
        if (filtro.cartao) doCartao = doCartao.filter((p) => p.chave === filtro.cartao);
        if ((filtro.meio || filtro.cartao) && !doCartao.length) return false;
        if (filtro.compra === 'avista' && doCartao.length !== 1) return false;
        if (filtro.compra === 'parcelado' && doCartao.length < 2) return false;
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
      '<div class="acoes">' +
      '<div class="visao-financeira" role="group" aria-label="Quais contratos mostrar">' +
      '<button type="button" data-visao="total" aria-pressed="' + (visao === 'total') + '">Total</button>' +
      '<button type="button" data-visao="entregues" aria-pressed="' + (visao === 'entregues') + '">Só licenças entregues' + (naoEntregues ? ' (' + naoEntregues + ' fora)' : '') + '</button></div>' +
      '<button class="botao" id="novo-contrato">+ Novo contrato</button></div></div>' +
      '<section class="painel"><div class="painel-cab"><div class="filtros" style="flex:1">' +
      '<input class="filtro busca" id="ct-busca" type="search" placeholder="Buscar órgão, licença, fabricante ou nº" value="' + esc(filtro.busca) + '" aria-label="Buscar">' +
      '<select class="filtro" id="ct-vig" aria-label="Situação">' + opcoes([['vigente', 'Vigentes'], ['vencendo', 'Vencendo em breve'], ['encerrada', 'Encerrados'], ['receber', 'Com valor a receber'], ['atraso', 'Com parcela atrasada'], ['pagar', 'Com compra a pagar'], ['cancelado', 'Cancelados']], filtro.vigencia, 'Todas as situações') + '</select>' +
      '<select class="filtro" id="ct-entrega" aria-label="Entrega das licenças">' + opcoes([['pendente', 'Licenças não entregues'], ['entregue', 'Licenças entregues']], filtro.entrega, 'Toda situação de entrega') + '</select>' +
      '<select class="filtro" id="ct-forma" aria-label="Forma de recebimento">' + opcoes([['integral', 'Integral'], ['mensal', 'Mensal'], ['parcelado', 'Parcelado']], filtro.forma, 'Toda forma de recebimento') + '</select>' +
      '<select class="filtro" id="ct-compra" aria-label="Forma da compra">' + opcoes([['avista', 'Compra à vista'], ['parcelado', 'Compra parcelada']], filtro.compra, 'Toda forma de compra') + '</select>' +
      '<select class="filtro" id="ct-ano" aria-label="Ano de início">' + opcoes(anos, filtro.ano, 'Todos os anos') + '</select>' +
      '<select class="filtro" id="ct-meio" aria-label="Forma de pagamento da compra">' + opcoes(MEIOS, filtro.meio, 'Toda forma de pagamento') + '</select>' +
      (filtro.meio === 'cartao' && opcoesCartao.length ? '<select class="filtro" id="ct-cartao" aria-label="Cartão da compra">' + opcoes(opcoesCartao, filtro.cartao, 'Todos os cartões') + '</select>' : '') +
      '<button type="button" class="botao secundario" id="ct-limpar"' + (visao !== 'total' || Object.keys(FILTRO_INICIAL).some((k) => filtro[k] !== FILTRO_INICIAL[k]) ? '' : ' disabled') + '>Limpar filtros</button>' +
      '</div></div>' +
      (linhas.length
        ? '<div class="tabela-rolagem cabecalho-fixo"><table class="tabela tabela-contratos"><thead><tr><th>Órgão / licença</th><th>Vigência</th><th>Recebimento</th><th class="valor">Venda</th><th class="valor">Recebido</th><th class="valor">A receber</th><th class="valor">A pagar</th><th class="valor">Lucro</th><th>Situação</th></tr></thead><tbody>' +
          linhas.map((x, i) => {
            const { c, s, orgao } = x;
            const titulo = x.grupo && (i === 0 || linhas[i - 1].grupo !== x.grupo) ? '<tr class="linha-grupo"><td colspan="9">' + TITULO_GRUPO[x.grupo] + '</td></tr>' : '';
            const vig = x.anterior
              ? dataBR(x.vigIni) + '<span class="sub">até <b>' + dataBR(x.vigFim) + '</b> (atual)</span><span class="sub renovacao-info">Renovado: ' + dataBR(c.vigenciaInicio) + ' a ' + dataBR(c.vigenciaFim) + '</span>' +
                '<button type="button" class="botao verde botao-entregue" data-entregue="' + esc(c.id) + '">Licenças entregues</button>'
              : dataBR(c.vigenciaInicio) + '<span class="sub">até ' + dataBR(c.vigenciaFim) + '</span>' +
                (!x.entregue && c.status !== 'cancelado' ? '<span class="sub renovacao-info">Aguardando entrega</span><button type="button" class="botao verde botao-entregue" data-entregue="' + esc(c.id) + '">Licenças entregues</button>' : '');
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
      '</section>' +
      painelCartao(linhas, cartoes, hoje);

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
      filtro.entrega = main.querySelector('#ct-entrega').value;
      filtro.forma = main.querySelector('#ct-forma').value;
      filtro.ano = main.querySelector('#ct-ano').value;
      filtro.compra = main.querySelector('#ct-compra').value;
      filtro.meio = main.querySelector('#ct-meio').value;
      filtro.cartao = main.querySelector('#ct-cartao') ? main.querySelector('#ct-cartao').value : '';
      const pos = main.querySelector('#ct-busca').selectionStart;
      GAH.telas.contratos(main);
      const b = main.querySelector('#ct-busca');
      if (document.activeElement === document.body) { b.focus(); b.setSelectionRange(pos, pos); }
    };
    main.querySelector('#ct-busca').addEventListener('input', reler);
    main.querySelector('#ct-limpar').addEventListener('click', () => {
      // volta tudo ao início: filtros vazios e a chave em "Total", para aparecerem todos os contratos
      Object.assign(filtro, FILTRO_INICIAL);
      GAH.visaoFinanceira('total');
      GAH.telas.contratos(main);
    });
    main.querySelectorAll('[data-visao]').forEach((bt) => bt.addEventListener('click', () => { GAH.visaoFinanceira(bt.dataset.visao); GAH.telas.contratos(main); }));
    ['#ct-vig', '#ct-entrega', '#ct-forma', '#ct-ano', '#ct-compra', '#ct-meio', '#ct-cartao'].forEach((s) => { if (main.querySelector(s)) main.querySelector(s).addEventListener('change', reler); });
    main.querySelectorAll('tr[data-abrir-contrato]').forEach((tr) => tr.addEventListener('click', () => abrirContrato(tr.dataset.abrirContrato)));
    main.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => { if (!e.target.closest('[data-entregue]')) abrirContrato(tr.dataset.id); }));
    // Ok de entrega das licenças (renovação: a partir daí passa a mostrar a nova vigência).
    main.querySelectorAll('[data-entregue]').forEach((b) => b.addEventListener('click', () => {
      b.disabled = true;
      GAH.marcarEntregue(b.dataset.entregue);
    }));
  };
})();
