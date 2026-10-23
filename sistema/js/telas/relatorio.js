/* Tela Relatório: relatório da empresa de um mês ou de um ano, para imprimir ou salvar em PDF.
   Contratos firmados ou renovados, recebimentos dos órgãos, pagamentos aos fornecedores e despesas e custos. */
(function () {
  const { esc, moeda, dataBR, mesBR, nomeCliente, opcoes, MESES } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;

  const estado = { tipo: 'mes', mes: '', ano: '' };
  const maiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

  function periodo() {
    if (estado.tipo === 'ano') return { de: estado.ano + '-01', ate: estado.ano + '-12', nome: 'ano de ' + estado.ano };
    return { de: estado.mes, ate: estado.mes, nome: mesBR(estado.mes) };
  }

  function dadosDoRelatorio() {
    const hoje = calc.hoje();
    const { de, ate } = periodo();
    // gastos: só os que já ocorreram (até o mês atual), pelo mês a que se referem
    const mesAtual = calc.mesDe(hoje);
    const ateGastos = ate < mesAtual ? ate : mesAtual;
    const gastos = GAH.despesasLancadas().filter((d) => calc.mesDe(d.data) <= ateGastos)
      .concat(calc.custosNoPeriodo(D.lista('custos'), D.lista('contabilidade'), ateGastos));
    const r = calc.relatorio(D.lista('contratos'), gastos, de, ate, hoje);
    r.gastosAte = ateGastos < ate ? ateGastos : '';
    return r;
  }

  const contrato = (id) => D.obter('contratos', id) || {};
  const licenca = (c) => [c.produto, c.fornecedor].filter(Boolean).join(' · ');
  const seloEntrega = (entregue) => entregue ? '<span class="selo ok">Entregue</span>' : '<span class="selo alerta">Pendente</span>';

  function tabela(cab, linhas, total, vazio) {
    if (!linhas.length) return '<div class="vazio relatorio-vazio">' + vazio + '</div>';
    return '<div class="tabela-rolagem"><table class="tabela tabela-relatorio"><thead><tr>' +
      cab.map((h) => '<th' + (h.valor ? ' class="valor"' : '') + '>' + h.t + '</th>').join('') + '</tr></thead><tbody>' +
      linhas.join('') + '</tbody>' + (total ? '<tfoot>' + total + '</tfoot>' : '') + '</table></div>';
  }
  const secao = (titulo, sub, corpo) =>
    '<section class="painel secao-relatorio"><div class="painel-cab"><div><h2>' + titulo + '</h2>' + (sub ? '<span class="sub">' + sub + '</span>' : '') + '</div></div>' + corpo + '</section>';

  function corpoRelatorio(r) {
    const t = r.totais;
    const p = periodo();
    const varios = r.meses.length > 1;

    const kpis = '<div class="kpis kpis-relatorio">' +
      '<div class="kpi"><span class="kpi-rotulo">Contratos firmados</span><span class="kpi-valor">' + moeda(t.valorContratos) + '</span><span class="kpi-nota">' + t.novos + ' novo(s) · ' + t.renovacoes + ' renovação(ões)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Recebido dos órgãos</span><span class="kpi-valor">' + moeda(t.recebido) + '</span><span class="kpi-nota">' + r.recebimentos.length + ' pagamento(s)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Pago aos fornecedores</span><span class="kpi-valor">' + moeda(t.pago) + '</span><span class="kpi-nota">compra das licenças</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Despesas e custos</span><span class="kpi-valor">' + moeda(t.gastos) + '</span><span class="kpi-nota">' + (t.gastosEmAberto ? moeda(t.gastosEmAberto) + ' ainda não pago' : 'tudo pago') + '</span></div>' +
      '<div class="kpi destaque"><span class="kpi-rotulo">Saldo do período</span><span class="kpi-valor">' + moeda(t.saldo) + '</span><span class="kpi-nota">recebido − pago − despesas</span></div>' +
      '</div>';

    const mesAMes = !varios ? '' : secao('Mês a mês', '', tabela(
      [{ t: 'Mês' }, { t: 'Contratos' }, { t: 'Valor dos contratos', valor: 1 }, { t: 'Recebido', valor: 1 }, { t: 'Pago fornecedores', valor: 1 }, { t: 'Despesas e custos', valor: 1 }, { t: 'Saldo', valor: 1 }],
      r.meses.map((m) => '<tr><td>' + maiuscula(MESES[Number(m.mes.slice(5, 7)) - 1]) + '</td><td>' + (m.novos + m.renovacoes || '—') + '</td><td class="valor">' + moeda(m.valorContratos) +
        '</td><td class="valor">' + moeda(m.recebido) + '</td><td class="valor">' + moeda(m.pago) + '</td><td class="valor">' + moeda(m.gastos) +
        '</td><td class="valor ' + (m.saldo >= 0 ? '' : 'negativo') + '">' + moeda(m.saldo) + '</td></tr>'),
      '<tr><td>Total</td><td>' + (t.novos + t.renovacoes) + '</td><td class="valor">' + moeda(t.valorContratos) + '</td><td class="valor">' + moeda(t.recebido) + '</td><td class="valor">' + moeda(t.pago) +
        '</td><td class="valor">' + moeda(t.gastos) + '</td><td class="valor">' + moeda(t.saldo) + '</td></tr>', ''));

    const contratos = secao('Contratos firmados ou renovados', 'Pelo início da vigência', tabela(
      [{ t: 'Início' }, { t: 'Órgão' }, { t: 'Licença' }, { t: 'Tipo' }, { t: 'Entrega' }, { t: 'Venda', valor: 1 }, { t: 'Compra', valor: 1 }, { t: 'Impostos', valor: 1 }, { t: 'Lucro', valor: 1 }],
      r.contratos.map((x) => {
        const c = contrato(x.contratoId);
        return '<tr><td>' + dataBR(x.data) + '</td><td>' + esc(nomeCliente(c.clienteId)) + '</td><td>' + esc(licenca(c)) + (c.quantidade ? ' <span class="texto-suave">(' + esc(c.quantidade) + ')</span>' : '') +
          '</td><td>' + (x.renovacao ? 'Renovação' : 'Novo') + '</td><td>' + seloEntrega(x.entregue) + '</td><td class="valor">' + moeda(x.venda) + '</td><td class="valor">' + moeda(x.compra) +
          '</td><td class="valor">' + moeda(x.impostos) + '</td><td class="valor">' + moeda(x.lucro) + '</td></tr>';
      }),
      '<tr><td colspan="5">Total</td><td class="valor">' + moeda(t.valorContratos) + '</td><td class="valor">' + moeda(r.contratos.reduce((s, x) => s + x.compra, 0)) +
        '</td><td class="valor">' + moeda(r.contratos.reduce((s, x) => s + x.impostos, 0)) + '</td><td class="valor">' + moeda(t.lucroContratos) + '</td></tr>',
      'Nenhum contrato firmado ou renovado no período.'));

    const recebimentos = secao('Recebimentos dos órgãos', 'Parcelas pagas pelos órgãos, pela data do pagamento', tabela(
      [{ t: 'Data' }, { t: 'Órgão' }, { t: 'Licença' }, { t: 'Parcela' }, { t: 'NF' }, { t: 'Valor', valor: 1 }],
      r.recebimentos.map((x) => {
        const c = contrato(x.contratoId);
        return '<tr><td>' + dataBR(x.data) + '</td><td>' + esc(nomeCliente(c.clienteId)) + '</td><td>' + esc(licenca(c)) + '</td><td>' + x.parcela + '</td><td>' + esc(x.nf || '—') + '</td><td class="valor">' + moeda(x.valor) + '</td></tr>';
      }),
      '<tr><td colspan="5">Total</td><td class="valor">' + moeda(t.recebido) + '</td></tr>',
      'Nenhum recebimento no período.'));

    const pagamentos = secao('Pagamentos das licenças', 'Parcelas pagas aos fornecedores, pela data do pagamento', tabela(
      [{ t: 'Data' }, { t: 'Fabricante / licença' }, { t: 'Órgão' }, { t: 'Parcela' }, { t: 'Pago com' }, { t: 'Entrega' }, { t: 'Valor', valor: 1 }],
      r.pagamentos.map((x) => {
        const c = contrato(x.contratoId);
        return '<tr><td>' + dataBR(x.data) + '</td><td>' + esc(licenca(c)) + '</td><td>' + esc(nomeCliente(c.clienteId)) + '</td><td>' + x.parcela + '</td><td>' + esc(GAH.textoMeioCompra(c.compra) || '—') +
          '</td><td>' + seloEntrega(x.entregue) + '</td><td class="valor">' + moeda(x.valor) + '</td></tr>';
      }),
      '<tr><td colspan="6">Total</td><td class="valor">' + moeda(t.pago) + '</td></tr>',
      'Nenhum pagamento a fornecedor no período.'));

    const gastos = secao('Despesas e custos', 'Custos fixos, contador e despesas avulsas do mês a que se referem' + (r.gastosAte ? ', até ' + mesBR(r.gastosAte) : ''), tabela(
      [{ t: 'Vencimento' }, { t: 'Descrição' }, { t: 'Categoria' }, { t: 'Situação' }, { t: 'Valor', valor: 1 }],
      r.gastos.map((x) => '<tr><td>' + dataBR(x.data) + '</td><td>' + esc(x.descricao) + '</td><td>' + esc(x.categoria) + '</td><td>' +
        (x.pago ? '<span class="selo ok">Pago' + (x.dataPagamento ? ' em ' + dataBR(x.dataPagamento) : '') + '</span>' : '<span class="selo alerta">Em aberto</span>') +
        '</td><td class="valor">' + moeda(x.valor) + '</td></tr>'),
      '<tr><td colspan="4">Total</td><td class="valor">' + moeda(t.gastos) + '</td></tr>',
      'Nenhuma despesa ou custo no período.'));

    return '<div class="relatorio-titulo"><h2>Relatório GAH Licita — ' + esc(maiuscula(p.nome)) + '</h2><span class="sub">Emitido em ' + dataBR(calc.hoje()) + '</span></div>' +
      kpis + mesAMes + contratos + recebimentos + pagamentos + gastos;
  }

  /* Planilha (.csv) com as mesmas listas, separadas por seção. */
  function csv(r) {
    const linhas = [];
    const sec = (titulo, cab, itens) => { linhas.push([titulo], cab, ...itens, []); };
    const n = (v) => String(v).replace('.', ',');
    sec('Contratos firmados ou renovados', ['Início', 'Órgão', 'Licença', 'Fabricante', 'Tipo', 'Entrega', 'Venda', 'Compra', 'Impostos', 'Lucro'],
      r.contratos.map((x) => { const c = contrato(x.contratoId); return [dataBR(x.data), nomeCliente(c.clienteId), c.produto, c.fornecedor, x.renovacao ? 'Renovação' : 'Novo', x.entregue ? 'Entregue' : 'Pendente', n(x.venda), n(x.compra), n(x.impostos), n(x.lucro)]; }));
    sec('Recebimentos dos órgãos', ['Data', 'Órgão', 'Licença', 'Parcela', 'NF', 'Valor'],
      r.recebimentos.map((x) => { const c = contrato(x.contratoId); return [dataBR(x.data), nomeCliente(c.clienteId), c.produto, x.parcela, x.nf, n(x.valor)]; }));
    sec('Pagamentos das licenças', ['Data', 'Fabricante', 'Licença', 'Órgão', 'Parcela', 'Entrega', 'Valor'],
      r.pagamentos.map((x) => { const c = contrato(x.contratoId); return [dataBR(x.data), c.fornecedor, c.produto, nomeCliente(c.clienteId), x.parcela, x.entregue ? 'Entregue' : 'Pendente', n(x.valor)]; }));
    sec('Despesas e custos', ['Vencimento', 'Descrição', 'Categoria', 'Pago', 'Data do pagamento', 'Valor'],
      r.gastos.map((x) => [dataBR(x.data), x.descricao, x.categoria, x.pago ? 'Sim' : 'Não', x.dataPagamento ? dataBR(x.dataPagamento) : '', n(x.valor)]));
    const t = r.totais;
    sec('Resumo', ['Contratos novos', 'Renovações', 'Valor dos contratos', 'Recebido', 'Pago fornecedores', 'Despesas e custos', 'Saldo'],
      [[t.novos, t.renovacoes, n(t.valorContratos), n(t.recebido), n(t.pago), n(t.gastos), n(t.saldo)]]);
    return '﻿' + linhas.map((l) => l.map((v) => {
      const s = String(v === undefined || v === null ? '' : v);
      return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    }).join(';')).join('\n');
  }

  function baixar(nome, conteudo) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  GAH.telas.relatorio = function (main) {
    const hoje = calc.hoje();
    if (!estado.mes) estado.mes = calc.mesDe(hoje);
    if (!estado.ano) estado.ano = hoje.slice(0, 4);
    const anos = [...new Set(D.lista('contratos').map((c) => (c.vigenciaInicio || '').slice(0, 4)).concat(hoje.slice(0, 4)).filter(Boolean))].sort().reverse();
    const r = dadosDoRelatorio();

    main.innerHTML =
      '<div class="cabecalho-tela nao-imprimir"><div><h1>Relatório</h1><p>Relatório da empresa de um mês ou de um ano: contratos firmados ou renovados, recebimentos, pagamentos das licenças, despesas e custos.</p></div>' +
      '<div class="acoes"><button type="button" class="botao secundario" id="rel-csv">Baixar planilha (.csv)</button><button type="button" class="botao" id="rel-imprimir">Imprimir ou salvar em PDF</button></div></div>' +
      '<div class="filtros nao-imprimir controles-relatorio">' +
      '<select class="filtro" id="rel-tipo" aria-label="Tipo de relatório">' + opcoes([['mes', 'Relatório do mês'], ['ano', 'Relatório do ano']], estado.tipo) + '</select>' +
      (estado.tipo === 'ano'
        ? '<select class="filtro" id="rel-ano" aria-label="Ano">' + opcoes(anos.map((a) => [a, a]), estado.ano) + '</select>'
        : '<input class="filtro" id="rel-mes" type="month" value="' + esc(estado.mes) + '" aria-label="Mês">') +
      '</div>' +
      '<div class="relatorio">' + corpoRelatorio(r) + '</div>';

    main.querySelector('#rel-tipo').addEventListener('change', (e) => { estado.tipo = e.target.value; GAH.telas.relatorio(main); });
    const ano = main.querySelector('#rel-ano');
    if (ano) ano.addEventListener('change', (e) => { estado.ano = e.target.value; GAH.telas.relatorio(main); });
    const mes = main.querySelector('#rel-mes');
    if (mes) mes.addEventListener('change', (e) => { if (e.target.value) { estado.mes = e.target.value; GAH.telas.relatorio(main); } });
    main.querySelector('#rel-imprimir').addEventListener('click', () => window.print());
    main.querySelector('#rel-csv').addEventListener('click', () => {
      baixar('relatorio-gah-' + (estado.tipo === 'ano' ? estado.ano : estado.mes) + '.csv', csv(r));
      GAH.u.aviso('Planilha baixada');
    });
  };
})();
