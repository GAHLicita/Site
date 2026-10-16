/* Núcleo do sistema: utilidades, topo, login, navegação, janelas e formulários compartilhados. */
(function () {
  const calc = GAH.calc;
  const D = GAH.dados;
  GAH.telas = GAH.telas || {};

  /* ---------- utilidades ---------- */
  const esc = (v) =>
    String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  const fmtMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const moeda = (v) => fmtMoeda.format(calc.num(v));
  const moedaCurta = (v) => {
    const n = calc.num(v);
    if (Math.abs(n) >= 1e6) return 'R$ ' + (n / 1e6).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + ' mi';
    if (Math.abs(n) >= 1e3) return 'R$ ' + (n / 1e3).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
    return moeda(n);
  };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const dataBR = (d) => (d ? d.slice(8, 10) + '/' + d.slice(5, 7) + '/' + d.slice(0, 4) : '—');
  const mesBR = (mes) => (mes ? MESES[Number(mes.slice(5, 7)) - 1] + ' ' + mes.slice(0, 4) : '');
  const pct = (v) => (calc.num(v) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%';
  const soDigitos = (t) => String(t || '').replace(/\D/g, '');
  const linkWhats = (tel) => {
    let d = soDigitos(tel);
    if (!d) return '';
    if (d.length <= 11) d = '55' + d;
    return 'https://wa.me/' + d;
  };
  const linkSeguro = (url) => (/^https?:\/\//i.test(url || '') ? url : '');

  const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
  const opcoes = (lista, atual, vazio) =>
    (vazio !== undefined ? '<option value="">' + esc(vazio) + '</option>' : '') +
    lista
      .map((o) => {
        const [v, t] = Array.isArray(o) ? o : [o, o];
        return '<option value="' + esc(v) + '"' + (String(v) === String(atual || '') ? ' selected' : '') + '>' + esc(t) + '</option>';
      })
      .join('');

  // Mesma logo do cabeçalho do site (arquivo logo-gah.png na raiz do site)
  const LOGO = '<img class="logo-marca" src="../logo-gah.png" alt="GAH Licita" width="44" height="64">';
  const ICONE_DRIVE =
    '<svg width="28" height="25" viewBox="0 0 87 78" aria-hidden="true"><path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/><path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/><path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/><path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/><path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/></svg>';

  function aviso(msg, erro) {
    document.querySelectorAll('.aviso-rapido').forEach((x) => x.remove());
    const el = document.createElement('div');
    el.className = 'aviso-rapido' + (erro ? ' erro' : '');
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), erro ? 5000 : 2600);
  }

  /* Janela modal. Retorna { el, fechar }. */
  function janela({ titulo, corpo, rodape, estreita, aoFechar }) {
    const fundo = document.createElement('div');
    fundo.className = 'fundo-janela';
    fundo.innerHTML =
      '<div class="janela' + (estreita ? ' estreita' : '') + '" role="dialog" aria-modal="true" aria-label="' + esc(titulo) + '">' +
      '<div class="janela-cab"><h2>' + esc(titulo) + '</h2><button type="button" class="fechar" aria-label="Fechar">×</button></div>' +
      '<div class="janela-corpo">' + corpo + '</div>' +
      (rodape ? '<div class="janela-rodape">' + rodape + '</div>' : '') +
      '</div>';
    document.body.appendChild(fundo);
    document.body.style.overflow = 'hidden';
    const fechar = () => {
      fundo.remove();
      if (!document.querySelector('.fundo-janela')) document.body.style.overflow = '';
      document.removeEventListener('keydown', tecla);
      if (aoFechar) aoFechar();
    };
    const tecla = (e) => {
      if (e.key === 'Escape') fechar();
    };
    document.addEventListener('keydown', tecla);
    fundo.querySelector('.fechar').addEventListener('click', fechar);
    fundo.addEventListener('mousedown', (e) => {
      if (e.target === fundo) fechar();
    });
    const primeiro = fundo.querySelector('input, select, textarea');
    if (primeiro) setTimeout(() => primeiro.focus(), 30);
    return { el: fundo, fechar };
  }

  /* Botão de excluir em dois passos (o navegador do sistema não mostra confirm()). */
  function botaoExcluir(container, seletor, texto, acao) {
    const btn = container.querySelector(seletor);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const caixa = document.createElement('div');
      caixa.className = 'confirmacao';
      caixa.innerHTML =
        '<span>' + esc(texto) + '</span><button type="button" class="botao perigo pequeno" data-sim>Sim, excluir</button><button type="button" class="botao secundario pequeno" data-nao>Cancelar</button>';
      btn.replaceWith(caixa);
      caixa.querySelector('[data-nao]').addEventListener('click', () => caixa.replaceWith(btn));
      caixa.querySelector('[data-sim]').addEventListener('click', acao);
    });
  }

  function lerForm(form) {
    const dados = {};
    form.querySelectorAll('[name]').forEach((campo) => {
      if (campo.closest('[data-ignorar]')) return;
      if (campo.type === 'checkbox') dados[campo.name] = campo.checked;
      else if (campo.type === 'number') dados[campo.name] = campo.value === '' ? '' : Number(campo.value);
      else dados[campo.name] = campo.value.trim();
    });
    return dados;
  }

  const nomeCliente = (id) => {
    const c = D.obter('clientes', id);
    return c ? c.nome : 'Órgão removido';
  };
  const ufCliente = (id) => {
    const c = D.obter('clientes', id);
    return c ? c.uf || '' : '';
  };

  function seloVigencia(s) {
    const mapa = {
      vigente: ['ok', 'Vigente'],
      vencendo: ['alerta', s.diasParaFimVigencia === 0 ? 'Vence hoje' : 'Vence em ' + s.diasParaFimVigencia + ' dias'],
      encerrada: ['', 'Encerrada'],
      cancelado: ['critico', 'Cancelado'],
      'sem data': ['', 'Sem vigência']
    };
    const [cls, txt] = mapa[s.vigencia] || ['', s.vigencia];
    return '<span class="selo ' + cls + '">' + esc(txt) + '</span>';
  }

  const FORMAS_VENDA = [['integral', 'Integral (pagamento único)'], ['mensal', 'Mensal'], ['parcelado', 'Parcelado']];
  const FORMAS_COMPRA = [['avista', 'À vista'], ['parcelado', 'Parcelado']];
  const nomeForma = (f) => ({ integral: 'Integral', mensal: 'Mensal', parcelado: 'Parcelado', avista: 'À vista' }[f] || f || '—');

  GAH.u = { esc, moeda, moedaCurta, dataBR, mesBR, pct, MESES, MESES_CURTOS, UFS, opcoes, linkWhats, linkSeguro, soDigitos, aviso, janela, botaoExcluir, lerForm, nomeCliente, ufCliente, seloVigencia, nomeForma, ICONE_DRIVE, LOGO };

  /* ---------- formulário de órgão (cliente) ---------- */
  const TIPOS_ORGAO = ['Prefeitura', 'Câmara Municipal', 'Secretaria / Governo estadual', 'Autarquia / Fundação', 'Empresa pública', 'Conselho profissional', 'Órgão federal', 'Outro'];

  function linhaContato(c, i) {
    c = c || {};
    return (
      '<div class="form-grade contato-linha" data-i="' + i + '" style="border:1px solid var(--linha);border-radius:8px;padding:10px">' +
      '<div class="campo"><label>Nome</label><input data-c="nome" value="' + esc(c.nome) + '"></div>' +
      '<div class="campo"><label>Cargo / setor</label><input data-c="cargo" value="' + esc(c.cargo) + '"></div>' +
      '<div class="campo"><label>Telefone / WhatsApp</label><input data-c="telefone" inputmode="tel" value="' + esc(c.telefone) + '"></div>' +
      '<div class="campo"><label>E-mail</label><input data-c="email" type="email" value="' + esc(c.email) + '"></div>' +
      '<div class="largo"><button type="button" class="link-botao" data-remover-contato>Remover contato</button></div>' +
      '</div>'
    );
  }

  GAH.formCliente = function (cliente, aoSalvar) {
    const c = cliente || { contatos: [{}] };
    const corpo =
      '<form id="form-cliente" class="form-secao" style="border:0;padding:0">' +
      '<div class="form-grade">' +
      '<div class="campo largo"><label for="cli-nome">Nome do órgão *</label><input id="cli-nome" name="nome" required value="' + esc(c.nome) + '" placeholder="Ex.: Prefeitura Municipal de Concórdia"></div>' +
      '<div class="campo"><label for="cli-sigla">Sigla / nome curto</label><input id="cli-sigla" name="sigla" value="' + esc(c.sigla) + '"></div>' +
      '<div class="campo"><label for="cli-tipo">Tipo</label><select id="cli-tipo" name="tipo">' + opcoes(TIPOS_ORGAO, c.tipo, 'Selecione') + '</select></div>' +
      '<div class="campo"><label for="cli-cnpj">CNPJ</label><input id="cli-cnpj" name="cnpj" value="' + esc(c.cnpj) + '"></div>' +
      '<div class="campo"><label for="cli-cidade">Cidade</label><input id="cli-cidade" name="cidade" value="' + esc(c.cidade) + '"></div>' +
      '<div class="campo"><label for="cli-uf">Estado</label><select id="cli-uf" name="uf">' + opcoes(UFS, c.uf, 'UF') + '</select></div>' +
      '<div class="campo largo"><label for="cli-endereco">Endereço</label><input id="cli-endereco" name="endereco" value="' + esc(c.endereco) + '"></div>' +
      '<div class="campo largo"><label for="cli-drive">Link da pasta no Google Drive</label><input id="cli-drive" name="linkDrive" type="url" value="' + esc(c.linkDrive) + '" placeholder="https://drive.google.com/drive/folders/..."><span class="ajuda">No Drive, clique com o botão direito na pasta do órgão → Compartilhar → Copiar link.</span></div>' +
      '</div>' +
      '<h3 style="margin-top:8px">Faturamento: para onde vai a nota fiscal</h3>' +
      '<div class="form-grade">' +
      '<div class="campo"><label for="cli-fat-email">E-mail para envio da NF</label><input id="cli-fat-email" name="fatEmail" type="email" value="' + esc((c.faturamento || {}).email) + '"></div>' +
      '<div class="campo"><label for="cli-fat-resp">Responsável pelo faturamento / pagamento</label><input id="cli-fat-resp" name="fatResponsavel" value="' + esc((c.faturamento || {}).responsavel) + '"></div>' +
      '<div class="campo"><label for="cli-fat-tel">Telefone do faturamento</label><input id="cli-fat-tel" name="fatTelefone" inputmode="tel" value="' + esc((c.faturamento || {}).telefone) + '"></div>' +
      '<div class="campo"><label for="cli-fat-portal">Portal / sistema para enviar a NF</label><input id="cli-fat-portal" name="fatPortal" value="' + esc((c.faturamento || {}).portal) + '" placeholder="Ex.: e-mail, SEI, 1Doc, protocolo"></div>' +
      '<div class="campo largo"><label for="cli-fat-inst">O que precisa constar na NF</label><textarea id="cli-fat-inst" name="fatInstrucoes" placeholder="Ex.: nº do contrato e da nota de empenho, dados bancários">' + esc((c.faturamento || {}).instrucoes) + '</textarea></div>' +
      '</div>' +
      '<h3 style="margin-top:8px">Contatos no órgão</h3>' +
      '<div class="contatos" id="lista-contatos">' + (c.contatos && c.contatos.length ? c.contatos : [{}]).map(linhaContato).join('') + '</div>' +
      '<div><button type="button" class="botao secundario pequeno" id="add-contato">+ Adicionar contato</button></div>' +
      '<div class="campo"><label for="cli-obs">Observações</label><textarea id="cli-obs" name="observacoes">' + esc(c.observacoes) + '</textarea></div>' +
      '</form>';
    const rodape =
      (c.id ? '<button type="button" class="botao perigo" id="excluir-cliente">Excluir órgão</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-cliente" class="botao">Salvar</button></div>';
    const j = janela({ titulo: c.id ? 'Editar órgão' : 'Novo órgão', corpo, rodape });
    const form = j.el.querySelector('#form-cliente');
    const lista = j.el.querySelector('#lista-contatos');
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    j.el.querySelector('#add-contato').addEventListener('click', () => {
      lista.insertAdjacentHTML('beforeend', linhaContato({}, lista.children.length));
    });
    lista.addEventListener('click', (e) => {
      if (e.target.matches('[data-remover-contato]')) e.target.closest('.contato-linha').remove();
    });
    botaoExcluir(j.el, '#excluir-cliente', 'Excluir este órgão?', async () => {
      const temContratos = D.lista('contratos').some((x) => x.clienteId === c.id);
      if (temContratos) {
        aviso('Este órgão tem contratos. Exclua os contratos antes de excluir o órgão.', true);
        return;
      }
      await D.excluir('clientes', c.id);
      j.fechar();
      aviso('Órgão excluído');
      location.hash = '#/clientes';
    });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = lerForm(form);
      dados.faturamento = { email: dados.fatEmail, responsavel: dados.fatResponsavel, telefone: dados.fatTelefone, portal: dados.fatPortal, instrucoes: dados.fatInstrucoes };
      ['fatEmail', 'fatResponsavel', 'fatTelefone', 'fatPortal', 'fatInstrucoes'].forEach((k) => delete dados[k]);
      dados.contatos = [...lista.querySelectorAll('.contato-linha')]
        .map((l) => {
          const o = {};
          l.querySelectorAll('[data-c]').forEach((i) => (o[i.dataset.c] = i.value.trim()));
          return o;
        })
        .filter((o) => o.nome || o.telefone || o.email);
      try {
        const salvo = await D.salvar('clientes', Object.assign({}, c, dados));
        j.fechar();
        aviso('Órgão salvo');
        if (aoSalvar) aoSalvar(salvo);
      } catch (erro) {
        aviso('Não foi possível salvar: ' + erro.message, true);
      }
    });
  };

  /* ---------- formulário de contrato ---------- */
  const MODALIDADES = ['Dispensa de licitação', 'Pregão eletrônico', 'Adesão a ata (carona)', 'Inexigibilidade', 'Concorrência', 'Outra'];

  /* Recria as parcelas mantendo o que já foi marcado como pago, NF e emissão, pela posição. */
  function refazerParcelas(antigas, total, n, primeiro) {
    const novas = calc.gerarParcelas(total, n, primeiro);
    (antigas || []).forEach((a, i) => {
      if (!novas[i]) return;
      ['pago', 'dataPagamento', 'nf', 'emissao'].forEach((k) => {
        if (a[k] !== undefined) novas[i][k] = a[k];
      });
    });
    return novas;
  }

  GAH.formContrato = function (contrato, opcoesForm) {
    opcoesForm = opcoesForm || {};
    const cfg = D.configuracao();
    const hoje = calc.hoje();
    const c = contrato || {
      clienteId: opcoesForm.clienteId || '',
      status: 'ativo',
      produto: opcoesForm.produto || '',
      venda: { forma: 'integral', qtdParcelas: 1, aliquotaNF: cfg.aliquotaNF, valorTotal: opcoesForm.valor || '', primeiroVencimento: calc.addDias(hoje, 30) },
      compra: { forma: 'avista', qtdParcelas: 1, aliquotaCompra: cfg.aliquotaCompra, valorTotal: '', primeiroVencimento: hoje },
      vigenciaInicio: hoje,
      vigenciaFim: calc.addDias(calc.addMeses(hoje, 12), -1)
    };
    const v = c.venda || {};
    const k = c.compra || {};
    const qtdV = v.qtdParcelas || (v.parcelas && v.parcelas.length) || 1;
    const qtdK = k.qtdParcelas || (k.parcelas && k.parcelas.length) || 1;
    const valorVendaCampo = v.forma === 'mensal' && qtdV ? calc.centavos(calc.num(v.valorTotal) / qtdV) : v.valorTotal;
    const clientes = D.lista('clientes').slice().sort((a, b) => a.nome.localeCompare(b.nome));
    const produtos = [...new Set(D.lista('contratos').map((x) => x.produto).filter(Boolean))].sort();
    const fornecedores = [...new Set(D.lista('contratos').map((x) => x.fornecedor).filter(Boolean))].sort();

    const corpo =
      '<form id="form-contrato">' +
      '<div class="form-secao"><h3>Contrato</h3><div class="form-grade">' +
      '<div class="campo largo"><label for="ct-cliente">Órgão *</label><select id="ct-cliente" name="clienteId" required>' + opcoes(clientes.map((x) => [x.id, x.nome + (x.uf ? ' — ' + x.uf : '')]), c.clienteId, 'Selecione o órgão') + '</select></div>' +
      '<div class="campo"><label for="ct-produto">Licença / produto *</label><input id="ct-produto" name="produto" list="lista-produtos" required value="' + esc(c.produto) + '" placeholder="Ex.: ChatGPT Business"><datalist id="lista-produtos">' + produtos.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="campo"><label for="ct-fornecedor">Fabricante / marca</label><input id="ct-fornecedor" name="fornecedor" list="lista-fornecedores" value="' + esc(c.fornecedor) + '" placeholder="Ex.: OpenAI"><datalist id="lista-fornecedores">' + fornecedores.map((p) => '<option value="' + esc(p) + '">').join('') + '</datalist></div>' +
      '<div class="campo"><label for="ct-qtd">Quantidade de licenças</label><input id="ct-qtd" name="quantidade" type="number" min="0" value="' + esc(c.quantidade) + '"></div>' +
      '<div class="campo"><label for="ct-modalidade">Modalidade</label><select id="ct-modalidade" name="modalidade">' + opcoes(MODALIDADES, c.modalidade, 'Selecione') + '</select></div>' +
      '<div class="campo"><label for="ct-numero">Nº do contrato / processo</label><input id="ct-numero" name="numeroContrato" value="' + esc(c.numeroContrato) + '"></div>' +
      '<div class="campo"><label for="ct-empenho">Nº da nota de empenho</label><input id="ct-empenho" name="numeroEmpenho" value="' + esc(c.numeroEmpenho) + '"></div>' +
      '<div class="campo"><label for="ct-dataempenho">Recebimento da NE</label><input id="ct-dataempenho" name="dataEmpenho" type="date" value="' + esc(c.dataEmpenho) + '"></div>' +
      '<div class="campo"><label for="ct-entrega">Entrega da licença</label><input id="ct-entrega" name="dataEntrega" type="date" value="' + esc(c.dataEntrega) + '"></div>' +
      '<div class="campo"><label for="ct-vini">Início da vigência</label><input id="ct-vini" name="vigenciaInicio" type="date" value="' + esc(c.vigenciaInicio) + '"></div>' +
      '<div class="campo"><label for="ct-vfim">Fim da vigência</label><input id="ct-vfim" name="vigenciaFim" type="date" value="' + esc(c.vigenciaFim) + '"></div>' +
      '<div class="campo"><label for="ct-status">Situação</label><select id="ct-status" name="status">' + opcoes([['ativo', 'Ativo'], ['encerrado', 'Encerrado'], ['cancelado', 'Cancelado']], c.status) + '</select></div>' +
      '<div class="campo largo"><label for="ct-drive">Link no Drive deste contrato (opcional)</label><input id="ct-drive" name="linkDrive" type="url" value="' + esc(c.linkDrive) + '" placeholder="Se vazio, usa a pasta do órgão"></div>' +
      '</div></div>' +

      '<div class="form-secao"><h3>Venda ao órgão (recebimento)</h3><div class="form-grade" data-ignorar>' +
      '<div class="campo"><label for="v-forma">Forma de recebimento</label><select id="v-forma">' + opcoes(FORMAS_VENDA, v.forma) + '</select></div>' +
      '<div class="campo"><label for="v-valor" id="v-valor-rotulo">Valor de venda</label><input id="v-valor" type="number" step="0.01" min="0" value="' + esc(valorVendaCampo) + '"></div>' +
      '<div class="campo" id="v-qtd-campo"><label for="v-qtd" id="v-qtd-rotulo">Nº de parcelas</label><input id="v-qtd" type="number" min="1" max="120" value="' + esc(qtdV) + '"></div>' +
      '<div class="campo"><label for="v-venc">1º vencimento</label><input id="v-venc" type="date" value="' + esc(v.primeiroVencimento || (v.parcelas && v.parcelas[0] && v.parcelas[0].vencimento) || '') + '"></div>' +
      '<div class="campo"><label for="v-aliq">Imposto da NF (%)</label><input id="v-aliq" type="number" step="0.01" min="0" value="' + esc(v.aliquotaNF) + '"></div>' +
      '</div></div>' +

      '<div class="form-secao"><h3>Compra da licença (pagamento ao fornecedor)</h3><div class="form-grade" data-ignorar>' +
      '<div class="campo"><label for="k-forma">Forma de pagamento</label><select id="k-forma">' + opcoes(FORMAS_COMPRA, k.forma) + '</select></div>' +
      '<div class="campo"><label for="k-valor">Valor total pago na compra</label><input id="k-valor" type="number" step="0.01" min="0" value="' + esc(k.valorTotal) + '"></div>' +
      '<div class="campo" id="k-qtd-campo"><label for="k-qtd">Nº de parcelas</label><input id="k-qtd" type="number" min="1" max="120" value="' + esc(qtdK) + '"></div>' +
      '<div class="campo"><label for="k-venc">1º pagamento</label><input id="k-venc" type="date" value="' + esc(k.primeiroVencimento || (k.parcelas && k.parcelas[0] && k.parcelas[0].vencimento) || '') + '"></div>' +
      '<div class="campo"><label for="k-aliq">Imposto na compra (%)</label><input id="k-aliq" type="number" step="0.01" min="0" value="' + esc(k.aliquotaCompra) + '"><span class="ajuda">IOF, câmbio ou outro custo sobre a compra.</span></div>' +
      '</div></div>' +
      '<div class="previa" id="previa-contrato"></div>' +
      '<div class="campo" style="margin-top:12px"><label for="ct-obs">Observações</label><textarea id="ct-obs" name="observacoes">' + esc(c.observacoes) + '</textarea></div>' +
      '</form>';
    const rodape =
      (c.id ? '<button type="button" class="botao perigo" id="excluir-contrato">Excluir contrato</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-contrato" class="botao">Salvar contrato</button></div>';
    const j = janela({ titulo: c.id ? 'Editar contrato' : 'Novo contrato', corpo, rodape });
    const $ = (s) => j.el.querySelector(s);
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);

    function termos() {
      const formaV = $('#v-forma').value;
      const qV = formaV === 'integral' ? 1 : Math.max(1, Number($('#v-qtd').value) || 1);
      const valorV = Number($('#v-valor').value) || 0;
      const totalV = formaV === 'mensal' ? calc.centavos(valorV * qV) : valorV;
      const formaK = $('#k-forma').value;
      const qK = formaK === 'avista' ? 1 : Math.max(1, Number($('#k-qtd').value) || 1);
      return {
        formaV, qV, totalV, vencV: $('#v-venc').value, aliqV: Number($('#v-aliq').value) || 0,
        formaK, qK, totalK: Number($('#k-valor').value) || 0, vencK: $('#k-venc').value, aliqK: Number($('#k-aliq').value) || 0
      };
    }
    function atualizar() {
      const t = termos();
      $('#v-qtd-campo').hidden = t.formaV === 'integral';
      $('#k-qtd-campo').hidden = t.formaK === 'avista';
      $('#v-valor-rotulo').textContent = t.formaV === 'mensal' ? 'Valor por mês' : 'Valor total de venda';
      $('#v-qtd-rotulo').textContent = t.formaV === 'mensal' ? 'Quantidade de meses' : 'Nº de parcelas';
      const impV = (t.totalV * t.aliqV) / 100;
      const impK = (t.totalK * t.aliqK) / 100;
      const lucro = t.totalV - t.totalK - impV - impK;
      $('#previa-contrato').innerHTML =
        '<span>Venda total: <b>' + moeda(t.totalV) + '</b>' + (t.qV > 1 ? ' (' + t.qV + '× ' + moeda(t.totalV / t.qV) + ')' : '') + '</span>' +
        '<span>Compra: <b>' + moeda(t.totalK) + '</b>' + (t.qK > 1 ? ' (' + t.qK + '×)' : '') + '</span>' +
        '<span>Impostos: <b>' + moeda(impV + impK) + '</b></span>' +
        '<span>Lucro: <b class="' + (lucro >= 0 ? 'positivo' : 'negativo') + '">' + moeda(lucro) + '</b>' + (t.totalV ? ' (' + pct(lucro / t.totalV) + ')' : '') + '</span>';
    }
    j.el.querySelector('form').addEventListener('input', atualizar);
    atualizar();

    botaoExcluir(j.el, '#excluir-contrato', 'Excluir este contrato e todas as parcelas?', async () => {
      await D.excluir('contratos', c.id);
      j.fechar();
      aviso('Contrato excluído');
    });

    $('#form-contrato').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = lerForm($('#form-contrato'));
      const t = termos();
      const vAnt = c.venda || {};
      const kAnt = c.compra || {};
      const mudouV = !vAnt.parcelas || !vAnt.parcelas.length || vAnt.forma !== t.formaV || calc.num(vAnt.valorTotal) !== t.totalV || (vAnt.qtdParcelas || vAnt.parcelas.length) !== t.qV || (vAnt.primeiroVencimento || '') !== t.vencV;
      const mudouK = !kAnt.parcelas || !kAnt.parcelas.length || kAnt.forma !== t.formaK || calc.num(kAnt.valorTotal) !== t.totalK || (kAnt.qtdParcelas || kAnt.parcelas.length) !== t.qK || (kAnt.primeiroVencimento || '') !== t.vencK;
      const venda = Object.assign({}, vAnt, { forma: t.formaV, valorTotal: t.totalV, qtdParcelas: t.qV, primeiroVencimento: t.vencV, aliquotaNF: t.aliqV });
      const compra = Object.assign({}, kAnt, { forma: t.formaK, valorTotal: t.totalK, qtdParcelas: t.qK, primeiroVencimento: t.vencK, aliquotaCompra: t.aliqK });
      if (mudouV) venda.parcelas = refazerParcelas(vAnt.parcelas, t.totalV, t.qV, t.vencV || dados.dataEntrega || hoje);
      if (mudouK) compra.parcelas = refazerParcelas(kAnt.parcelas, t.totalK, t.qK, t.vencK || dados.dataEntrega || hoje);
      try {
        const salvo = await D.salvar('contratos', Object.assign({}, c, dados, { venda, compra }));
        j.fechar();
        aviso('Contrato salvo');
        if (opcoesForm.aoSalvar) opcoesForm.aoSalvar(salvo);
      } catch (erro) {
        aviso('Não foi possível salvar: ' + erro.message, true);
      }
    });
  };

  /* ---------- edição detalhada das parcelas ---------- */
  GAH.formParcelas = function (contrato, lado) {
    const ehVenda = lado === 'venda';
    const parcelas = JSON.parse(JSON.stringify((contrato[lado] && contrato[lado].parcelas) || []));
    const linha = (p, i) =>
      '<tr data-i="' + i + '">' +
      '<td>' + (i + 1) + '</td>' +
      '<td><input class="mini" data-k="valor" type="number" step="0.01" value="' + esc(p.valor) + '" aria-label="Valor"></td>' +
      '<td><input class="mini" data-k="vencimento" type="date" value="' + esc(p.vencimento) + '" aria-label="Vencimento"></td>' +
      (ehVenda
        ? '<td><input class="mini" data-k="emissao" type="date" value="' + esc(p.emissao) + '" aria-label="Emissão da NF"></td><td><input class="mini" data-k="nf" value="' + esc(p.nf) + '" style="min-width:60px" aria-label="Nº NF"></td>'
        : '') +
      '<td><input data-k="pago" type="checkbox"' + (p.pago ? ' checked' : '') + ' aria-label="Pago"></td>' +
      '<td><input class="mini" data-k="dataPagamento" type="date" value="' + esc(p.dataPagamento) + '" aria-label="Data do pagamento"></td>' +
      '<td><button type="button" class="link-botao" data-remover>remover</button></td></tr>';
    const corpo =
      '<p class="texto-suave" style="margin:0">' + esc(nomeCliente(contrato.clienteId)) + ' · ' + esc(contrato.produto) + '</p>' +
      '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>#</th><th>Valor</th><th>Vencimento</th>' +
      (ehVenda ? '<th>Emissão NF</th><th>Nº NF</th>' : '') +
      '<th>' + (ehVenda ? 'Recebido' : 'Pago') + '</th><th>Data</th><th></th></tr></thead><tbody id="corpo-parcelas">' +
      parcelas.map(linha).join('') +
      '</tbody></table></div>' +
      '<div><button type="button" class="botao secundario pequeno" id="add-parcela">+ Adicionar parcela</button></div>' +
      '<div class="previa" id="soma-parcelas"></div>';
    const rodape = '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="button" class="botao" id="salvar-parcelas">Salvar parcelas</button></div>';
    const j = janela({ titulo: ehVenda ? 'Parcelas a receber do órgão' : 'Parcelas da compra', corpo, rodape });
    const tbody = j.el.querySelector('#corpo-parcelas');
    const ler = () =>
      [...tbody.querySelectorAll('tr')].map((tr, i) => {
        const p = { num: i + 1 };
        tr.querySelectorAll('[data-k]').forEach((inp) => {
          p[inp.dataset.k] = inp.type === 'checkbox' ? inp.checked : inp.type === 'number' ? Number(inp.value) || 0 : inp.value;
        });
        return p;
      });
    const somar = () => {
      const ps = ler();
      const total = ps.reduce((s, p) => s + p.valor, 0);
      const pagas = ps.filter((p) => p.pago).reduce((s, p) => s + p.valor, 0);
      j.el.querySelector('#soma-parcelas').innerHTML =
        '<span>Total: <b>' + moeda(total) + '</b></span><span>' + (ehVenda ? 'Recebido' : 'Pago') + ': <b>' + moeda(pagas) + '</b></span><span>Em aberto: <b>' + moeda(total - pagas) + '</b></span>';
    };
    somar();
    tbody.addEventListener('input', somar);
    tbody.addEventListener('change', (e) => {
      if (e.target.dataset.k === 'pago' && e.target.checked) {
        const data = e.target.closest('tr').querySelector('[data-k="dataPagamento"]');
        if (!data.value) data.value = calc.hoje();
      }
      somar();
    });
    tbody.addEventListener('click', (e) => {
      if (e.target.matches('[data-remover]')) {
        e.target.closest('tr').remove();
        somar();
      }
    });
    j.el.querySelector('#add-parcela').addEventListener('click', () => {
      const ps = ler();
      const ultima = ps[ps.length - 1];
      tbody.insertAdjacentHTML('beforeend', linha({ valor: ultima ? ultima.valor : 0, vencimento: ultima ? calc.addMeses(ultima.vencimento, 1) : calc.hoje() }, ps.length));
      somar();
    });
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    j.el.querySelector('#salvar-parcelas').addEventListener('click', async () => {
      const ps = ler();
      const ladoNovo = Object.assign({}, contrato[lado], {
        parcelas: ps,
        valorTotal: calc.centavos(ps.reduce((s, p) => s + p.valor, 0)),
        qtdParcelas: ps.length,
        primeiroVencimento: ps[0] ? ps[0].vencimento : ''
      });
      await D.salvar('contratos', Object.assign({}, contrato, { [lado]: ladoNovo }));
      j.fechar();
      aviso('Parcelas salvas');
    });
  };

  /* Marca/desmarca uma parcela direto da lista. */
  GAH.alternarParcela = async function (contratoId, lado, indice, pago) {
    const c = D.obter('contratos', contratoId);
    if (!c) return;
    const copia = JSON.parse(JSON.stringify(c));
    const p = copia[lado].parcelas[indice];
    p.pago = pago;
    p.dataPagamento = pago ? p.dataPagamento || calc.hoje() : '';
    await D.salvar('contratos', copia);
    aviso(pago ? (lado === 'venda' ? 'Parcela marcada como recebida' : 'Parcela marcada como paga') : 'Parcela reaberta');
  };

  /* ---------- bloco de contrato (usado em Clientes e Contratos) ---------- */
  function tabelaParcelas(c, lado) {
    const ehVenda = lado === 'venda';
    const parcelas = (c[lado] && c[lado].parcelas) || [];
    if (!parcelas.length) return '<p class="texto-suave" style="margin:0">Sem parcelas.</p>';
    const hoje = calc.hoje();
    return (
      '<div class="tabela-rolagem"><table class="tabela"><thead><tr><th>#</th><th>Vencimento</th>' + (ehVenda ? '<th>NF</th>' : '') + '<th class="valor">Valor</th><th>' + (ehVenda ? 'Recebida' : 'Paga') + '</th></tr></thead><tbody>' +
      parcelas
        .map((p, i) => {
          const atrasada = !p.pago && p.vencimento && p.vencimento < hoje;
          return (
            '<tr><td>' + (i + 1) + '</td><td>' + dataBR(p.vencimento) + (atrasada ? ' <span class="selo critico">atrasada</span>' : '') + '</td>' +
            (ehVenda ? '<td>' + esc(p.nf || '—') + '</td>' : '') +
            '<td class="valor">' + moeda(p.valor) + '</td>' +
            '<td><label class="parcela-check"><input type="checkbox" data-parcela="' + esc(c.id) + '|' + lado + '|' + i + '"' + (p.pago ? ' checked' : '') + '> ' + (p.pago ? (p.dataPagamento ? dataBR(p.dataPagamento).slice(0, 6) + p.dataPagamento.slice(2, 4) : 'sim') : 'aberta') + '</label></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>'
    );
  }

  GAH.blocoContrato = function (c, opcoesBloco) {
    opcoesBloco = opcoesBloco || {};
    const s = calc.resumoContrato(c);
    const cli = D.obter('clientes', c.clienteId);
    const drive = linkSeguro(c.linkDrive) || (cli && linkSeguro(cli.linkDrive));
    const percRec = s.venda ? Math.min(100, (s.recebido / s.venda) * 100) : 0;
    const percPag = s.compra ? Math.min(100, (s.pago / s.compra) * 100) : 0;
    const prazo = [c.vigenciaInicio || c.vigenciaFim ? 'Vigência ' + dataBR(c.vigenciaInicio) + ' a ' + dataBR(c.vigenciaFim) : '', c.dataEntrega ? 'Licença entregue em ' + dataBR(c.dataEntrega) : '', c.numeroContrato ? 'Contrato ' + esc(c.numeroContrato) : '', c.numeroEmpenho ? 'NE ' + esc(c.numeroEmpenho) : '']
      .filter(Boolean)
      .join(' · ');
    return (
      '<article class="contrato-bloco" id="contrato-' + esc(c.id) + '">' +
      '<div class="contrato-topo"><div>' +
      (opcoesBloco.mostrarOrgao ? '<div class="sub"><a href="#/clientes/' + esc(c.clienteId) + '">' + esc(nomeCliente(c.clienteId)) + '</a></div>' : '') +
      '<h3>' + esc(c.produto || 'Licença') + (c.quantidade ? ' <span class="texto-suave" style="font-size:.85rem;font-family:var(--fonte-texto)">· ' + esc(c.quantidade) + ' licença(s)</span>' : '') + '</h3>' +
      '<div class="sub">' + [esc(c.fornecedor), esc(c.modalidade)].filter(Boolean).join(' · ') + '</div>' +
      '<div class="sub">' + prazo + '</div>' +
      '</div><div class="acoes">' + seloVigencia(s) +
      (drive ? '<a class="botao secundario pequeno" href="' + esc(drive) + '" target="_blank" rel="noopener">Abrir no Drive</a>' : '') +
      '<button type="button" class="botao secundario pequeno" data-editar-contrato="' + esc(c.id) + '">Editar</button></div></div>' +
      '<div class="lados">' +
      '<section class="lado"><h4>Recebimento do órgão <span class="selo info">' + nomeForma(c.venda && c.venda.forma) + '</span></h4>' +
      '<div class="mini-numeros"><div><span>Valor de venda</span><b>' + moeda(s.venda) + '</b></div><div><span>Recebido</span><b>' + moeda(s.recebido) + '</b></div><div><span>A receber</span><b>' + moeda(s.aReceber) + '</b></div></div>' +
      '<div class="progresso" title="' + Math.round(percRec) + '% recebido"><i style="width:' + percRec + '%"></i></div>' +
      '<div class="texto-suave" style="font-size:.85rem">' + s.parcelasRecebidas + ' de ' + s.totalParcelasVenda + ' parcela(s) recebida(s)' + (s.parcelasReceber ? ' · faltam ' + s.parcelasReceber : '') + (s.parcelasAtrasadas ? ' · <b class="negativo">' + s.parcelasAtrasadas + ' em atraso</b>' : '') + '</div>' +
      '<details data-chave="' + esc(c.id) + '-venda"><summary>Ver parcelas</summary>' + tabelaParcelas(c, 'venda') + '<p style="margin:8px 0 0"><button type="button" class="link-botao" data-editar-parcelas="' + esc(c.id) + '|venda">Editar valores, datas e NFs</button></p></details>' +
      '</section>' +
      '<section class="lado"><h4>Compra da licença <span class="selo info">' + nomeForma(c.compra && c.compra.forma) + '</span></h4>' +
      '<div class="mini-numeros"><div><span>Valor de compra</span><b>' + moeda(s.compra) + '</b></div><div><span>Pago</span><b>' + moeda(s.pago) + '</b></div><div><span>Falta pagar</span><b>' + moeda(s.aPagar) + '</b></div></div>' +
      '<div class="progresso" title="' + Math.round(percPag) + '% pago"><i style="width:' + percPag + '%;background:var(--navy-suave)"></i></div>' +
      '<div class="texto-suave" style="font-size:.85rem">' + s.parcelasPagas + ' de ' + s.totalParcelasCompra + ' parcela(s) paga(s)' + (s.parcelasPagar ? ' · faltam ' + s.parcelasPagar : '') + '</div>' +
      '<details data-chave="' + esc(c.id) + '-compra"><summary>Ver parcelas</summary>' + tabelaParcelas(c, 'compra') + '<p style="margin:8px 0 0"><button type="button" class="link-botao" data-editar-parcelas="' + esc(c.id) + '|compra">Editar valores e datas</button></p></details>' +
      '</section></div>' +
      '<div class="resultado"><span>Imposto NF (' + (calc.num(c.venda && c.venda.aliquotaNF)).toLocaleString('pt-BR') + '%): <b>' + moeda(s.impostoNF) + '</b></span>' +
      (s.impostoCompra ? '<span>Imposto compra (' + calc.num(c.compra.aliquotaCompra).toLocaleString('pt-BR') + '%): <b>' + moeda(s.impostoCompra) + '</b></span>' : '') +
      '<span>Lucro: <b class="' + (s.lucro >= 0 ? 'positivo' : 'negativo') + '">' + moeda(s.lucro) + '</b> (' + pct(s.margem) + ')</span>' +
      (c.observacoes ? '<span style="flex-basis:100%">Obs.: ' + esc(c.observacoes) + '</span>' : '') +
      '</div></article>'
    );
  };

  /* Liga os botões de um bloco de contrato. */
  GAH.ligarContratos = function (raiz) {
    raiz.addEventListener('click', (e) => {
      const ed = e.target.closest('[data-editar-contrato]');
      if (ed) GAH.formContrato(D.obter('contratos', ed.dataset.editarContrato));
      const ep = e.target.closest('[data-editar-parcelas]');
      if (ep) {
        const [id, lado] = ep.dataset.editarParcelas.split('|');
        GAH.formParcelas(D.obter('contratos', id), lado);
      }
    });
    raiz.addEventListener('change', (e) => {
      const p = e.target.closest('[data-parcela]');
      if (p) {
        const [id, lado, i] = p.dataset.parcela.split('|');
        GAH.alternarParcela(id, lado, Number(i), p.checked);
      }
    });
  };

  /* Despesas lançadas + custos fixos + mensalidades do contador, até o mês informado (AAAA-MM). */
  GAH.despesasCompletas = function (ateMes) {
    return D.lista('despesas').concat(calc.custosNoPeriodo(D.lista('custos'), D.lista('contabilidade'), ateMes || calc.mesDe(calc.hoje())));
  };

  /* ---------- eventos automáticos (vencimentos, renovações, disputas) ---------- */
  GAH.eventosAutomaticos = function () {
    const ev = [];
    for (const c of D.lista('contratos')) {
      if (c.status === 'cancelado') continue;
      const orgao = nomeCliente(c.clienteId);
      ((c.venda && c.venda.parcelas) || []).forEach((p, i) => {
        if (!p.pago && p.vencimento) ev.push({ data: p.vencimento, tipo: 'receber', titulo: 'Receber ' + moeda(p.valor) + ' — ' + orgao, detalhe: c.produto + ' · parcela ' + (i + 1) + '/' + c.venda.parcelas.length, link: '#/clientes/' + c.clienteId, valor: p.valor });
      });
      ((c.compra && c.compra.parcelas) || []).forEach((p, i) => {
        if (!p.pago && p.vencimento) ev.push({ data: p.vencimento, tipo: 'pagar', titulo: 'Pagar ' + moeda(p.valor) + ' — ' + (c.fornecedor || c.produto), detalhe: orgao + ' · parcela ' + (i + 1) + '/' + c.compra.parcelas.length, link: '#/clientes/' + c.clienteId, valor: p.valor });
      });
      if (c.vigenciaFim && c.status !== 'encerrado') ev.push({ data: c.vigenciaFim, tipo: 'renovacao', titulo: 'Fim da vigência — ' + orgao, detalhe: c.produto + ' · hora de negociar a renovação', link: '#/clientes/' + c.clienteId });
    }
    const ateProximoMes = calc.mesDe(calc.addMeses(calc.mesDe(calc.hoje()) + '-01', 1));
    for (const k of calc.custosNoPeriodo(D.lista('custos'), D.lista('contabilidade'), ateProximoMes)) {
      if (!k.pago) ev.push({ data: k.data, tipo: 'pagar', titulo: 'Pagar ' + moeda(k.valor) + ' — ' + k.descricao, detalhe: k.categoria, link: k.origem === 'custos' ? '#/custos' : '#/contabilidade', valor: k.valor });
    }
    for (const l of D.lista('licitacoes')) {
      if (l.dataDisputa && ['analise', 'proposta', 'disputa'].includes(l.status)) ev.push({ data: l.dataDisputa, hora: l.horaDisputa, tipo: 'disputa', titulo: 'Disputa — ' + (l.orgao || 'licitação'), detalhe: [l.numeroEdital, l.portal].filter(Boolean).join(' · '), link: '#/licitacoes' });
    }
    return ev;
  };

  /* ---------- telas e navegação ---------- */
  const MENU = [
    ['inicio', 'Início'],
    ['clientes', 'Clientes'],
    ['contratos', 'Contratos'],
    ['agenda', 'Agenda'],
    ['licitacoes', 'Licitações'],
    ['despesas', 'Despesas'],
    ['custos', 'Custos'],
    ['contabilidade', 'Contabilidade'],
    ['bancos', 'Contas bancárias']
  ];
  let usuarioAtual = null;

  function topo() {
    return (
      '<header class="topo"><div class="topo-interno">' +
      '<a class="marca" href="#/inicio" aria-label="GAH Licita, ir para o início">' + LOGO + '</a>' +
      '<nav class="menu" id="menu">' + MENU.map(([id, nome]) => '<a href="#/' + id + '" data-menu="' + id + '">' + nome + '</a>').join('') + '</nav>' +
      '<div class="topo-usuario"><a class="botao-topo" href="#/ajustes" data-menu="ajustes">Ajustes</a><button type="button" class="botao-topo" id="sair">Sair</button></div>' +
      '<button type="button" class="menu-abrir" id="menu-abrir" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu"><span></span><span></span><span></span></button>' +
      '</div></header>'
    );
  }

  function telaLogin() {
    const app = document.getElementById('app');
    document.body.className = 'tela-login';
    app.innerHTML =
      '<div class="login-centro"><div class="login-coluna"><div class="logo-caixa"><img class="logo-login" src="img/logo-gah.png" width="900" height="829" alt="GAH Licita"></div><form class="cartao-login" id="form-login" aria-label="Entrar no sistema" novalidate>' +
      (D.modoDemo() ? '<div class="nota-demo">Modo demonstração: os dados ficam só neste navegador. Digite qualquer e-mail e senha para entrar.</div>' : '') +
      '<div class="campo"><label for="login-email">E-mail</label><input id="login-email" type="email" autocomplete="username" required></div>' +
      '<div class="campo"><label for="login-senha">Senha</label><input id="login-senha" type="password" autocomplete="current-password" required></div>' +
      '<div class="erro" id="login-erro" role="alert"></div>' +
      '<button class="botao" type="submit" id="login-entrar">Entrar</button>' +
      '<div class="rodape-login"><button type="button" class="link-botao" id="esqueci">Esqueci minha senha</button></div>' +
      '</form></div></div>';
    const erro = document.getElementById('login-erro');
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('login-email').value.trim();
      const senha = document.getElementById('login-senha').value;
      if (!email || !senha) {
        erro.textContent = 'Preencha o e-mail e a senha.';
        return;
      }
      const btn = document.getElementById('login-entrar');
      btn.disabled = true;
      btn.textContent = 'Entrando…';
      erro.textContent = '';
      try {
        const u = await D.entrar(email, senha);
        if (D.modoDemo()) iniciarSistema(u);
      } catch (err) {
        const codigo = err.code || '';
        erro.textContent = /invalid-credential|wrong-password|user-not-found|invalid-email/.test(codigo)
          ? 'E-mail ou senha incorretos.'
          : /too-many-requests/.test(codigo)
            ? 'Muitas tentativas. Aguarde alguns minutos e tente de novo.'
            : 'Não foi possível entrar: ' + (err.message || codigo);
        btn.disabled = false;
        btn.textContent = 'Entrar';
      }
    });
    document.getElementById('esqueci').addEventListener('click', async () => {
      const email = document.getElementById('login-email').value.trim();
      if (!email) {
        erro.textContent = 'Digite seu e-mail acima e clique de novo em "Esqueci minha senha".';
        return;
      }
      try {
        await D.recuperarSenha(email);
        erro.textContent = '';
        aviso('Enviamos um link para redefinir a senha em ' + email);
      } catch (err) {
        erro.textContent = err.message;
      }
    });
  }

  let telaAtual = '';
  function rota() {
    const partes = (location.hash || '#/inicio').replace(/^#\/?/, '').split('/');
    return { tela: GAH.telas[partes[0]] ? partes[0] : 'inicio', param: partes[1] ? decodeURIComponent(partes[1]) : '' };
  }

  function desenhar(manterRolagem) {
    if (!usuarioAtual) return;
    const { tela, param } = rota();
    const main = document.getElementById('conteudo');
    const y = window.scrollY;
    const abertos = [...main.querySelectorAll('details[open][data-chave]')].map((d) => d.dataset.chave);
    document.querySelectorAll('[data-menu]').forEach((a) => a.classList.toggle('ativo', a.dataset.menu === tela));
    main.innerHTML = '';
    main.onclick = null;
    try {
      GAH.telas[tela](main, param);
    } catch (erro) {
      console.error(erro);
      main.innerHTML = '<div class="painel"><div class="vazio"><strong>Algo deu errado nesta tela.</strong>' + esc(erro.message) + '</div></div>';
    }
    if (manterRolagem) {
      main.querySelectorAll('details[data-chave]').forEach((d) => {
        if (abertos.includes(d.dataset.chave)) d.open = true;
      });
      window.scrollTo(0, y);
    } else window.scrollTo(0, 0);
    telaAtual = location.hash;
  }

  let agendado = null;
  function redesenharDepois() {
    clearTimeout(agendado);
    agendado = setTimeout(() => {
      const ativo = document.activeElement;
      if (ativo && ativo.closest && ativo.closest('#conteudo') && /INPUT|SELECT|TEXTAREA/.test(ativo.tagName) && ativo.type !== 'checkbox') return;
      desenhar(true);
    }, 60);
  }

  function iniciarSistema(usuario) {
    usuarioAtual = usuario;
    document.body.className = '';
    const app = document.getElementById('app');
    app.innerHTML =
      topo() +
      (D.modoDemo() ? '<div class="faixa-demo">Modo demonstração — os dados ficam salvos só neste navegador. Para usar com login de verdade, siga o LEIAME.md.</div>' : '') +
      '<main class="conteudo" id="conteudo"></main>';
    document.getElementById('sair').addEventListener('click', () => D.sair());
    if (D.erroBanco) {
      const faixa = document.createElement('div');
      faixa.className = 'faixa-demo';
      faixa.style.background = 'var(--critico-fundo)';
      faixa.style.color = 'var(--critico)';
      faixa.textContent = D.erroBanco;
      app.querySelector('.topo').after(faixa);
    }
    const menu = document.getElementById('menu');
    const abrir = document.getElementById('menu-abrir');
    abrir.addEventListener('click', () => {
      const aberto = menu.classList.toggle('aberto');
      abrir.setAttribute('aria-expanded', String(aberto));
    });
    menu.addEventListener('click', () => {
      menu.classList.remove('aberto');
      abrir.setAttribute('aria-expanded', 'false');
    });
    desenhar(false);
  }

  window.addEventListener('hashchange', () => {
    if (usuarioAtual && location.hash !== telaAtual) desenhar(false);
  });
  D.aoMudar(redesenharDepois);

  /* tema escolhido em Ajustes */
  try {
    const tema = localStorage.getItem('gah-tema');
    if (tema === 'light' || tema === 'dark') document.documentElement.dataset.theme = tema;
  } catch (e) { /* ignora */ }

  async function iniciar() {
    const app = document.getElementById('app');
    document.body.className = 'tela-login';
    app.innerHTML = '<div class="carregando">Carregando…</div>';
    try {
      await D.iniciar();
    } catch (erro) {
      app.innerHTML = '<div class="carregando">Não foi possível conectar ao Firebase. Confira o arquivo js/config.js.<br><small>' + esc(erro.message) + '</small></div>';
      return;
    }
    D.observarLogin((u) => {
      if (u) {
        if (!usuarioAtual) iniciarSistema(u);
      } else {
        usuarioAtual = null;
        telaLogin();
      }
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
})();
