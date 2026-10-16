/* Tela Licitações: acompanhamento das disputas, da análise do edital ao resultado. */
(function () {
  const { esc, moeda, dataBR, opcoes, janela, lerForm, aviso, botaoExcluir, UFS, linkSeguro, pct } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const SITUACOES = [['analise', 'Em análise'], ['proposta', 'Proposta enviada'], ['disputa', 'Em disputa'], ['ganha', 'Ganha'], ['perdida', 'Perdida'], ['desistencia', 'Desistência / deserta']];
  const PORTAIS = ['Compras.gov.br', 'BLL Compras', 'BNC', 'Licitanet', 'Portal de Compras Públicas', 'Licitações-e (BB)', 'Bolsa de Licitações e Leilões', 'Portal próprio do órgão', 'Outro'];
  const COLUNAS = [['analise', 'Em análise'], ['proposta', 'Proposta enviada'], ['disputa', 'Em disputa'], ['ganha', 'Ganhas'], ['fim', 'Perdidas e desistências']];

  function form(item) {
    const l = item || { status: 'analise' };
    const corpo =
      '<form id="form-lic" class="form-grade">' +
      '<div class="campo largo"><label for="lic-orgao">Órgão *</label><input id="lic-orgao" name="orgao" required value="' + esc(l.orgao) + '"></div>' +
      '<div class="campo"><label for="lic-cidade">Cidade</label><input id="lic-cidade" name="cidade" value="' + esc(l.cidade) + '"></div>' +
      '<div class="campo"><label for="lic-uf">Estado</label><select id="lic-uf" name="uf">' + opcoes(UFS, l.uf, 'UF') + '</select></div>' +
      '<div class="campo"><label for="lic-edital">Nº do edital / processo</label><input id="lic-edital" name="numeroEdital" value="' + esc(l.numeroEdital) + '"></div>' +
      '<div class="campo"><label for="lic-portal">Portal</label><input id="lic-portal" name="portal" list="lic-portais" value="' + esc(l.portal) + '"><datalist id="lic-portais">' + PORTAIS.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="campo largo"><label for="lic-objeto">Objeto</label><input id="lic-objeto" name="objeto" value="' + esc(l.objeto) + '" placeholder="Ex.: 20 licenças de ChatGPT Business por 12 meses"></div>' +
      '<div class="campo"><label for="lic-produto">Licença oferecida</label><input id="lic-produto" name="produto" value="' + esc(l.produto) + '"></div>' +
      '<div class="campo"><label for="lic-data">Data da disputa</label><input id="lic-data" name="dataDisputa" type="date" value="' + esc(l.dataDisputa) + '"></div>' +
      '<div class="campo"><label for="lic-hora">Hora</label><input id="lic-hora" name="horaDisputa" type="time" value="' + esc(l.horaDisputa) + '"></div>' +
      '<div class="campo"><label for="lic-estimado">Valor estimado do edital</label><input id="lic-estimado" name="valorEstimado" type="number" step="0.01" value="' + esc(l.valorEstimado) + '"></div>' +
      '<div class="campo"><label for="lic-proposta">Nosso valor (proposta/lance)</label><input id="lic-proposta" name="valorProposta" type="number" step="0.01" value="' + esc(l.valorProposta) + '"></div>' +
      '<div class="campo"><label for="lic-status">Situação</label><select id="lic-status" name="status">' + opcoes(SITUACOES, l.status) + '</select></div>' +
      '<div class="campo largo"><label for="lic-link">Link do edital</label><input id="lic-link" name="linkEdital" type="url" value="' + esc(l.linkEdital) + '"></div>' +
      '<div class="campo largo"><label for="lic-obs">Anotações (documentos exigidos, concorrentes, resultado)</label><textarea id="lic-obs" name="observacoes">' + esc(l.observacoes) + '</textarea></div>' +
      '</form>';
    const rodape = (l.id ? '<button type="button" class="botao perigo" id="excluir-lic">Excluir</button>' : '') +
      '<div class="dir">' + (l.id && l.status === 'ganha' ? '<button type="button" class="botao verde" id="lic-contrato">Criar contrato</button>' : '') +
      '<button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-lic" class="botao">Salvar</button></div>';
    const j = janela({ titulo: l.id ? 'Editar licitação' : 'Nova licitação', corpo, rodape });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    botaoExcluir(j.el, '#excluir-lic', 'Excluir esta licitação?', async () => {
      if (GAH.google) GAH.google.aoExcluir(l);
      await D.excluir('licitacoes', l.id);
      j.fechar();
      aviso('Licitação excluída');
    });
    const criar = j.el.querySelector('#lic-contrato');
    if (criar) criar.addEventListener('click', async () => {
      let cli = D.lista('clientes').find((c) => c.nome.trim().toLowerCase() === (l.orgao || '').trim().toLowerCase());
      if (!cli) cli = await D.salvar('clientes', { nome: l.orgao, cidade: l.cidade || '', uf: l.uf || '', contatos: [] });
      j.fechar();
      GAH.formContrato(null, { clienteId: cli.id, produto: l.produto || '', valor: l.valorProposta || '', aoSalvar: (ct) => (location.hash = '#/clientes/' + ct.clienteId) });
    });
    j.el.querySelector('#form-lic').addEventListener('submit', async (e) => {
      e.preventDefault();
      const salva = await D.salvar('licitacoes', Object.assign({}, l, lerForm(e.target)));
      if (GAH.google) GAH.google.aoSalvar('licitacoes', salva);
      j.fechar();
      aviso('Licitação salva');
    });
  }

  GAH.telas.licitacoes = function (main) {
    const hoje = calc.hoje();
    const lic = D.lista('licitacoes').slice().sort((a, b) => (a.dataDisputa || '9').localeCompare(b.dataDisputa || '9'));
    const decididas = lic.filter((l) => ['ganha', 'perdida'].includes(l.status));
    const ganhas = lic.filter((l) => l.status === 'ganha');
    const abertas = lic.filter((l) => ['analise', 'proposta', 'disputa'].includes(l.status));
    const col = (id) => lic.filter((l) => (id === 'fim' ? ['perdida', 'desistencia'].includes(l.status) : l.status === id));

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Licitações</h1><p>Editais em andamento e resultados. As datas de disputa aparecem na Agenda.</p></div>' +
      '<div class="acoes"><button class="botao" id="nova-lic">+ Nova licitação</button></div></div>' +
      '<div class="kpis">' +
      '<div class="kpi"><span class="kpi-rotulo">Em andamento</span><span class="kpi-valor">' + abertas.length + '</span><span class="kpi-nota">' + moeda(abertas.reduce((s, l) => s + calc.num(l.valorProposta || l.valorEstimado), 0)) + ' em jogo</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Ganhas</span><span class="kpi-valor">' + ganhas.length + '</span><span class="kpi-nota">' + moeda(ganhas.reduce((s, l) => s + calc.num(l.valorProposta), 0)) + '</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Taxa de sucesso</span><span class="kpi-valor">' + (decididas.length ? pct(ganhas.length / decididas.length) : '—') + '</span><span class="kpi-nota">ganhas ÷ (ganhas + perdidas)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Próxima disputa</span><span class="kpi-valor" style="font-size:1.2rem">' + (abertas.find((l) => l.dataDisputa >= hoje) ? dataBR(abertas.find((l) => l.dataDisputa >= hoje).dataDisputa) : '—') + '</span><span class="kpi-nota">' + esc((abertas.find((l) => l.dataDisputa >= hoje) || {}).orgao || 'nenhuma marcada') + '</span></div>' +
      '</div>' +
      '<div class="quadro" style="grid-template-columns:repeat(5,minmax(210px,1fr))">' +
      COLUNAS.map(([id, nome]) => {
        const itens = col(id);
        return '<section class="coluna-quadro"><h3>' + nome + ' <span>' + itens.length + '</span></h3><div class="cartoes">' +
          (itens.length
            ? itens.map((l) => '<div class="cartao" role="button" tabindex="0" data-lic="' + esc(l.id) + '"><strong>' + esc(l.orgao) + (l.uf ? ' · ' + esc(l.uf) : '') + '</strong>' +
                '<span class="sub">' + esc(l.objeto || l.produto || '') + '</span>' +
                '<span class="sub">' + (l.dataDisputa ? dataBR(l.dataDisputa) + (l.horaDisputa ? ' ' + esc(l.horaDisputa) : '') : 'sem data') + (l.portal ? ' · ' + esc(l.portal) : '') + '</span>' +
                (l.valorProposta || l.valorEstimado ? '<span class="sub"><b>' + moeda(l.valorProposta || l.valorEstimado) + '</b></span>' : '') +
                (l.status === 'desistencia' ? '<span class="selo">desistência</span>' : '') +
                (linkSeguro(l.linkEdital) ? '<a class="sub" href="' + esc(linkSeguro(l.linkEdital)) + '" target="_blank" rel="noopener" data-sem-abrir>Abrir edital</a>' : '') +
                '</div>').join('')
            : '<p class="texto-suave" style="margin:0;font-size:.85rem">Nenhuma.</p>') +
          '</div></section>';
      }).join('') +
      '</div>';

    main.querySelector('#nova-lic').addEventListener('click', () => form(null));
    main.querySelectorAll('[data-lic]').forEach((b) => {
      b.addEventListener('click', (e) => {
        if (e.target.closest('[data-sem-abrir]')) return;
        form(D.obter('licitacoes', b.dataset.lic));
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.target === b) form(D.obter('licitacoes', b.dataset.lic));
      });
    });
  };
})();
