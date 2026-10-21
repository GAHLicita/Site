/* Custos fixos: serviços que a empresa paga todo mês ou todo ano (hospedagem, e-mail, domínio, portais…),
   com uma grade mês a mês para marcar o que já foi pago. Aparecem dentro da tela Despesas. */
(function () {
  const { esc, moeda, dataBR, mesBR, opcoes, janela, lerForm, aviso, botaoExcluir, linkSeguro, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const CATEGORIAS = ['Hospedagem do site', 'Domínio', 'Plano de e-mail', 'Software e assinaturas', 'Telefone e internet', 'Certificado digital', 'Portais de licitação', 'Marketing', 'Outros'];
  const FORMAS = ['Cartão de crédito', 'Boleto', 'Pix', 'Débito automático', 'Transferência'];

  function formServico(item) {
    const hoje = calc.hoje();
    const c = item || { categoria: 'Hospedagem do site', periodicidade: 'mensal', inicio: calc.mesDe(hoje), diaVencimento: 10, ativo: true };
    const corpo =
      '<form id="form-custo" class="form-grade">' +
      '<div class="campo largo"><label for="cu-nome">Nome do serviço *</label><input id="cu-nome" name="nome" required value="' + esc(c.nome) + '" placeholder="Ex.: Hospedagem do site, Google Workspace"></div>' +
      '<div class="campo"><label for="cu-cat">Categoria</label><select id="cu-cat" name="categoria">' + opcoes(CATEGORIAS, c.categoria) + '</select></div>' +
      '<div class="campo"><label for="cu-forn">Empresa / fornecedor</label><input id="cu-forn" name="fornecedor" value="' + esc(c.fornecedor) + '" placeholder="Ex.: Hostinger, Google"></div>' +
      '<div class="campo"><label for="cu-valor">Valor *</label><input id="cu-valor" name="valor" type="number" step="0.01" min="0" required value="' + esc(c.valor) + '"><span class="ajuda">Valor cobrado em cada mês (ou em cada ano, se for anual).</span></div>' +
      '<div class="campo"><label for="cu-per">Cobrança</label><select id="cu-per" name="periodicidade">' + opcoes([['mensal', 'Todo mês'], ['anual', 'Uma vez por ano']], c.periodicidade) + '</select></div>' +
      '<div class="campo"><label for="cu-dia">Dia do vencimento</label><input id="cu-dia" name="diaVencimento" type="number" min="1" max="31" value="' + esc(c.diaVencimento) + '"></div>' +
      '<div class="campo"><label for="cu-forma">Forma de pagamento</label><select id="cu-forma" name="formaPagamento">' + opcoes(FORMAS, c.formaPagamento, 'Selecione') + '</select></div>' +
      '<div class="campo"><label for="cu-ini">Começou em (mês)</label><input id="cu-ini" name="inicio" type="month" required value="' + esc(c.inicio) + '"></div>' +
      '<div class="campo"><label for="cu-fim">Terminou em (mês)</label><input id="cu-fim" name="fim" type="month" value="' + esc(c.fim) + '"><span class="ajuda">Deixe vazio enquanto o serviço estiver ativo.</span></div>' +
      '<div class="campo largo"><label for="cu-link">Link para acessar ou pagar</label><input id="cu-link" name="link" type="url" value="' + esc(c.link) + '" placeholder="Ex.: painel da hospedagem"></div>' +
      '<div class="campo largo"><label for="cu-obs">Observações</label><textarea id="cu-obs" name="observacoes">' + esc(c.observacoes) + '</textarea></div>' +
      '</form>';
    const rodape = (c.id ? '<button type="button" class="botao perigo" id="excluir-custo">Excluir serviço</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-custo" class="botao">Salvar</button></div>';
    const j = janela({ titulo: c.id ? 'Editar serviço' : 'Novo custo fixo', corpo, rodape });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    botaoExcluir(j.el, '#excluir-custo', 'Excluir este serviço e todo o histórico de pagamentos?', async () => {
      await D.excluir('custos', c.id);
      j.fechar();
      aviso('Serviço excluído');
    });
    j.el.querySelector('#form-custo').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = lerForm(e.target);
      if (dados.fim && dados.fim < dados.inicio) {
        aviso('O mês de término não pode ser antes do início.', true);
        return;
      }
      await D.salvar('custos', Object.assign({ pagamentos: {} }, c, dados));
      j.fechar();
      aviso('Serviço salvo');
    });
  }

  /* Pagamento de um serviço em um mês: valor, se pagou, quando, ou "sem cobrança". */
  function formMes(custo, mes) {
    const p = (custo.pagamentos && custo.pagamentos[mes]) || {};
    const valor = p.valor !== undefined && p.valor !== '' ? p.valor : custo.valor;
    const corpo =
      '<form id="form-mes" class="form-grade">' +
      '<div class="campo"><label for="cm-valor">Valor pago no mês</label><input id="cm-valor" name="valor" type="number" step="0.01" min="0" value="' + esc(valor) + '"></div>' +
      '<div class="campo"><label for="cm-data">Data do pagamento</label><input id="cm-data" name="data" type="date" value="' + esc(p.data) + '"></div>' +
      '<label class="parcela-check largo"><input type="checkbox" name="pago" id="cm-pago"' + (p.pago ? ' checked' : '') + '> Já foi pago</label>' +
      '<label class="parcela-check largo"><input type="checkbox" name="semCobranca"' + (p.semCobranca ? ' checked' : '') + '> Não houve cobrança neste mês</label>' +
      '</form>';
    const j = janela({
      titulo: custo.nome + ' — ' + mesBR(mes),
      corpo,
      rodape: (p.pago ? '' : '<button type="button" class="botao verde" id="cm-rapido">Marcar como pago hoje</button>') + '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-mes" class="botao">Salvar</button></div>',
      estreita: true
    });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    const rapido = j.el.querySelector('#cm-rapido');
    if (rapido) rapido.addEventListener('click', async () => { j.fechar(); await alternarPago(custo, mes); });
    j.el.querySelector('#cm-pago').addEventListener('change', (e) => {
      const data = j.el.querySelector('#cm-data');
      if (e.target.checked && !data.value) data.value = calc.hoje();
    });
    j.el.querySelector('#form-mes').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = lerForm(e.target);
      if (!dados.pago) dados.data = dados.data || '';
      const pagamentos = Object.assign({}, custo.pagamentos, { [mes]: dados });
      await D.salvar('custos', Object.assign({}, custo, { pagamentos }));
      j.fechar();
      aviso('Mês salvo');
    });
  }

  async function alternarPago(custo, mes) {
    const p = Object.assign({}, (custo.pagamentos && custo.pagamentos[mes]) || {});
    p.pago = !p.pago;
    p.data = p.pago ? p.data || calc.hoje() : '';
    if (p.valor === undefined || p.valor === '') p.valor = calc.num(custo.valor);
    await D.salvar('custos', Object.assign({}, custo, { pagamentos: Object.assign({}, custo.pagamentos, { [mes]: p }) }));
    aviso(p.pago ? 'Marcado como pago' : 'Marcado como em aberto');
  }

  /* Grade dos custos fixos (serviços × meses do ano), usada dentro da tela Despesas. */
  function gradeCustos(ano) {
    const hoje = calc.hoje();
    const mesAtual = calc.mesDe(hoje);
    const custos = D.lista('custos').slice().sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    const lanc = calc.custosNoPeriodo(custos, [], ano + '-12').filter((l) => l.mes.startsWith(String(ano)));
    const totalAno = lanc.reduce((s, l) => s + l.valor, 0);
    const meses = Array.from({ length: 12 }, (_, i) => ano + '-' + String(i + 1).padStart(2, '0'));
    const porCelula = {};
    lanc.forEach((l) => (porCelula[l.custoId + '|' + l.mes] = l));
    const totalMes = meses.map((m) => lanc.filter((l) => l.mes === m).reduce((s, l) => s + l.valor, 0));
    const ativos = custos.filter((c) => !c.fim || c.fim >= mesAtual);
    const mensalFixo = ativos.reduce((s, c) => s + (c.periodicidade === 'anual' ? calc.num(c.valor) / 12 : calc.num(c.valor)), 0);

    const celula = (c, m) => {
      const l = porCelula[c.id + '|' + m];
      const p = (c.pagamentos && c.pagamentos[m]) || {};
      if (!l) {
        const dentro = c.inicio && m >= c.inicio && (!c.fim || m <= c.fim);
        return '<td class="celula-mes vazia">' + (dentro && p.semCobranca ? '<button type="button" class="mes-btn sem" data-mes="' + m + '" data-custo="' + esc(c.id) + '" title="Sem cobrança">sem</button>' : '<span class="texto-suave">·</span>') + '</td>';
      }
      const estado = l.pago ? 'pago' : l.data < hoje ? 'vencido' : 'aberto';
      const titulo = moeda(l.valor) + ' — ' + (l.pago ? 'pago' + (p.data ? ' em ' + dataBR(p.data) : '') : estado === 'vencido' ? 'vencido em ' + dataBR(l.data) : 'vence em ' + dataBR(l.data));
      return '<td class="celula-mes"><button type="button" class="mes-btn ' + estado + '" data-mes="' + m + '" data-custo="' + esc(c.id) + '" title="' + esc(titulo) + '" aria-label="' + esc(c.nome + ', ' + mesBR(m) + ': ' + titulo) + '">' +
        (l.pago ? '✓' : estado === 'vencido' ? '!' : '') + '<span>' + esc(moeda(l.valor).replace('R$', '').trim()) + '</span></button></td>';
    };

    return '<section class="painel"><div class="painel-cab"><div><h2>Custos fixos · ' + ano + '</h2><span class="sub">Domínio, site, e-mail, portais de disputa e outros serviços que se repetem. Custo fixo atual: <b>' + moeda(mensalFixo) + '/mês</b> (' + ativos.length + ' ativo(s); anuais divididos por 12). Clique no mês para marcar como pago, mudar o valor ou dizer que não houve cobrança. Clique no <b>nome do serviço</b> para editar ou excluir.</span></div>' +
      '<div class="legenda" style="margin:0"><span><i style="background:var(--ok-fundo);border:1px solid var(--ok)"></i>Pago</span><span><i style="background:var(--superficie);border:1px solid var(--linha-forte)"></i>Em aberto</span><span><i style="background:var(--critico-fundo);border:1px solid var(--critico)"></i>Vencido</span></div></div>' +
      (custos.length
        ? '<div class="tabela-rolagem"><table class="tabela grade-custos"><thead><tr><th>Serviço</th>' + MESES_CURTOS.map((m) => '<th class="valor">' + m + '</th>').join('') + '<th class="valor">Total</th></tr></thead><tbody>' +
          custos.map((c) => {
            const total = lanc.filter((l) => l.custoId === c.id).reduce((s, l) => s + l.valor, 0);
            const link = linkSeguro(c.link);
            return '<tr><td><button type="button" class="link-botao nome-servico" data-editar-custo="' + esc(c.id) + '" title="Editar ou excluir este serviço">' + esc(c.nome) + ' <span aria-hidden="true">✎</span></button>' +
              '<span class="sub">' + esc([c.fornecedor, c.categoria, c.periodicidade === 'anual' ? 'anual' : 'mensal', moeda(c.valor), c.formaPagamento].filter(Boolean).join(' · ')) + (link ? ' · <a href="' + esc(link) + '" target="_blank" rel="noopener">acessar</a>' : '') + (c.fim && c.fim < mesAtual ? ' · <b>encerrado</b>' : '') + '</span></td>' +
              meses.map((m) => celula(c, m)).join('') + '<td class="valor"><b>' + moeda(total) + '</b></td></tr>';
          }).join('') +
          '</tbody><tfoot><tr><td>Total do mês</td>' + totalMes.map((t) => '<td class="valor">' + (t ? esc(moeda(t).replace('R$', '').trim()) : '—') + '</td>').join('') + '<td class="valor">' + moeda(totalAno) + '</td></tr></tfoot></table></div>'
        : '<div class="vazio"><strong>Nenhum custo fixo cadastrado</strong>Cadastre a hospedagem do site, o plano de e-mail, o domínio, os portais de disputa e outros serviços que a empresa paga.</div>') +
      '</section>';
  }

  function ligarGrade(raiz) {
    raiz.querySelectorAll('[data-editar-custo]').forEach((b) => b.addEventListener('click', () => formServico(D.obter('custos', b.dataset.editarCusto))));
    raiz.querySelectorAll('.mes-btn').forEach((b) => b.addEventListener('click', () => formMes(D.obter('custos', b.dataset.custo), b.dataset.mes)));
  }

  GAH.custos = { formServico, formMes, alternarPago, gradeCustos, ligarGrade };
  // o endereço antigo #/custos abre a tela Despesas, onde os custos fixos ficam agora
  GAH.telas.custos = function (main) { GAH.telas.despesas(main); };
})();
