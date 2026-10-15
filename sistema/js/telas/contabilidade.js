/* Tela Contabilidade: dados do escritório contábil e, mês a mês, as guias e documentos enviados pelo contador. */
(function () {
  const { esc, moeda, dataBR, mesBR, opcoes, janela, lerForm, aviso, botaoExcluir, linkSeguro, linkWhats, ICONE_DRIVE } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;
  const TIPOS = ['DAS (Simples Nacional)', 'DARF', 'GPS / INSS', 'FGTS', 'ISS', 'Pró-labore', 'Folha de pagamento', 'Balancete', 'DRE', 'Honorários do contador', 'Declaração', 'Outro'];
  let anoEscolhido = null;

  const escritorio = () => D.obter('contabilidade', 'escritorio') || { id: 'escritorio' };
  const doMes = (comp) => D.obter('contabilidade', comp) || { id: comp, competencia: comp, documentos: [] };

  function formEscritorio() {
    const e = escritorio();
    const corpo =
      '<form id="form-esc" class="form-grade">' +
      '<div class="campo largo"><label for="es-nome">Escritório de contabilidade</label><input id="es-nome" name="nome" value="' + esc(e.nome) + '"></div>' +
      '<div class="campo"><label for="es-contador">Contador(a) responsável</label><input id="es-contador" name="contador" value="' + esc(e.contador) + '"></div>' +
      '<div class="campo"><label for="es-crc">CRC</label><input id="es-crc" name="crc" value="' + esc(e.crc) + '"></div>' +
      '<div class="campo"><label for="es-tel">Telefone / WhatsApp</label><input id="es-tel" name="telefone" value="' + esc(e.telefone) + '"></div>' +
      '<div class="campo"><label for="es-email">E-mail</label><input id="es-email" name="email" type="email" value="' + esc(e.email) + '"></div>' +
      '<div class="campo"><label for="es-hon">Honorário mensal</label><input id="es-hon" name="honorario" type="number" step="0.01" value="' + esc(e.honorario) + '"></div>' +
      '<div class="campo"><label for="es-venc">Dia de vencimento do honorário</label><input id="es-venc" name="diaVencimento" type="number" min="1" max="31" value="' + esc(e.diaVencimento) + '"></div>' +
      '<div class="campo"><label for="es-regime">Regime tributário da empresa</label><input id="es-regime" name="regime" value="' + esc(e.regime) + '" placeholder="Ex.: Simples Nacional — Anexo III"></div>' +
      '<div class="campo"><label for="es-cnpj">CNPJ da GAH Licita</label><input id="es-cnpj" name="cnpjEmpresa" value="' + esc(e.cnpjEmpresa) + '"></div>' +
      '<div class="campo largo"><label for="es-drive">Pasta geral da contabilidade no Drive</label><input id="es-drive" name="linkDrive" type="url" value="' + esc(e.linkDrive) + '"></div>' +
      '<div class="campo largo"><label for="es-portal">Portal do contador (se houver)</label><input id="es-portal" name="linkPortal" type="url" value="' + esc(e.linkPortal) + '"></div>' +
      '<div class="campo largo"><label for="es-obs">Observações</label><textarea id="es-obs" name="observacoes">' + esc(e.observacoes) + '</textarea></div>' +
      '</form>';
    const j = janela({ titulo: 'Dados da contabilidade', corpo, rodape: '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-esc" class="botao">Salvar</button></div>' });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    j.el.querySelector('#form-esc').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await D.salvar('contabilidade', Object.assign({}, e, lerForm(ev.target), { id: 'escritorio' }));
      j.fechar();
      aviso('Dados da contabilidade salvos');
    });
  }

  /* Guia ou documento de um mês. Guias com valor podem entrar nas Despesas. */
  function formDocumento(comp, doc) {
    const d = doc || { tipo: 'DAS (Simples Nacional)', lancarDespesa: true };
    const corpo =
      '<form id="form-doc" class="form-grade">' +
      '<div class="campo"><label for="dc-tipo">Tipo</label><select id="dc-tipo" name="tipo">' + opcoes(TIPOS, d.tipo) + '</select></div>' +
      '<div class="campo"><label for="dc-desc">Descrição</label><input id="dc-desc" name="descricao" value="' + esc(d.descricao) + '" placeholder="Opcional"></div>' +
      '<div class="campo largo"><label for="dc-link">Link do arquivo no Drive</label><input id="dc-link" name="link" type="url" value="' + esc(d.link) + '" placeholder="https://drive.google.com/file/d/..."><span class="ajuda">No Drive, clique com o botão direito no PDF → Compartilhar → Copiar link.</span></div>' +
      '<div class="campo"><label for="dc-valor">Valor (se for guia)</label><input id="dc-valor" name="valor" type="number" step="0.01" min="0" value="' + esc(d.valor) + '"></div>' +
      '<div class="campo"><label for="dc-venc">Vencimento</label><input id="dc-venc" name="vencimento" type="date" value="' + esc(d.vencimento) + '"></div>' +
      '<label class="parcela-check"><input type="checkbox" name="pago"' + (d.pago ? ' checked' : '') + '> Já foi paga</label>' +
      '<label class="parcela-check"><input type="checkbox" name="lancarDespesa"' + (d.lancarDespesa ? ' checked' : '') + '> Somar nas Despesas da empresa</label>' +
      '<p class="texto-suave largo" style="margin:0;font-size:.84rem">Os honorários do contador entram pela "Mensalidade do contador" de cada mês, para não contar duas vezes.</p>' +
      '</form>';
    const rodape = (d.id ? '<button type="button" class="botao perigo" id="excluir-doc">Excluir</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-doc" class="botao">Salvar</button></div>';
    const j = janela({ titulo: (d.id ? 'Editar documento' : 'Novo documento') + ' — ' + mesBR(comp), corpo, rodape, estreita: true });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);

    async function gravar(lista) {
      await D.salvar('contabilidade', Object.assign({}, doMes(comp), { documentos: lista }));
    }
    botaoExcluir(j.el, '#excluir-doc', 'Excluir este documento?', async () => {
      await gravar(doMes(comp).documentos.filter((x) => x.id !== d.id));
      if (D.obter('despesas', 'guia-' + d.id)) await D.excluir('despesas', 'guia-' + d.id);
      j.fechar();
      aviso('Documento excluído');
    });
    j.el.querySelector('#form-doc').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const novo = Object.assign({}, d, lerForm(ev.target));
      if (!novo.id) novo.id = D.novoId();
      novo.dataPagamento = novo.pago ? novo.dataPagamento || calc.hoje() : '';
      const lista = doMes(comp).documentos.filter((x) => x.id !== novo.id).concat(novo);
      await gravar(lista);
      const idDesp = 'guia-' + novo.id;
      if (novo.lancarDespesa && calc.num(novo.valor) > 0 && !/honor/i.test(novo.tipo)) {
        await D.salvar('despesas', Object.assign({}, D.obter('despesas', idDesp) || {}, {
          id: idDesp,
          descricao: novo.tipo + (novo.descricao ? ' — ' + novo.descricao : '') + ' (' + mesBR(comp) + ')',
          categoria: /honor/i.test(novo.tipo) ? 'Contabilidade' : 'DAS / impostos da empresa',
          valor: calc.num(novo.valor),
          data: novo.vencimento || comp + '-20',
          pago: !!novo.pago,
          origem: 'contabilidade'
        }));
      } else if (D.obter('despesas', idDesp)) {
        await D.excluir('despesas', idDesp);
      }
      j.fechar();
      aviso('Documento salvo');
    });
  }

  /* Mensalidade do contador em um mês: valor pago, se já pagou e quando. Entra no lucro líquido. */
  function formMensalidade(comp) {
    const m = doMes(comp);
    const e = escritorio();
    const atual = m.mensalidade || {};
    const valor = atual.valor !== undefined && atual.valor !== '' ? atual.valor : e.honorario || '';
    const vence = e.diaVencimento ? comp + '-' + String(Math.min(Number(e.diaVencimento), 28)).padStart(2, '0') : '';
    const corpo =
      '<form id="form-mensal" class="form-grade">' +
      '<div class="campo"><label for="ms-valor">Valor da mensalidade</label><input id="ms-valor" name="valor" type="number" step="0.01" min="0" value="' + esc(valor) + '">' +
      (e.honorario ? '<span class="ajuda">Honorário cadastrado: ' + moeda(e.honorario) + '</span>' : '<span class="ajuda">Cadastre o honorário em "Escritório contábil" para vir preenchido.</span>') + '</div>' +
      '<div class="campo"><label for="ms-data">Data do pagamento</label><input id="ms-data" name="data" type="date" value="' + esc(atual.data) + '"></div>' +
      '<label class="parcela-check largo"><input type="checkbox" name="pago" id="ms-pago"' + (atual.pago ? ' checked' : '') + '> Já paguei</label>' +
      (vence ? '<p class="texto-suave largo" style="margin:0">Vencimento: ' + dataBR(vence) + '</p>' : '') +
      '</form>';
    const rodape = (atual.pago ? '' : '<button type="button" class="botao verde" id="ms-rapido">Paguei hoje</button>') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-mensal" class="botao">Salvar</button></div>';
    const j = janela({ titulo: 'Mensalidade do contador — ' + mesBR(comp), corpo, rodape, estreita: true });
    const gravar = async (dados) => {
      await D.salvar('contabilidade', Object.assign({}, doMes(comp), { mensalidade: dados }));
      j.fechar();
      aviso(dados.pago ? 'Mensalidade marcada como paga' : 'Mensalidade salva');
    };
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    j.el.querySelector('#ms-pago').addEventListener('change', (ev) => {
      const d = j.el.querySelector('#ms-data');
      if (ev.target.checked && !d.value) d.value = calc.hoje();
    });
    const rapido = j.el.querySelector('#ms-rapido');
    if (rapido) rapido.addEventListener('click', () => {
      const v = Number(j.el.querySelector('#ms-valor').value) || 0;
      if (!v) { aviso('Informe o valor da mensalidade.', true); return; }
      gravar({ valor: v, pago: true, data: calc.hoje() });
    });
    j.el.querySelector('#form-mensal').addEventListener('submit', (ev) => {
      ev.preventDefault();
      const dados = lerForm(ev.target);
      dados.valor = calc.num(dados.valor);
      if (!dados.pago) dados.data = dados.data || '';
      gravar(dados);
    });
  }

  function seloMensalidade(comp, hoje) {
    const ms = doMes(comp).mensalidade;
    if (!ms || !calc.num(ms.valor)) return '<span class="selo">não lançada</span>';
    if (ms.pago) return '<span class="selo ok">paga' + (ms.data ? ' ' + dataBR(ms.data).slice(0, 5) : '') + '</span>';
    const e = escritorio();
    const vence = comp + '-' + String(Math.min(Number(e.diaVencimento) || 10, 28)).padStart(2, '0');
    return vence < hoje ? '<span class="selo critico">em atraso</span>' : '<span class="selo alerta">a pagar</span>';
  }

  function formPasta(comp) {
    const m = doMes(comp);
    const corpo =
      '<form id="form-pasta" class="form-grade">' +
      '<div class="campo largo"><label for="pm-link">Pasta do mês no Drive</label><input id="pm-link" name="linkPasta" type="url" value="' + esc(m.linkPasta) + '"></div>' +
      '<div class="campo largo"><label for="pm-obs">Anotações do mês</label><textarea id="pm-obs" name="observacoes">' + esc(m.observacoes) + '</textarea></div>' +
      '</form>';
    const j = janela({ titulo: 'Pasta de ' + mesBR(comp), corpo, rodape: '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-pasta" class="botao">Salvar</button></div>', estreita: true });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    j.el.querySelector('#form-pasta').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      await D.salvar('contabilidade', Object.assign({}, m, lerForm(ev.target)));
      j.fechar();
      aviso('Mês salvo');
    });
  }

  function painelMensalidades(hoje) {
    const ultimo = anoEscolhido === Number(hoje.slice(0, 4)) ? Number(hoje.slice(5, 7)) : 12;
    let pago = 0, aberto = 0, qtdPagas = 0;
    const linhas = [];
    for (let i = 1; i <= ultimo; i++) {
      const comp = anoEscolhido + '-' + String(i).padStart(2, '0');
      const ms = doMes(comp).mensalidade || {};
      const v = calc.num(ms.valor);
      if (ms.pago) { pago += v; qtdPagas++; } else aberto += v;
      linhas.push('<tr><td>' + esc(GAH.u.MESES[i - 1].charAt(0).toUpperCase() + GAH.u.MESES[i - 1].slice(1)) + '</td><td class="valor">' + (v ? moeda(v) : '—') + '</td><td>' + seloMensalidade(comp, hoje) + '</td></tr>');
    }
    return '<section class="painel"><div class="painel-cab"><h2>Mensalidades de ' + anoEscolhido + '</h2><span class="sub">' + qtdPagas + ' de ' + ultimo + ' paga(s)</span></div>' +
      '<div class="painel-corpo" style="padding-bottom:0"><div class="previa"><span>Pago: <b>' + moeda(pago) + '</b></span><span>Lançado e não pago: <b>' + moeda(aberto) + '</b></span></div></div>' +
      '<div class="tabela-rolagem"><table class="tabela"><tbody>' + linhas.reverse().join('') + '</tbody></table></div>' +
      '<p class="texto-suave" style="margin:0;padding:10px 18px 14px;font-size:.84rem">As mensalidades entram no Financeiro e são abatidas do lucro líquido.</p></section>';
  }

  GAH.telas.contabilidade = function (main) {
    const hoje = calc.hoje();
    const e = escritorio();
    const meses = D.lista('contabilidade').filter((x) => /^\d{4}-\d{2}$/.test(x.id));
    const anos = [...new Set(meses.map((m) => Number(m.id.slice(0, 4))).concat(Number(hoje.slice(0, 4))))].sort();
    if (!anoEscolhido || !anos.includes(anoEscolhido)) anoEscolhido = Number(hoje.slice(0, 4));
    const ultimoMes = anoEscolhido === Number(hoje.slice(0, 4)) ? Number(hoje.slice(5, 7)) : 12;
    const pendentes = meses.flatMap((m) => (m.documentos || []).filter((d) => calc.num(d.valor) > 0 && !d.pago).map((d) => Object.assign({ comp: m.id }, d))).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    const w = linkWhats(e.telefone);

    let cartoesMeses = '';
    for (let mes = ultimoMes; mes >= 1; mes--) {
      const comp = anoEscolhido + '-' + String(mes).padStart(2, '0');
      const m = doMes(comp);
      const docs = (m.documentos || []).slice().sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
      const totalGuias = docs.reduce((s, d) => s + calc.num(d.valor), 0);
      const pasta = linkSeguro(m.linkPasta);
      cartoesMeses +=
        '<section class="painel"><div class="painel-cab"><div><h3>' + esc(mesBR(comp).charAt(0).toUpperCase() + mesBR(comp).slice(1)) + '</h3><span class="sub">' + docs.length + ' documento(s)' + (totalGuias ? ' · ' + moeda(totalGuias) + ' em guias' : '') + '</span></div>' +
        '<div class="acoes">' + (pasta ? '<a class="botao secundario pequeno" href="' + esc(pasta) + '" target="_blank" rel="noopener">Abrir pasta do mês</a>' : '') +
        '<button type="button" class="botao secundario pequeno" data-pasta="' + comp + '">' + (pasta ? 'Editar pasta' : 'Cadastrar pasta') + '</button>' +
        '<button type="button" class="botao pequeno" data-novo-doc="' + comp + '">+ Documento</button></div></div>' +
        '<div class="faixa-mensalidade"><span>Mensalidade do contador: <b>' + (m.mensalidade && calc.num(m.mensalidade.valor) ? moeda(m.mensalidade.valor) : '—') + '</b></span>' + seloMensalidade(comp, hoje) +
        '<button type="button" class="botao secundario pequeno" data-mensal="' + comp + '">' + (m.mensalidade && m.mensalidade.pago ? 'Editar' : 'Lançar pagamento') + '</button></div>' +
        (docs.length
          ? '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>Documento</th><th>Vencimento</th><th class="valor">Valor</th><th>Situação</th><th>Arquivo</th></tr></thead><tbody>' +
            docs.map((d) => {
              const link = linkSeguro(d.link);
              const situacao = !calc.num(d.valor) ? '<span class="selo">documento</span>' : d.pago ? '<span class="selo ok">paga ' + dataBR(d.dataPagamento) + '</span>' : d.vencimento && d.vencimento < hoje ? '<span class="selo critico">vencida</span>' : '<span class="selo alerta">a pagar</span>';
              return '<tr class="clicavel" data-doc="' + comp + '|' + esc(d.id) + '"><td class="nome">' + esc(d.tipo) + (d.descricao ? '<span class="sub">' + esc(d.descricao) + '</span>' : '') + '</td><td>' + dataBR(d.vencimento) + '</td><td class="valor">' + (calc.num(d.valor) ? moeda(d.valor) : '—') + '</td><td>' + situacao + '</td>' +
                '<td>' + (link ? '<a href="' + esc(link) + '" target="_blank" rel="noopener" data-sem-linha>Abrir</a>' : '<span class="texto-suave">sem link</span>') + '</td></tr>';
            }).join('') + '</tbody></table></div>'
          : m.observacoes ? '<p class="texto-suave" style="margin:0;padding:14px 18px">' + esc(m.observacoes) + '</p>' : '') +
        '</section>';
    }

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Contabilidade</h1><p>Dados do escritório contábil e, mês a mês, as guias e documentos enviados pelo contador.</p></div>' +
      '<div class="acoes"><select class="filtro" id="cb-ano" aria-label="Ano">' + anos.map((a) => '<option' + (a === anoEscolhido ? ' selected' : '') + '>' + a + '</option>').join('') + '</select></div></div>' +
      '<div class="grade grade-lateral"><div class="grade" style="align-content:start">' + cartoesMeses + '</div>' +
      '<div class="grade" style="align-content:start">' +
      '<section class="painel"><div class="painel-cab"><h2>Escritório contábil</h2><button type="button" class="botao secundario pequeno" id="editar-esc">Editar</button></div><div class="painel-corpo grade" style="gap:12px">' +
      (e.nome || e.contador || e.honorario || e.cnpjEmpresa
        ? '<dl class="ficha">' +
          (e.nome ? '<dt>Escritório</dt><dd>' + esc(e.nome) + '</dd>' : '') +
          (e.contador ? '<dt>Contador(a)</dt><dd>' + esc(e.contador) + (e.crc ? ' · CRC ' + esc(e.crc) : '') + '</dd>' : '') +
          (e.telefone ? '<dt>Telefone</dt><dd>' + esc(e.telefone) + (w ? ' · <a href="' + esc(w) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</dd>' : '') +
          (e.email ? '<dt>E-mail</dt><dd>' + esc(e.email) + '</dd>' : '') +
          (e.honorario ? '<dt>Honorário</dt><dd>' + moeda(e.honorario) + (e.diaVencimento ? ' · vence dia ' + esc(e.diaVencimento) : '') + '</dd>' : '') +
          (e.regime ? '<dt>Regime</dt><dd>' + esc(e.regime) + '</dd>' : '') +
          (e.cnpjEmpresa ? '<dt>CNPJ GAH</dt><dd>' + esc(e.cnpjEmpresa) + '</dd>' : '') +
          (e.observacoes ? '<dt>Obs.</dt><dd>' + esc(e.observacoes) + '</dd>' : '') +
          '</dl>'
        : '<p class="texto-suave" style="margin:0">Cadastre o escritório, o contador e o honorário mensal.</p>') +
      (!e.nome && !e.contador ? '<p class="texto-suave" style="margin:0">Falta o nome do escritório e do contador: clique em Editar.</p>' : '') +
      (linkSeguro(e.linkDrive) ? '<a class="drive-botao" href="' + esc(linkSeguro(e.linkDrive)) + '" target="_blank" rel="noopener">' + ICONE_DRIVE + '<div><strong>Pasta da contabilidade</strong><span>Todos os documentos no Drive</span></div></a>' : '') +
      (linkSeguro(e.linkPortal) ? '<a class="botao secundario" href="' + esc(linkSeguro(e.linkPortal)) + '" target="_blank" rel="noopener">Abrir portal do contador</a>' : '') +
      '</div></section>' +
      painelMensalidades(hoje) +
      '<section class="painel"><div class="painel-cab"><h2>Guias a pagar</h2><span class="sub">' + moeda(pendentes.reduce((s, d) => s + calc.num(d.valor), 0)) + '</span></div>' +
      (pendentes.length
        ? '<ul class="avisos">' + pendentes.map((d) => '<li><div class="data-bloco"><b>' + (d.vencimento ? d.vencimento.slice(8, 10) : '—') + '</b><span>' + (d.vencimento ? GAH.u.MESES_CURTOS[Number(d.vencimento.slice(5, 7)) - 1] : '') + '</span></div><div class="titulo">' + esc(d.tipo) + ' — ' + moeda(d.valor) + '<span class="detalhe">competência ' + esc(mesBR(d.comp)) + '</span></div>' + (d.vencimento && d.vencimento < hoje ? '<span class="selo critico">vencida</span>' : '') + '</li>').join('') + '</ul>'
        : '<div class="vazio"><strong>Nenhuma guia em aberto</strong>As guias com valor e não pagas aparecem aqui.</div>') +
      '</section></div></div>';

    main.querySelector('#editar-esc').addEventListener('click', formEscritorio);
    main.querySelector('#cb-ano').addEventListener('change', (ev) => { anoEscolhido = Number(ev.target.value); GAH.telas.contabilidade(main); });
    main.querySelectorAll('[data-novo-doc]').forEach((b) => b.addEventListener('click', () => formDocumento(b.dataset.novoDoc)));
    main.querySelectorAll('[data-pasta]').forEach((b) => b.addEventListener('click', () => formPasta(b.dataset.pasta)));
    main.querySelectorAll('[data-mensal]').forEach((b) => b.addEventListener('click', () => formMensalidade(b.dataset.mensal)));
    main.querySelectorAll('[data-doc]').forEach((tr) => tr.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-sem-linha]')) return;
      const [comp, id] = tr.dataset.doc.split('|');
      formDocumento(comp, doMes(comp).documentos.find((x) => x.id === id));
    }));
  };
})();
