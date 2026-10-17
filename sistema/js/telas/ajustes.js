/* Tela Ajustes: valores padrão, aparência, backup e importação. */
(function () {
  const { esc, aviso, lerForm, nomeCliente, moeda } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;

  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  function csvContratos() {
    const hoje = calc.hoje();
    const linhas = [['Órgão', 'UF', 'Licença', 'Fabricante', 'Início vigência', 'Fim vigência', 'Forma recebimento', 'Venda', 'Recebido', 'A receber', 'Parcelas a receber', 'Forma compra', 'Compra', 'Pago', 'A pagar', 'Parcelas a pagar', 'Imposto NF', 'Imposto compra', 'Lucro', 'Situação']];
    D.lista('contratos').forEach((c) => {
      const s = calc.resumoContrato(c, hoje);
      linhas.push([nomeCliente(c.clienteId), GAH.u.ufCliente(c.clienteId), c.produto, c.fornecedor, c.vigenciaInicio, c.vigenciaFim, c.venda && c.venda.forma, s.venda, s.recebido, s.aReceber, s.parcelasReceber, c.compra && c.compra.forma, s.compra, s.pago, s.aPagar, s.parcelasPagar, s.impostoNF, s.impostoCompra, s.lucro, s.vigencia]);
    });
    return '﻿' + linhas.map((l) => l.map((v) => {
      const t = typeof v === 'number' ? String(v).replace('.', ',') : String(v === undefined || v === null ? '' : v);
      return /[";\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
    }).join(';')).join('\n');
  }

  GAH.telas.ajustes = function (main) {
    const cfg = D.configuracao();
    let tema = '';
    try { tema = localStorage.getItem('gah-tema') || ''; } catch (e) { /* ignora */ }
    const contagem = ['clientes', 'contratos', 'agenda', 'licitacoes', 'despesas'].map((c) => D.lista(c).length);

    main.innerHTML =
      '<div class="cabecalho-tela"><div><h1>Ajustes</h1><p>Valores padrão, aparência e cópias de segurança.</p></div></div>' +
      '<div class="grade grade-2">' +
      '<section class="painel"><div class="painel-cab"><h2>Valores padrão para novos contratos</h2></div><div class="painel-corpo">' +
      '<form id="form-cfg" class="form-grade">' +
      '<div class="campo"><label for="cfg-nf">Imposto da NF (%)</label><input id="cfg-nf" name="aliquotaNF" type="number" step="0.01" value="' + esc(cfg.aliquotaNF) + '"></div>' +
      '<div class="campo"><label for="cfg-compra">Imposto na compra (%)</label><input id="cfg-compra" name="aliquotaCompra" type="number" step="0.01" value="' + esc(cfg.aliquotaCompra) + '"></div>' +
      '<div class="campo"><label for="cfg-dias">Avisar fim de vigência com quantos dias</label><input id="cfg-dias" name="diasAvisoVigencia" type="number" min="1" value="' + esc(cfg.diasAvisoVigencia) + '"></div>' +
      '<div class="largo"><button class="botao" type="submit">Salvar valores padrão</button></div></form></div></section>' +

      '<section class="painel"><div class="painel-cab"><h2>Aparência</h2></div><div class="painel-corpo"><div class="campo" style="max-width:280px"><label for="cfg-tema">Tema</label>' +
      '<select id="cfg-tema"><option value=""' + (!tema ? ' selected' : '') + '>Automático (igual ao computador)</option><option value="light"' + (tema === 'light' ? ' selected' : '') + '>Claro</option><option value="dark"' + (tema === 'dark' ? ' selected' : '') + '>Escuro</option></select></div>' +
      '<p class="texto-suave" style="margin:12px 0 0">' + (D.modoDemo() ? 'Modo demonstração: os dados estão salvos só neste navegador.' : 'Conectado ao Firebase: os dados ficam na nuvem e aparecem em qualquer computador.') + '</p></div></section>' +

      '<section class="painel"><div class="painel-cab"><h2>Cópia de segurança</h2></div><div class="painel-corpo grade" style="gap:12px">' +
      '<p style="margin:0">Hoje o sistema tem <b>' + contagem[0] + '</b> órgãos, <b>' + contagem[1] + '</b> contratos, <b>' + contagem[2] + '</b> compromissos, <b>' + contagem[3] + '</b> licitações e <b>' + contagem[4] + '</b> despesas.</p>' +
      '<div class="acoes"><button class="botao" id="baixar-backup">Baixar backup completo (.json)</button><button class="botao secundario" id="baixar-csv">Baixar contratos para Excel (.csv)</button></div>' +
      '<p class="texto-suave" style="margin:0;font-size:.88rem">Guarde o backup no Drive de vez em quando. Ele também serve para mudar os dados de lugar.</p></div></section>' +

      '<section class="painel"><div class="painel-cab"><h2>Importar dados</h2></div><div class="painel-corpo grade" style="gap:12px">' +
      '<p style="margin:0">Escolha um arquivo de backup (.json) gerado por este sistema ou pela importação da planilha de faturamento. Itens com o mesmo código são atualizados; os demais são adicionados.</p>' +
      '<div class="campo"><label for="arquivo-importar">Arquivo .json</label><input id="arquivo-importar" type="file" accept=".json,application/json"></div>' +
      '<div id="import-status" class="texto-suave"></div></div></section>' +
      '</div>';

    main.querySelector('#form-cfg').addEventListener('submit', async (e) => {
      e.preventDefault();
      await D.salvar('config', Object.assign({ id: 'geral' }, lerForm(e.target)));
      aviso('Valores padrão salvos');
    });
    main.querySelector('#cfg-tema').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v) document.documentElement.dataset.theme = v;
      else delete document.documentElement.dataset.theme;
      try { if (v) localStorage.setItem('gah-tema', v); else localStorage.removeItem('gah-tema'); } catch (err) { /* ignora */ }
    });
    main.querySelector('#baixar-backup').addEventListener('click', () => {
      baixar('backup-gah-' + calc.hoje() + '.json', JSON.stringify(D.exportar(), null, 2), 'application/json');
    });
    main.querySelector('#baixar-csv').addEventListener('click', () => {
      baixar('contratos-gah-' + calc.hoje() + '.csv', csvContratos(), 'text/csv;charset=utf-8');
    });
    main.querySelector('#arquivo-importar').addEventListener('change', async (e) => {
      const arq = e.target.files[0];
      if (!arq) return;
      const status = main.querySelector('#import-status');
      try {
        const json = JSON.parse(await arq.text());
        if (!json.clientes && !json.contratos && !json.atualizar && !json.remover) throw new Error('o arquivo não parece um backup do sistema');
        status.textContent = 'Importando…';
        const total = await D.importar(json, (f, t) => (status.textContent = 'Importando ' + f + ' de ' + t + '…'));
        aviso(total + ' itens importados ou atualizados');
      } catch (err) {
        status.textContent = '';
        aviso('Não foi possível importar: ' + err.message, true);
      }
    });
  };
})();
