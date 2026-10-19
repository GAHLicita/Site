/* Tela Financeiro: visão geral da empresa, mapa de atuação e faturamento mês a mês. */
(function () {
  const { esc, moeda, moedaCurta, mesBR, pct, MESES, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  let anoEscolhido = null;

  function mapa(estadosAtivos, contagem) {
    const m = GAH.mapaBrasil;
    const ufs = Object.keys(m.estados);
    return (
      '<svg class="mapa-brasil" viewBox="' + m.viewBox + '" role="img" aria-label="Mapa do Brasil com os estados atendidos destacados">' +
      ufs.map((uf) => {
        const ativo = estadosAtivos.includes(uf);
        const n = contagem[uf] || 0;
        return '<path class="uf' + (ativo ? ' ativo' : '') + '" d="' + m.estados[uf].d + '"><title>' + uf + (ativo ? ' — ' + n + ' órgão(s)' : ' — sem contratos') + '</title></path>';
      }).join('') +
      ufs.map((uf) => '<text class="rotulo-uf' + (estadosAtivos.includes(uf) ? ' ativo' : '') + '" x="' + m.estados[uf].x + '" y="' + m.estados[uf].y + '" text-anchor="middle">' + uf + '</text>').join('') +
      '</svg>'
    );
  }

  /* Escala "bonita" para o eixo: 0, passo, 2×passo… */
  function escala(min, max) {
    const amplitude = Math.max(max - min, 1);
    const bruto = amplitude / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(bruto)));
    const passo = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((p) => p >= bruto);
    const ini = Math.floor(min / passo) * passo;
    const fim = Math.ceil(max / passo) * passo;
    const ticks = [];
    for (let v = ini; v <= fim + passo / 2; v += passo) ticks.push(Math.round(v * 100) / 100);
    return { ini, fim, ticks };
  }

  function grafico(meses, L, A) {
    L = L || 1000;
    A = A || 290;
    const esq = 64, dir = 12, topo = 12, base = 30;
    const maxV = Math.max(0, ...meses.map((m) => Math.max(m.venda, m.lucro)));
    const minV = Math.min(0, ...meses.map((m) => m.lucro));
    const e = escala(minV, maxV || 1000);
    const y = (v) => topo + (A - topo - base) * (1 - (v - e.ini) / (e.fim - e.ini));
    const larguraMes = (L - esq - dir) / 12;
    const barra = Math.min(18, larguraMes * 0.32);
    let svg = '<svg viewBox="0 0 ' + L + ' ' + A + '" role="img" aria-label="Venda e lucro por mês">';
    e.ticks.forEach((t) => {
      svg += '<line class="' + (t === 0 ? 'base' : 'grade-linha') + '" x1="' + esq + '" x2="' + (L - dir) + '" y1="' + y(t) + '" y2="' + y(t) + '"/>';
      svg += '<text class="eixo-texto" x="' + (esq - 8) + '" y="' + (y(t) + 4) + '" text-anchor="end">' + esc(moedaCurta(t).replace('R$ ', '')) + '</text>';
    });
    meses.forEach((m, i) => {
      const cx = esq + larguraMes * i + larguraMes / 2;
      const y0 = y(0);
      const barraPath = (x, v, cls) => {
        if (!v) return '';
        const yv = y(v);
        const topoY = Math.min(yv, y0), alt = Math.abs(y0 - yv);
        const r = Math.min(4, alt, barra / 2);
        // canto arredondado só na ponta da barra
        if (v >= 0) return '<path class="' + cls + '" d="M' + x + ',' + y0 + 'V' + (topoY + r) + 'Q' + x + ',' + topoY + ' ' + (x + r) + ',' + topoY + 'H' + (x + barra - r) + 'Q' + (x + barra) + ',' + topoY + ' ' + (x + barra) + ',' + (topoY + r) + 'V' + y0 + 'Z"/>';
        const fundo = topoY + alt;
        return '<path class="' + cls + '" d="M' + x + ',' + y0 + 'V' + (fundo - r) + 'Q' + x + ',' + fundo + ' ' + (x + r) + ',' + fundo + 'H' + (x + barra - r) + 'Q' + (x + barra) + ',' + fundo + ' ' + (x + barra) + ',' + (fundo - r) + 'V' + y0 + 'Z"/>';
      };
      svg += barraPath(cx - barra - 1, m.venda, 'barra-venda');
      svg += barraPath(cx + 1, m.lucro, 'barra-lucro');
      svg += '<text class="eixo-texto" x="' + cx + '" y="' + (A - 10) + '" text-anchor="middle">' + MESES_CURTOS[i] + '</text>';
      svg += '<rect class="alvo" data-mes="' + i + '" x="' + (esq + larguraMes * i) + '" y="' + topo + '" width="' + larguraMes + '" height="' + (A - topo - base) + '"/>';
    });
    return svg + '</svg>';
  }

  /* Com as seções do tamanho da tela, o gráfico é redesenhado com o tamanho exato do espaço que sobrou. */
  let graficoAtual = null;
  function ajustarGrafico() {
    if (!graficoAtual || !graficoAtual.caixa.isConnected) return;
    const { caixa, meses } = graficoAtual;
    const svg = caixa.querySelector('svg');
    if (!document.documentElement.classList.contains('snap-inicio') || getComputedStyle(caixa).flexGrow === '0') {
      if (svg.getAttribute('viewBox') !== '0 0 1000 290') svg.outerHTML = grafico(meses);
      return;
    }
    const l = Math.round(caixa.clientWidth), a = Math.round(caixa.clientHeight);
    if (l > 300 && a > 150) svg.outerHTML = grafico(meses, l, a);
  }
  let esperaRedimensionar = null;
  window.addEventListener('resize', () => { clearTimeout(esperaRedimensionar); esperaRedimensionar = setTimeout(ajustarGrafico, 150); });

  /* Painel financeiro. É a tela Início: op.cabecalho troca o título, op.rodape entra no fim
     e op.redesenhar é chamado quando o ano do gráfico muda. */
  GAH.renderFinanceiro = function (main, op) {
    op = op || {};
    const hoje = calc.hoje();
    const contratos = D.lista('contratos');
    const mesAtual = calc.mesDe(hoje);
    const despesas = GAH.despesasCompletas(mesAtual);
    const clientes = D.lista('clientes');
    const g = calc.resumoGeral(contratos, despesas, clientes, hoje);
    // quadros: todos os contratos ou só os que já tiveram as licenças entregues (situação atual)
    const visao = GAH.visaoFinanceira();
    const contratosVisao = GAH.contratosDaVisao(contratos, visao, hoje);
    const v = visao === 'entregues' ? calc.resumoGeral(contratosVisao, despesas, clientes, hoje) : g;
    const foraDaVisao = contratos.length - contratosVisao.length;

    const anos = new Set([Number(hoje.slice(0, 4))]);
    contratos.forEach((c) => ['venda', 'compra'].forEach((l) => ((c[l] && c[l].parcelas) || []).forEach((p) => {
      const d = p.emissao || p.vencimento;
      if (d) anos.add(Number(d.slice(0, 4)));
    })));
    const listaAnos = [...anos].sort();
    if (!anoEscolhido || !anos.has(anoEscolhido)) anoEscolhido = Number(hoje.slice(0, 4));
    const meses = calc.faturamentoMensal(contratos, GAH.despesasCompletas(anoEscolhido + '-12'), anoEscolhido);
    const tot = meses.reduce((t, m) => ({ venda: t.venda + m.venda, compra: t.compra + m.compra, impostos: t.impostos + m.impostos, despesas: t.despesas + m.despesas, lucro: t.lucro + m.lucro }), { venda: 0, compra: 0, impostos: 0, despesas: 0, lucro: 0 });
    const previsao = calc.previsaoCaixa(contratos, GAH.despesasCompletas(calc.mesDe(calc.addMeses(mesAtual + '-01', 11))), hoje, 12);

    const porUF = {};
    const comContrato = new Set(contratos.filter((c) => c.status !== 'cancelado').map((c) => c.clienteId));
    clientes.filter((c) => comContrato.has(c.id) && c.uf).forEach((c) => (porUF[c.uf] = (porUF[c.uf] || 0) + 1));

    const fabricantes = calc.vendasPorFabricante(contratos, hoje);

    const kpi = (rotulo, valor, nota, cls) => '<div class="kpi ' + (cls || '') + '"><span class="kpi-rotulo">' + rotulo + '</span><span class="kpi-valor">' + valor + '</span>' + (nota ? '<span class="kpi-nota">' + nota + '</span>' : '') + '</div>';

    // Cada parte é uma seção do tamanho da tela; ao rolar, a página pula de uma seção para a outra.
    main.innerHTML =
      (op.cabecalho || '') +
      '<section class="secao-inicio secao-resumo">' +
      '<div class="coluna-kpis">' +
      '<div class="visao-financeira" role="group" aria-label="Quais contratos entram nos quadros">' +
      '<button type="button" data-visao="total" aria-pressed="' + (visao === 'total') + '">Total (inclui renovações não entregues)</button>' +
      '<button type="button" data-visao="entregues" aria-pressed="' + (visao === 'entregues') + '">Só licenças entregues</button></div>' +
      '<div class="kpis kpis-2 kpis-compactos">' +
      kpi('Valor total em contratos', moeda(v.totalContratos), contratosVisao.length + ' contratos' + (foraDaVisao ? ' · ' + foraDaVisao + ' fora (não entregues)' : ''), 'destaque kpi-centro') +
      kpi('Recebido', moeda(v.recebido), v.totalContratos ? pct(v.recebido / v.totalContratos) + ' do total' : '') +
      kpi('A receber', moeda(v.aReceber), v.valorAtrasado ? '<span class="negativo">' + moeda(v.valorAtrasado) + ' em atraso</span>' : 'nada em atraso') +
      kpi('A pagar (compras parceladas)', moeda(v.aPagar), 'de ' + moeda(v.totalCompras) + ' em compras') +
      kpi('Impostos', moeda(v.impostos), 'NF e compras') +
      kpi('Despesas e custos', moeda(v.despesas), 'contador, custos fixos e outras, até este mês') +
      kpi('Lucro líquido', '<span class="' + (v.lucroLiquido >= 0 ? '' : 'negativo') + '">' + moeda(v.lucroLiquido) + '</span>', (v.totalContratos ? pct(v.lucroLiquido / v.totalContratos) + ' do valor total em contratos · ' : '') + 'lucro dos contratos − despesas e custos') +
      '</div></div>' +

      '<section class="painel painel-mapa"><div class="painel-cab"><h2>Onde estamos presentes</h2><span class="sub">Estados com órgãos atendidos</span></div><div class="painel-corpo"><div class="mapa-area"><div class="mapa-coluna">' +
      '<div class="mapa-caixa">' + mapa(g.estados, porUF) + '</div>' +
      '<div class="legenda-mapa"><i></i> Estados com contrato</div><p class="credito">Mapa: <a href="https://github.com/VictorCazanave/svg-maps" target="_blank" rel="noopener">svg-maps</a> (CC BY 4.0)</p></div>' +
      '<div class="mapa-numeros">' +
      '<div class="mapa-numero"><b>' + g.orgaosAtendidos + '</b><span>órgãos públicos atendidos</span></div>' +
      '<div class="mapa-numero"><b>' + g.estados.length + '</b><span>estados atendidos</span></div>' +
      '</div></div></div></section>' +
      '</section>' +

      '<section class="secao-inicio"><section class="painel"><div class="painel-cab"><div><h2>Valores mês a mês</h2><span class="sub">Venda pelo mês da nota fiscal, compra pelo mês do pagamento; despesas, custos fixos e contador abatidos no mês</span></div>' +
      '<select class="filtro" id="fin-ano" aria-label="Ano">' + listaAnos.map((a) => '<option' + (a === anoEscolhido ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div>' +
      '<div class="tabela-rolagem"><table class="tabela tabela-compacta"><thead><tr><th>' + anoEscolhido + '</th><th class="valor">Preço de venda</th><th class="valor">Preço de compra</th><th class="valor">Impostos</th><th class="valor">Despesas e custos</th><th class="valor">Lucro líquido</th></tr></thead><tbody>' +
      meses.map((m, i) => '<tr><td>' + MESES[i].charAt(0).toUpperCase() + MESES[i].slice(1) + '</td><td class="valor">' + moeda(m.venda) + '</td><td class="valor">' + moeda(m.compra) + '</td><td class="valor">' + moeda(m.impostos) + '</td><td class="valor">' + moeda(m.despesas) + '</td><td class="valor ' + (m.lucro < 0 ? 'negativo' : '') + '">' + moeda(m.lucro) + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total</td><td class="valor">' + moeda(tot.venda) + '</td><td class="valor">' + moeda(tot.compra) + '</td><td class="valor">' + moeda(tot.impostos) + '</td><td class="valor">' + moeda(tot.despesas) + '</td><td class="valor">' + moeda(tot.lucro) + '</td></tr></tfoot></table></div></section></section>' +

      '<section class="secao-inicio secao-grafico"><section class="painel"><div class="painel-cab"><div><h2>Faturamento mês a mês · ' + anoEscolhido + '</h2><span class="sub">Os mesmos números da tabela, em barras</span></div>' +
      '</div>' +
      '<div class="painel-corpo"><div class="legenda"><span><i style="background:var(--serie-1)"></i>Preço de venda</span><span><i style="background:var(--serie-2)"></i>Lucro líquido</span></div>' +
      '<div class="grafico" id="fin-grafico">' + grafico(meses) + '<div class="dica" id="fin-dica" hidden></div></div></div></section></section>' +

      '<section class="secao-inicio"><div class="grade grade-2">' +
      '<section class="painel"><div class="painel-cab"><h2>Previsão de caixa</h2><span class="sub">Parcelas em aberto nos próximos 12 meses (atrasadas contam no mês atual)</span></div>' +
      '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Mês</th><th class="valor">Entra</th><th class="valor">Sai</th><th class="valor">Saldo</th></tr></thead><tbody>' +
      previsao.map((p) => '<tr><td>' + esc(mesBR(p.mes)) + '</td><td class="valor">' + moeda(p.entra) + '</td><td class="valor">' + moeda(p.sai) + '</td><td class="valor ' + (p.saldo < 0 ? 'negativo' : 'positivo') + '">' + moeda(p.saldo) + '</td></tr>').join('') +
      '</tbody></table></div></section>' +
      '<section class="painel"><div class="painel-cab"><h2>Vendas por fabricante</h2><span class="sub">Contratos com várias licenças entram em cada fabricante</span></div>' +
      (fabricantes.length
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Fabricante</th><th class="valor">Contratos</th><th class="valor">Venda</th><th class="valor">Lucro</th></tr></thead><tbody>' +
          fabricantes.map((v) => '<tr><td class="nome">' + esc(v.fabricante) + '</td><td class="valor">' + v.n + '</td><td class="valor">' + moeda(v.venda) + '</td><td class="valor">' + moeda(v.lucro) + '</td></tr>').join('') +
          '</tbody></table></div>'
        : '<div class="vazio"><strong>Sem contratos ainda</strong>Cadastre um contrato para ver as vendas por fabricante.</div>') +
      '</section></div></section>' +
      (op.rodape ? '<section class="secao-inicio">' + op.rodape + '</section>' : '');

    main.querySelectorAll('[data-visao]').forEach((bt) => bt.addEventListener('click', () => {
      GAH.visaoFinanceira(bt.dataset.visao);
      (op.redesenhar || (() => GAH.telas.inicio(main)))();
    }));
    main.querySelector('#fin-ano').addEventListener('change', (e) => {
      anoEscolhido = Number(e.target.value);
      (op.redesenhar || (() => GAH.telas.inicio(main)))();
    });

    const caixa = main.querySelector('#fin-grafico');
    const dica = main.querySelector('#fin-dica');
    graficoAtual = { caixa, meses };
    ajustarGrafico();
    caixa.addEventListener('mousemove', (e) => {
      const alvo = e.target.closest('[data-mes]');
      if (!alvo) { dica.hidden = true; return; }
      const m = meses[Number(alvo.dataset.mes)];
      dica.innerHTML = '<b>' + esc(mesBR(m.mes)) + '</b>' +
        '<div><span>Venda</span><span>' + moeda(m.venda) + '</span></div><div><span>Compra</span><span>' + moeda(m.compra) + '</span></div>' +
        '<div><span>Impostos</span><span>' + moeda(m.impostos) + '</span></div><div><span>Despesas e custos</span><span>' + moeda(m.despesas) + '</span></div>' +
        '<div><span>Lucro</span><span>' + moeda(m.lucro) + '</span></div>';
      dica.hidden = false;
      const r = caixa.getBoundingClientRect();
      let x = e.clientX - r.left + 14;
      if (x + 190 > r.width) x = e.clientX - r.left - 200;
      dica.style.left = Math.max(0, x) + 'px';
      dica.style.top = Math.max(0, e.clientY - r.top - 40) + 'px';
    });
    caixa.addEventListener('mouseleave', () => (dica.hidden = true));
  };
})();

/* O endereço antigo #/financeiro continua funcionando: abre o Início. */
GAH.telas.financeiro = function (main) { GAH.telas.inicio(main); };
