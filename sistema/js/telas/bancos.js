/* Tela Contas bancárias: dados das contas da empresa para consulta e para copiar e mandar aos órgãos. */
(function () {
  const { esc, opcoes, janela, lerForm, aviso, botaoExcluir, linkWhats } = GAH.u;
  const D = GAH.dados;
  const TIPOS_CONTA = ['Conta corrente', 'Conta poupança', 'Conta de pagamento'];
  const TIPOS_PIX = ['CNPJ', 'E-mail', 'Telefone', 'Chave aleatória', 'CPF'];

  const linhaPix = (p) =>
    '<div class="form-grade pix-linha" style="grid-template-columns:minmax(0,160px) minmax(0,1fr) auto;align-items:end">' +
    '<div class="campo"><label>Tipo da chave</label><select data-p="tipo">' + opcoes(TIPOS_PIX, (p || {}).tipo) + '</select></div>' +
    '<div class="campo"><label>Chave Pix</label><input data-p="chave" value="' + esc((p || {}).chave) + '"></div>' +
    '<button type="button" class="link-botao" data-remover-pix style="margin-bottom:10px">remover</button></div>';

  function form(conta) {
    const c = conta || { tipo: 'Conta corrente', titular: 'GAH Licita Ltda', pix: [] };
    const corpo =
      '<p class="nota-demo" style="margin:0">Não guarde senhas, tokens ou códigos de acesso aqui. Use só os dados que você passaria a um cliente.</p>' +
      '<form id="form-conta" class="form-grade">' +
      '<div class="campo"><label for="cb-banco">Banco *</label><input id="cb-banco" name="banco" required value="' + esc(c.banco) + '" placeholder="Ex.: Banco do Brasil"></div>' +
      '<div class="campo"><label for="cb-cod">Código do banco</label><input id="cb-cod" name="codigoBanco" value="' + esc(c.codigoBanco) + '" placeholder="Ex.: 001"></div>' +
      '<div class="campo"><label for="cb-tipo">Tipo de conta</label><select id="cb-tipo" name="tipo">' + opcoes(TIPOS_CONTA, c.tipo) + '</select></div>' +
      '<div class="campo"><label for="cb-ag">Agência</label><input id="cb-ag" name="agencia" value="' + esc(c.agencia) + '"></div>' +
      '<div class="campo"><label for="cb-conta">Conta (com dígito)</label><input id="cb-conta" name="conta" value="' + esc(c.conta) + '"></div>' +
      '<div class="campo"><label for="cb-titular">Titular</label><input id="cb-titular" name="titular" value="' + esc(c.titular) + '"></div>' +
      '<div class="campo"><label for="cb-cnpj">CNPJ do titular</label><input id="cb-cnpj" name="cnpj" value="' + esc(c.cnpj) + '"></div>' +
      '<div class="campo"><label for="cb-gerente">Gerente</label><input id="cb-gerente" name="gerente" value="' + esc(c.gerente) + '"></div>' +
      '<div class="campo"><label for="cb-telger">Telefone do gerente</label><input id="cb-telger" name="telefoneGerente" value="' + esc(c.telefoneGerente) + '"></div>' +
      '<div class="campo largo"><label for="cb-uso">Para que usamos esta conta</label><input id="cb-uso" name="uso" value="' + esc(c.uso) + '" placeholder="Ex.: recebimento dos órgãos públicos"></div>' +
      '<label class="parcela-check largo"><input type="checkbox" name="principal"' + (c.principal ? ' checked' : '') + '> Conta principal para recebimentos</label>' +
      '<div class="largo"><h3 style="font-size:1rem;margin-bottom:8px">Chaves Pix</h3><div id="lista-pix" class="grade" style="gap:8px">' + (c.pix || []).map(linhaPix).join('') + '</div>' +
      '<button type="button" class="botao secundario pequeno" id="add-pix" style="margin-top:8px">+ Chave Pix</button></div>' +
      '<div class="campo largo"><label for="cb-obs">Observações</label><textarea id="cb-obs" name="observacoes">' + esc(c.observacoes) + '</textarea></div>' +
      '</form>';
    const rodape = (c.id ? '<button type="button" class="botao perigo" id="excluir-conta">Excluir conta</button>' : '') +
      '<div class="dir"><button type="button" class="botao secundario" data-cancelar>Cancelar</button><button type="submit" form="form-conta" class="botao">Salvar</button></div>';
    const j = janela({ titulo: c.id ? 'Editar conta bancária' : 'Nova conta bancária', corpo, rodape });
    const lista = j.el.querySelector('#lista-pix');
    j.el.querySelector('[data-cancelar]').addEventListener('click', j.fechar);
    j.el.querySelector('#add-pix').addEventListener('click', () => lista.insertAdjacentHTML('beforeend', linhaPix({})));
    lista.addEventListener('click', (e) => { if (e.target.matches('[data-remover-pix]')) e.target.closest('.pix-linha').remove(); });
    botaoExcluir(j.el, '#excluir-conta', 'Excluir esta conta?', async () => {
      await D.excluir('contas', c.id);
      j.fechar();
      aviso('Conta excluída');
    });
    j.el.querySelector('#form-conta').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dados = lerForm(e.target);
      dados.pix = [...lista.querySelectorAll('.pix-linha')].map((l) => ({ tipo: l.querySelector('[data-p="tipo"]').value, chave: l.querySelector('[data-p="chave"]').value.trim() })).filter((p) => p.chave);
      await D.salvar('contas', Object.assign({}, c, dados));
      j.fechar();
      aviso('Conta salva');
    });
  }

  function textoConta(c) {
    return [
      'Banco: ' + c.banco + (c.codigoBanco ? ' (' + c.codigoBanco + ')' : ''),
      c.agencia ? 'Agência: ' + c.agencia : '',
      c.conta ? (c.tipo || 'Conta') + ': ' + c.conta : '',
      c.titular ? 'Titular: ' + c.titular : '',
      c.cnpj ? 'CNPJ: ' + c.cnpj : '',
      ...(c.pix || []).map((p) => 'Pix (' + p.tipo + '): ' + p.chave)
    ].filter(Boolean).join('\n');
  }

  async function copiar(texto, botao) {
    try {
      await navigator.clipboard.writeText(texto);
      aviso('Copiado');
    } catch (e) {
      const area = botao.closest('.painel').querySelector('textarea.copia');
      area.hidden = false;
      area.select();
      aviso('Selecionei o texto: use Ctrl+C para copiar');
    }
  }

  GAH.telas.bancos = function (main) {
    const contas = D.lista('contas').slice().sort((a, b) => (b.principal ? 1 : 0) - (a.principal ? 1 : 0) || (a.banco || '').localeCompare(b.banco || ''));
    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Contas bancárias</h1><p>Dados das contas da empresa à mão, prontos para copiar e enviar aos órgãos.</p></div>' +
      '<div class="acoes"><button class="botao" id="nova-conta">+ Nova conta</button></div></div>' +
      (contas.length
        ? '<div class="grade grade-2">' + contas.map((c) => {
            const w = linkWhats(c.telefoneGerente);
            return '<section class="painel"><div class="painel-cab"><div><h2>' + esc(c.banco) + (c.codigoBanco ? ' <span class="texto-suave" style="font-family:var(--fonte-texto);font-size:.9rem">· ' + esc(c.codigoBanco) + '</span>' : '') + '</h2><span class="sub">' + esc(c.uso || c.tipo || '') + '</span></div>' +
              (c.principal ? '<span class="selo ok">principal</span>' : '') + '</div>' +
              '<div class="painel-corpo grade" style="gap:12px"><dl class="ficha">' +
              '<dt>Tipo</dt><dd>' + esc(c.tipo || '—') + '</dd>' +
              '<dt>Agência</dt><dd class="num">' + esc(c.agencia || '—') + '</dd>' +
              '<dt>Conta</dt><dd class="num">' + esc(c.conta || '—') + '</dd>' +
              '<dt>Titular</dt><dd>' + esc(c.titular || '—') + '</dd>' +
              (c.cnpj ? '<dt>CNPJ</dt><dd class="num">' + esc(c.cnpj) + '</dd>' : '') +
              (c.pix || []).map((p) => '<dt>Pix · ' + esc(p.tipo) + '</dt><dd>' + esc(p.chave) + '</dd>').join('') +
              (c.gerente ? '<dt>Gerente</dt><dd>' + esc(c.gerente) + (c.telefoneGerente ? ' · ' + esc(c.telefoneGerente) : '') + (w ? ' · <a href="' + esc(w) + '" target="_blank" rel="noopener">WhatsApp</a>' : '') + '</dd>' : '') +
              (c.observacoes ? '<dt>Obs.</dt><dd>' + esc(c.observacoes) + '</dd>' : '') +
              '</dl><textarea class="copia filtro" readonly hidden rows="6" aria-label="Dados para copiar">' + esc(textoConta(c)) + '</textarea>' +
              '<div class="acoes"><button type="button" class="botao pequeno" data-copiar="' + esc(c.id) + '">Copiar dados bancários</button><button type="button" class="botao secundario pequeno" data-editar="' + esc(c.id) + '">Editar</button></div></div></section>';
          }).join('') + '</div>'
        : '<section class="painel"><div class="vazio"><strong>Nenhuma conta cadastrada</strong>Cadastre as contas da empresa para ter agência, conta e Pix sempre à mão.</div></section>');

    main.querySelector('#nova-conta').addEventListener('click', () => form(null));
    main.querySelectorAll('[data-editar]').forEach((b) => b.addEventListener('click', () => form(D.obter('contas', b.dataset.editar))));
    main.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiar(textoConta(D.obter('contas', b.dataset.copiar)), b)));
  };
})();
