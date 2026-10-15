/* Tela Clientes: lista de órgãos e a ficha completa de cada um. */
(function () {
  const { esc, moeda, dataBR, opcoes, UFS, linkWhats, linkSeguro, ICONE_DRIVE } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const filtro = { busca: '', uf: '', situacao: '' };

  function resumoCliente(id, hoje) {
    const contratos = D.lista('contratos').filter((c) => c.clienteId === id && c.status !== 'cancelado');
    const r = { contratos: contratos.length, ativos: 0, venda: 0, recebido: 0, aReceber: 0, parcelasReceber: 0, atrasado: 0, compra: 0, pago: 0, aPagar: 0, parcelasPagar: 0, lucro: 0, proximoFim: '' };
    contratos.forEach((c) => {
      const s = calc.resumoContrato(c, hoje);
      r.venda += s.venda; r.recebido += s.recebido; r.aReceber += s.aReceber; r.parcelasReceber += s.parcelasReceber; r.atrasado += s.valorAtrasado;
      r.compra += s.compra; r.pago += s.pago; r.aPagar += s.aPagar; r.parcelasPagar += s.parcelasPagar; r.lucro += s.lucro;
      if (s.vigencia === 'vigente' || s.vigencia === 'vencendo') {
        r.ativos++;
        if (!r.proximoFim || c.vigenciaFim < r.proximoFim) r.proximoFim = c.vigenciaFim;
      }
    });
    return r;
  }

  function lista(main) {
    const hoje = calc.hoje();
    const clientes = D.lista('clientes').slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const linhas = clientes
      .map((c) => ({ c, r: resumoCliente(c.id, hoje) }))
      .filter(({ c, r }) => {
        const t = filtro.busca.toLowerCase();
        if (t && ![c.nome, c.sigla, c.cidade, ...(c.contatos || []).map((x) => x.nome)].join(' ').toLowerCase().includes(t)) return false;
        if (filtro.uf && c.uf !== filtro.uf) return false;
        if (filtro.situacao === 'receber' && r.aReceber <= 0) return false;
        if (filtro.situacao === 'atraso' && r.atrasado <= 0) return false;
        if (filtro.situacao === 'ativos' && !r.ativos) return false;
        if (filtro.situacao === 'pagar' && r.aPagar <= 0) return false;
        return true;
      });
    const ufsUsadas = [...new Set(clientes.map((c) => c.uf).filter(Boolean))].sort();

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Clientes</h1><p>' + clientes.length + ' órgãos cadastrados. Clique em um órgão para ver contratos, contatos e documentos.</p></div>' +
      '<div class="acoes"><button class="botao" id="novo-cliente">+ Novo órgão</button></div></div>' +
      '<section class="painel"><div class="painel-cab"><div class="filtros" style="flex:1">' +
      '<input class="filtro busca" id="cli-busca" type="search" placeholder="Buscar por órgão, cidade ou contato" value="' + esc(filtro.busca) + '" aria-label="Buscar">' +
      '<select class="filtro" id="cli-uf" aria-label="Estado">' + opcoes(ufsUsadas, filtro.uf, 'Todos os estados') + '</select>' +
      '<select class="filtro" id="cli-sit" aria-label="Situação">' + opcoes([['ativos', 'Com contrato vigente'], ['receber', 'Com valor a receber'], ['atraso', 'Com pagamento atrasado'], ['pagar', 'Com compra a pagar']], filtro.situacao, 'Todas as situações') + '</select>' +
      '</div></div>' +
      (linhas.length
        ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Órgão</th><th>Contato principal</th><th class="valor">Contratos</th><th>Próximo fim de vigência</th><th class="valor">A receber</th><th class="valor">A pagar</th><th>Drive</th></tr></thead><tbody>' +
          linhas.map(({ c, r }) => {
            const ct = (c.contatos || [])[0] || {};
            const drive = linkSeguro(c.linkDrive);
            return '<tr class="clicavel" data-id="' + esc(c.id) + '"><td><span class="nome">' + esc(c.nome) + '</span><span class="sub">' + esc([c.cidade, c.uf].filter(Boolean).join(' / ')) + '</span></td>' +
              '<td>' + (ct.nome ? esc(ct.nome) + '<span class="sub">' + esc(ct.telefone || ct.email || '') + '</span>' : '<span class="texto-suave">—</span>') + '</td>' +
              '<td class="valor">' + r.ativos + ' / ' + r.contratos + '</td>' +
              '<td>' + (r.proximoFim ? dataBR(r.proximoFim) : '<span class="texto-suave">—</span>') + '</td>' +
              '<td class="valor">' + moeda(r.aReceber) + (r.atrasado ? '<span class="sub negativo">' + moeda(r.atrasado) + ' em atraso</span>' : r.parcelasReceber ? '<span class="sub">' + r.parcelasReceber + ' parcela(s)</span>' : '') + '</td>' +
              '<td class="valor">' + moeda(r.aPagar) + (r.parcelasPagar ? '<span class="sub">' + r.parcelasPagar + ' parcela(s)</span>' : '') + '</td>' +
              '<td>' + (drive ? '<a href="' + esc(drive) + '" target="_blank" rel="noopener" data-sem-linha>Abrir pasta</a>' : '<span class="texto-suave">—</span>') + '</td></tr>';
          }).join('') +
          '</tbody></table></div>'
        : '<div class="vazio"><strong>' + (clientes.length ? 'Nenhum órgão com esses filtros' : 'Nenhum órgão cadastrado') + '</strong>' + (clientes.length ? 'Mude a busca ou os filtros.' : 'Clique em "+ Novo órgão" para começar, ou importe um backup em Ajustes.') + '</div>') +
      '</section>';

    main.querySelector('#novo-cliente').addEventListener('click', () => GAH.formCliente(null, (c) => (location.hash = '#/clientes/' + c.id)));
    const reler = () => {
      filtro.busca = main.querySelector('#cli-busca').value;
      filtro.uf = main.querySelector('#cli-uf').value;
      filtro.situacao = main.querySelector('#cli-sit').value;
      const pos = main.querySelector('#cli-busca').selectionStart;
      lista(main);
      const b = main.querySelector('#cli-busca');
      b.focus();
      b.setSelectionRange(pos, pos);
    };
    main.querySelector('#cli-busca').addEventListener('input', reler);
    main.querySelector('#cli-uf').addEventListener('change', reler);
    main.querySelector('#cli-sit').addEventListener('change', reler);
    main.querySelectorAll('tr[data-id]').forEach((tr) =>
      tr.addEventListener('click', (e) => {
        if (e.target.closest('[data-sem-linha]')) return;
        location.hash = '#/clientes/' + tr.dataset.id;
      })
    );
  }

  function ficha(main, id) {
    const c = D.obter('clientes', id);
    if (!c) {
      main.innerHTML = '<div class="painel"><div class="vazio"><strong>Órgão não encontrado</strong><a href="#/clientes">Voltar para a lista de clientes</a></div></div>';
      return;
    }
    const hoje = calc.hoje();
    const r = resumoCliente(id, hoje);
    const contratos = D.lista('contratos').filter((x) => x.clienteId === id).sort((a, b) => (b.vigenciaInicio || b.dataEntrega || '').localeCompare(a.vigenciaInicio || a.dataEntrega || ''));
    const drive = linkSeguro(c.linkDrive);
    const contatos = c.contatos || [];

    main.innerHTML =
      '<div class="cabecalho-tela"><div><div class="migalha"><a href="#/clientes">Clientes</a> / ' + esc(c.sigla || c.nome) + '</div><h1>' + esc(c.nome) + '</h1>' +
      '<p>' + esc([c.tipo, [c.cidade, c.uf].filter(Boolean).join(' / ')].filter(Boolean).join(' · ')) + '</p></div>' +
      '<div class="acoes"><button class="botao secundario" id="editar-cliente">Editar dados</button><button class="botao" id="novo-contrato">+ Novo contrato</button></div></div>' +
      '<div class="kpis">' +
      '<div class="kpi destaque"><span class="kpi-rotulo">Total em contratos</span><span class="kpi-valor">' + moeda(r.venda) + '</span><span class="kpi-nota">' + r.contratos + ' contrato(s), ' + r.ativos + ' vigente(s)</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Já recebido</span><span class="kpi-valor">' + moeda(r.recebido) + '</span></div>' +
      '<div class="kpi' + (r.atrasado ? ' alerta' : '') + '"><span class="kpi-rotulo">Falta receber</span><span class="kpi-valor">' + moeda(r.aReceber) + '</span><span class="kpi-nota">' + r.parcelasReceber + ' parcela(s)' + (r.atrasado ? ' · <span class="negativo">' + moeda(r.atrasado) + ' em atraso</span>' : '') + '</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Falta pagar das compras</span><span class="kpi-valor">' + moeda(r.aPagar) + '</span><span class="kpi-nota">' + r.parcelasPagar + ' parcela(s) · pago ' + moeda(r.pago) + '</span></div>' +
      '<div class="kpi"><span class="kpi-rotulo">Lucro com este órgão</span><span class="kpi-valor">' + moeda(r.lucro) + '</span></div>' +
      '</div>' +
      '<div class="grade grade-lateral">' +
      '<section class="painel" id="lista-contratos"><div class="painel-cab"><h2>Contratos e licenças</h2><span class="sub">Marque as parcelas conforme receber ou pagar</span></div>' +
      (contratos.length ? contratos.map((x) => GAH.blocoContrato(x)).join('') : '<div class="vazio"><strong>Nenhum contrato ainda</strong>Clique em "+ Novo contrato" para registrar a venda de licenças a este órgão.</div>') +
      '</section>' +
      '<div class="grade" style="align-content:start">' +
      '<section class="painel"><div class="painel-cab"><h2>Documentos</h2></div><div class="painel-corpo">' +
      (drive
        ? '<a class="drive-botao" href="' + esc(drive) + '" target="_blank" rel="noopener">' + ICONE_DRIVE + '<div><strong>Abrir pasta no Google Drive</strong><span>Contratos, notas fiscais, empenhos e demais documentos</span></div></a>'
        : '<div class="drive-botao">' + ICONE_DRIVE + '<div><strong>Pasta do Drive não cadastrada</strong><span><button type="button" class="link-botao" id="cadastrar-drive">Cadastrar o link da pasta</button></span></div></div>') +
      '</div></section>' +
      '<section class="painel"><div class="painel-cab"><h2>Contatos no órgão</h2></div><div class="painel-corpo"><div class="contatos">' +
      (contatos.length
        ? contatos.map((ct) => {
            const w = linkWhats(ct.telefone);
            return '<div class="contato"><strong>' + esc(ct.nome || 'Sem nome') + '</strong>' + (ct.cargo ? '<span class="texto-suave">' + esc(ct.cargo) + '</span>' : '') +
              (ct.telefone ? '<div class="linha-contato"><span>' + esc(ct.telefone) + '</span>' + (w ? '<a href="' + esc(w) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</div>' : '') +
              (ct.email ? '<div class="linha-contato"><span>' + esc(ct.email) + '</span></div>' : '') + '</div>';
          }).join('')
        : '<p class="texto-suave" style="margin:0">Nenhum contato cadastrado. Use "Editar dados" para incluir.</p>') +
      '</div></div></section>' +
      '<section class="painel"><div class="painel-cab"><h2>Dados do órgão</h2></div><div class="painel-corpo"><dl class="ficha">' +
      '<dt>Nome</dt><dd>' + esc(c.nome) + '</dd>' +
      (c.sigla ? '<dt>Sigla</dt><dd>' + esc(c.sigla) + '</dd>' : '') +
      '<dt>CNPJ</dt><dd>' + esc(c.cnpj || '—') + '</dd>' +
      '<dt>Tipo</dt><dd>' + esc(c.tipo || '—') + '</dd>' +
      '<dt>Cidade</dt><dd>' + esc([c.cidade, c.uf].filter(Boolean).join(' / ') || '—') + '</dd>' +
      (c.endereco ? '<dt>Endereço</dt><dd>' + esc(c.endereco) + '</dd>' : '') +
      (c.observacoes ? '<dt>Observações</dt><dd>' + esc(c.observacoes) + '</dd>' : '') +
      '</dl></div></section>' +
      '</div></div>';

    main.querySelector('#editar-cliente').addEventListener('click', () => GAH.formCliente(c));
    main.querySelector('#novo-contrato').addEventListener('click', () => GAH.formContrato(null, { clienteId: id }));
    const cad = main.querySelector('#cadastrar-drive');
    if (cad) cad.addEventListener('click', () => GAH.formCliente(c));
    GAH.ligarContratos(main.querySelector('#lista-contratos'));
  }

  GAH.telas.clientes = function (main, id) {
    if (id) ficha(main, id);
    else lista(main);
  };
})();
