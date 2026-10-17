/* Tela Despesas: todos os gastos da empresa num lugar só. Custos fixos (domínio, site, e-mail, portais
   de disputa…), mensalidade do contador e despesas avulsas, mês a mês. Tudo é abatido do lucro líquido. */
(function () {
  const { esc, moeda, dataBR, mesBR, opcoes, janela, lerForm, aviso, botaoExcluir, MESES } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const CATEGORIAS = ['Contabilidade', 'DAS / impostos da empresa', 'Certificado digital', 'Portais de licitação', 'Ferramentas e software', 'Marketing', 'Outros'];
  const estado = { ano: null, mes: null };

  function form(item) {
    const d = item || { data: estado.mes && estado.mes !== calc.mesDe(calc.hoje()) ? estado.mes + '-01' : calc.hoje(), categoria: 'Outros', pago: false };
    const corpo =
      '<form id="form-desp" class="form-grade">' +
      '<div class="campo largo"><label for="dp-desc">Descrição *</label><input id="dp-desc" name="descricao" required value="' + esc(d.descricao) + '" placeholder="Ex.: Certificado digital, inscrição em portal"></div>' +
      '<div class="campo"><label for="dp-cat">Categoria</label><select id="dp-cat" name="categoria">' + opcoes(CATEGORIAS, d.categoria) + '</select></div>' +
      '<div class="campo"><label for="dp-valor">Valor *</label><input id="dp-valor" name="valor" type="number" step="0.01" min="0" required value="' + esc(d.valor) + '"></div>' +
      '<div class="campo"><label for="dp-data">Data / vencimento *</label><input id="dp-data" name="data" type="date" required value="' + esc(d.data) + '"></div>' +
      (d.id ? '' : '<div class="campo"><label for="dp-rep">Repetir por quantos meses</label><input id="dp-rep" type="number" min="1" max="60" value="1" data-ignorar><span class="ajuda">Para gasto que se repete todo mês, prefira "+ Custo fixo".</span></div>') +
      '<label class="parcela-check largo"><input type="checkbox" name="pago"' + (d.pago ? ' checked' : '') + '> Já foi paga</label>' +
      '</form>';
    const rodape = (d.id ? '<button type="button" class="botao perigo" id="excluir-desp">Excluir</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-desp" class="botao">Salvar</button></div>';
    const j = janela({ titulo: d.id ? 'Editar despesa' : 'Nova despesa avulsa', corpo, rodape, estreita: true });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    botaoExcluir(j.el, '#excluir-desp', 'Excluir esta despesa?', async () => {
      await D.excluir('despesas', d.id);
      j.fechar();
      aviso('Despesa excluída');
    });
    j.el.querySelector('#form-desp').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = lerForm(e.target);
      const rep = d.id ? 1 : Math.max(1, Number(j.el.querySelector('#dp-rep').value) || 1);
      for (let i = 0; i < rep; i++) {
        await D.salvar('despesas', Object.assign({}, d, dados, { data: calc.addMeses(dados.data, i), pago: i === 0 ? dados.pago : false }));
      }
      j.fechar();
      aviso(rep > 1 ? rep + ' despesas lançadas' : 'Despesa salva');
    });
  }

  /* Todos os gastos do ano, cada um com o mês a que pertence e de onde veio. */
  function gastosDoAno(ano) {
    const avulsas = D.lista('despesas')
      .filter((d) => (d.data || '').startsWith(String(ano)))
      .map((d) => ({ origem: 'despesas', id: d.id, mes: d.data.slice(0, 7), data: d.data, descricao: d.descricao, categoria: d.categoria || 'Outros', valor: calc.num(d.valor), pago: !!d.pago }));
    const automaticas = calc.custosNoPeriodo(D.lista('custos'), D.lista('contabilidade'), ano + '-12')
      .filter((k) => k.mes.startsWith(String(ano)))
      .map((k) => Object.assign({}, k, { valor: calc.num(k.valor) }));
    return avulsas.concat(automaticas).sort((a, b) => (a.data || '').localeCompare(b.data || '') || a.descricao.localeCompare(b.descricao));
  }

  const NOME_ORIGEM = { custos: 'Custo fixo', contabilidade: 'Contador', despesas: 'Avulsa' };

  GAH.telas.despesas = function (main) {
    const hoje = calc.hoje();
    const mesAtual = calc.mesDe(hoje);
    const anoAtual = Number(hoje.slice(0, 4));
    const anosDados = D.lista('despesas').map((d) => Number((d.data || '').slice(0, 4)))
      .concat(D.lista('custos').map((c) => Number((c.inicio || '').slice(0, 4))))
      .concat(D.lista('contabilidade').map((m) => Number((m.id || '').slice(0, 4))))
      .filter((a) => a > 2000);
    const anos = [...new Set(anosDados.concat(anoAtual, anoAtual + 1))].sort();
    if (!estado.ano) estado.ano = anoAtual;
    if (!estado.mes || !estado.mes.startsWith(String(estado.ano))) estado.mes = estado.ano === anoAtual ? mesAtual : estado.ano + '-01';
    const ano = estado.ano;
    const todos = gastosDoAno(ano);
    const meses = Array.from({ length: 12 }, (_, i) => ano + '-' + String(i + 1).padStart(2, '0'));
    const soma = (lista) => lista.reduce((s, x) => s + x.valor, 0);
    const porMes = meses.map((m) => {
      const l = todos.filter((x) => x.mes === m);
      return { mes: m, fixos: soma(l.filter((x) => x.origem === 'custos')), contador: soma(l.filter((x) => x.origem === 'contabilidade')), avulsas: soma(l.filter((x) => x.origem === 'despesas')), total: soma(l), pago: soma(l.filter((x) => x.pago)), aberto: soma(l.filter((x) => !x.pago)) };
    });
    const totalAno = soma(todos);
    const pagoAno = soma(todos.filter((x) => x.pago));
    const vencido = soma(todos.filter((x) => !x.pago && x.data < hoje));
    const doMes = todos.filter((x) => x.mes === estado.mes);
    const totalMes = soma(doMes);

    // mensalidade do contador ainda não lançada no mês escolhido (só lembrete, não entra nos totais)
    const escritorio = D.obter('contabilidade', 'escritorio') || {};
    const docMes = D.obter('contabilidade', estado.mes);
    const faltaContador = calc.num(escritorio.honorario) > 0 && estado.mes <= mesAtual && !(docMes && docMes.mensalidade && calc.num(docMes.mensalidade.valor));

    const situacao = (x) => x.pago ? '<span class="selo ok">Pago</span>' : x.data < hoje ? '<span class="selo critico">Vencido</span>' : '<span class="selo">Em aberto</span>';
    const chave = (x) => x.origem + '|' + (x.origem === 'despesas' ? x.id : x.origem === 'custos' ? x.custoId + '|' + x.mes : x.mes);

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Despesas</h1><p>Todos os gastos da empresa: custos fixos (domínio, site, e-mail, portais de disputa…), contador e despesas avulsas. Tudo é abatido do lucro líquido.</p></div>' +
      '<div class="acoes"><select class="filtro" id="dp-ano" aria-label="Ano">' + anos.map((a) => '<option' + (a === ano ? ' selected' : '') + '>' + a + '</option>').join('') + '</select>' +
      '<button class="botao secundario" id="novo-fixo">+ Custo fixo</button><button class="botao" id="nova-desp">+ Despesa avulsa</button></div></div>' +

      '<div class="kpis kpis-4">' +
      '<div class="kpi destaque"><span class="kpi-rotulo">Gasto em ' + esc(mesBR(estado.mes)) + '</span><span class="kpi-valor">' + moeda(totalMes) + '</span><span class="kpi-nota">' + doMes.length + ' lançamento(s)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Total em ' + ano + '</span><span class="kpi-valor">' + moeda(totalAno) + '</span><span class="kpi-nota">' + todos.length + ' lançamento(s)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Já pago em ' + ano + '</span><span class="kpi-valor">' + moeda(pagoAno) + '</span><span class="kpi-nota">falta pagar ' + moeda(totalAno - pagoAno) + '</span></div>' +
      '<div class="kpi' + (vencido ? ' alerta' : '') + '"><span class="kpi-rotulo">Vencido sem pagar</span><span class="kpi-valor' + (vencido ? ' negativo' : '') + '">' + moeda(vencido) + '</span></div>' +
      '</div>' +

      '<div class="grade grade-lateral" style="align-items:start">' +
      '<section class="painel"><div class="painel-cab"><div class="navega-mes"><button type="button" class="botao secundario pequeno" id="mes-ant" aria-label="Mês anterior">‹</button><h2>Gastos de ' + esc(mesBR(estado.mes)) + '</h2><button type="button" class="botao secundario pequeno" id="mes-prox" aria-label="Próximo mês">›</button></div>' +
      '<span class="sub">Total do mês: <b>' + moeda(totalMes) + '</b></span></div>' +
      (doMes.length || faltaContador
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Data</th><th>Descrição</th><th>Tipo</th><th class="valor">Valor</th><th>Situação</th><th></th></tr></thead><tbody>' +
          doMes.map((x) => '<tr class="clicavel" data-abrir="' + esc(chave(x)) + '"><td>' + dataBR(x.data) + '</td><td class="nome">' + esc(x.descricao) + '<span class="sub">' + esc(x.categoria || '') + '</span></td><td>' + NOME_ORIGEM[x.origem] + '</td>' +
            '<td class="valor">' + moeda(x.valor) + '</td><td>' + situacao(x) + '</td>' +
            '<td><button type="button" class="link-botao" data-pagar="' + esc(chave(x)) + '">' + (x.pago ? 'Desmarcar' : 'Paguei') + '</button></td></tr>').join('') +
          (faltaContador ? '<tr class="clicavel linha-apagada" data-abrir="contabilidade|' + estado.mes + '"><td>—</td><td class="nome">Mensalidade do contador<span class="sub">ainda não lançada neste mês</span></td><td>Contador</td><td class="valor">' + moeda(escritorio.honorario) + '</td><td><span class="selo alerta">Lançar</span></td><td></td></tr>' : '') +
          '</tbody></table></div>'
        : '<div class="vazio"><strong>Nenhum gasto em ' + esc(mesBR(estado.mes)) + '</strong>Use "+ Despesa avulsa" ou "+ Custo fixo".</div>') +
      '</section>' +

      '<section class="painel"><div class="painel-cab"><h2>Mês a mês · ' + ano + '</h2><span class="sub">Clique no mês para ver os gastos</span></div>' +
      '<div class="tabela-rolagem"><table class="tabela tabela-compacta tabela-meses"><thead><tr><th>Mês</th><th class="valor">Fixos</th><th class="valor">Contador</th><th class="valor">Avulsas</th><th class="valor">Total</th></tr></thead><tbody>' +
      porMes.map((m, i) => '<tr class="clicavel' + (m.mes === estado.mes ? ' selecionado' : '') + '" data-mes="' + m.mes + '"><td>' + MESES[i].charAt(0).toUpperCase() + MESES[i].slice(1, 3) + '</td>' +
        '<td class="valor">' + (m.fixos ? moeda(m.fixos) : '—') + '</td><td class="valor">' + (m.contador ? moeda(m.contador) : '—') + '</td><td class="valor">' + (m.avulsas ? moeda(m.avulsas) : '—') + '</td>' +
        '<td class="valor"><b>' + (m.total ? moeda(m.total) : '—') + '</b>' + (m.aberto && m.mes <= mesAtual ? '<span class="sub negativo">' + moeda(m.aberto) + ' em aberto</span>' : '') + '</td></tr>').join('') +
      '</tbody><tfoot><tr><td>Total</td><td class="valor">' + moeda(soma(porMes.map((m) => ({ valor: m.fixos })))) + '</td><td class="valor">' + moeda(soma(porMes.map((m) => ({ valor: m.contador })))) + '</td><td class="valor">' + moeda(soma(porMes.map((m) => ({ valor: m.avulsas })))) + '</td><td class="valor">' + moeda(totalAno) + '</td></tr></tfoot></table></div>' +
      '</section></div>' +

      GAH.custos.gradeCustos(ano);

    const redesenhar = () => GAH.telas.despesas(main);
    main.querySelector('#nova-desp').addEventListener('click', () => form(null));
    main.querySelector('#novo-fixo').addEventListener('click', () => GAH.custos.formServico(null));
    main.querySelector('#dp-ano').addEventListener('change', (e) => { estado.ano = Number(e.target.value); estado.mes = null; redesenhar(); });
    const mudarMes = (n) => {
      estado.mes = calc.mesDe(calc.addMeses(estado.mes + '-01', n));
      estado.ano = Number(estado.mes.slice(0, 4));
      redesenhar();
    };
    main.querySelector('#mes-ant').addEventListener('click', () => mudarMes(-1));
    main.querySelector('#mes-prox').addEventListener('click', () => mudarMes(1));
    main.querySelectorAll('tr[data-mes]').forEach((tr) => tr.addEventListener('click', () => { estado.mes = tr.dataset.mes; redesenhar(); }));

    const achar = (k) => {
      const [origem, a, b] = k.split('|');
      if (origem === 'despesas') return { origem, despesa: D.obter('despesas', a) };
      if (origem === 'custos') return { origem, custo: D.obter('custos', a), mes: b };
      return { origem, mes: a };
    };
    main.querySelectorAll('[data-abrir]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('[data-pagar]')) return;
      const x = achar(tr.dataset.abrir);
      if (x.origem === 'despesas') form(x.despesa);
      else if (x.origem === 'custos') GAH.custos.formMes(x.custo, x.mes);
      else GAH.contabilidade.formMensalidade(x.mes);
    }));
    main.querySelectorAll('[data-pagar]').forEach((b) => b.addEventListener('click', async () => {
      const x = achar(b.dataset.pagar);
      if (x.origem === 'despesas') {
        await D.salvar('despesas', Object.assign({}, x.despesa, { pago: !x.despesa.pago }));
        aviso(!x.despesa.pago ? 'Marcado como pago' : 'Marcado como em aberto');
      } else if (x.origem === 'custos') {
        await GAH.custos.alternarPago(x.custo, x.mes);
      } else {
        const doc = D.obter('contabilidade', x.mes);
        const ms = Object.assign({}, doc.mensalidade);
        ms.pago = !ms.pago;
        ms.data = ms.pago ? ms.data || calc.hoje() : '';
        await D.salvar('contabilidade', Object.assign({}, doc, { mensalidade: ms }));
        aviso(ms.pago ? 'Mensalidade marcada como paga' : 'Mensalidade marcada como em aberto');
      }
    }));
    GAH.custos.ligarGrade(main);
  };
})();
