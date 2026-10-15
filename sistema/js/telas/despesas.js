/* Tela Despesas: custos fixos da empresa (contador, DAS, ferramentas…), que entram no lucro líquido. */
(function () {
  const { esc, moeda, dataBR, opcoes, janela, lerForm, aviso, botaoExcluir, MESES } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const CATEGORIAS = ['Contabilidade', 'DAS / impostos da empresa', 'Certificado digital', 'Portais de licitação', 'Ferramentas e software', 'Marketing', 'Outros'];
  let anoEscolhido = null;

  function form(item) {
    const d = item || { data: calc.hoje(), categoria: 'Contabilidade', pago: false };
    const corpo =
      '<form id="form-desp" class="form-grade">' +
      '<div class="campo largo"><label for="dp-desc">Descrição *</label><input id="dp-desc" name="descricao" required value="' + esc(d.descricao) + '" placeholder="Ex.: Honorários do contador"></div>' +
      '<div class="campo"><label for="dp-cat">Categoria</label><select id="dp-cat" name="categoria">' + opcoes(CATEGORIAS, d.categoria) + '</select></div>' +
      '<div class="campo"><label for="dp-valor">Valor *</label><input id="dp-valor" name="valor" type="number" step="0.01" min="0" required value="' + esc(d.valor) + '"></div>' +
      '<div class="campo"><label for="dp-data">Data / vencimento *</label><input id="dp-data" name="data" type="date" required value="' + esc(d.data) + '"></div>' +
      (d.id ? '' : '<div class="campo"><label for="dp-rep">Repetir por quantos meses</label><input id="dp-rep" type="number" min="1" max="60" value="1" data-ignorar><span class="ajuda">Use 12 para lançar o ano todo.</span></div>') +
      '<label class="parcela-check largo"><input type="checkbox" name="pago"' + (d.pago ? ' checked' : '') + '> Já foi paga</label>' +
      '</form>';
    const rodape = (d.id ? '<button type="button" class="botao perigo" id="excluir-desp">Excluir</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-desp" class="botao">Salvar</button></div>';
    const j = janela({ titulo: d.id ? 'Editar despesa' : 'Nova despesa', corpo, rodape, estreita: true });
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

  GAH.telas.despesas = function (main) {
    const hoje = calc.hoje();
    const todas = D.lista('despesas');
    const anos = [...new Set(todas.map((d) => Number((d.data || '').slice(0, 4))).filter(Boolean).concat(Number(hoje.slice(0, 4))))].sort();
    if (!anoEscolhido || !anos.includes(anoEscolhido)) anoEscolhido = Number(hoje.slice(0, 4));
    const doAno = todas.filter((d) => (d.data || '').startsWith(String(anoEscolhido))).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
    const total = doAno.reduce((s, d) => s + calc.num(d.valor), 0);
    const aPagar = doAno.filter((d) => !d.pago).reduce((s, d) => s + calc.num(d.valor), 0);
    const mesesComGasto = new Set(doAno.map((d) => d.data.slice(0, 7))).size;
    const porCat = {};
    doAno.forEach((d) => (porCat[d.categoria || 'Outros'] = (porCat[d.categoria || 'Outros'] || 0) + calc.num(d.valor)));

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Despesas</h1><p>Custos da empresa que não são compra de licença. Entram no lucro líquido do Financeiro.</p></div>' +
      '<div class="acoes"><select class="filtro" id="dp-ano" aria-label="Ano">' + anos.map((a) => '<option' + (a === anoEscolhido ? ' selected' : '') + '>' + a + '</option>').join('') + '</select><button class="botao" id="nova-desp">+ Nova despesa</button></div></div>' +
      '<div class="kpis">' +
      '<div class="kpi destaque"><span class="kpi-rotulo">Total em ' + anoEscolhido + '</span><span class="kpi-valor">' + moeda(total) + '</span><span class="kpi-nota">' + doAno.length + ' lançamento(s)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Média por mês</span><span class="kpi-valor">' + moeda(mesesComGasto ? total / mesesComGasto : 0) + '</span><span class="kpi-nota">nos meses com despesa</span></div>' +
      '<div class="kpi' + (aPagar ? ' alerta' : '') + '"><span class="kpi-rotulo">Em aberto</span><span class="kpi-valor">' + moeda(aPagar) + '</span></div>' +
      '</div>' +
      '<div class="grade grade-lateral"><section class="painel"><div class="painel-cab"><h2>Lançamentos de ' + anoEscolhido + '</h2></div>' +
      (doAno.length
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="valor">Valor</th><th>Paga</th></tr></thead><tbody>' +
          doAno.map((d) => '<tr class="clicavel" data-id="' + esc(d.id) + '"><td>' + dataBR(d.data) + '</td><td class="nome">' + esc(d.descricao) + '</td><td>' + esc(d.categoria || '') + '</td><td class="valor">' + moeda(d.valor) + '</td>' +
            '<td><label class="parcela-check"><input type="checkbox" data-pagar="' + esc(d.id) + '"' + (d.pago ? ' checked' : '') + '> ' + (d.pago ? 'sim' : (d.data < hoje ? '<span class="negativo">vencida</span>' : 'não')) + '</label></td></tr>').join('') +
          '</tbody></table></div>'
        : '<div class="vazio"><strong>Nenhuma despesa em ' + anoEscolhido + '</strong>Lance o contador, o DAS e outros custos fixos para ver o lucro líquido real.</div>') +
      '</section>' +
      '<section class="painel"><div class="painel-cab"><h2>Por categoria</h2></div>' +
      (Object.keys(porCat).length
        ? '<div class="painel-corpo grade" style="gap:12px">' + Object.entries(porCat).sort((a, b) => b[1] - a[1]).map(([cat, v]) =>
            '<div><div style="display:flex;justify-content:space-between;gap:8px;font-size:.9rem"><span>' + esc(cat) + '</span><b class="num">' + moeda(v) + '</b></div><div class="progresso" style="margin-top:4px"><i style="width:' + (total ? (v / total) * 100 : 0) + '%"></i></div></div>').join('') + '</div>'
        : '<div class="vazio">Sem lançamentos.</div>') +
      '</section></div>';

    main.querySelector('#nova-desp').addEventListener('click', () => form(null));
    main.querySelector('#dp-ano').addEventListener('change', (e) => { anoEscolhido = Number(e.target.value); GAH.telas.despesas(main); });
    main.querySelectorAll('tr[data-id]').forEach((tr) => tr.addEventListener('click', (e) => {
      if (e.target.closest('label')) return;
      form(D.obter('despesas', tr.dataset.id));
    }));
    main.querySelectorAll('[data-pagar]').forEach((cb) => cb.addEventListener('change', async () => {
      const d = D.obter('despesas', cb.dataset.pagar);
      await D.salvar('despesas', Object.assign({}, d, { pago: cb.checked }));
    }));
  };
})();
