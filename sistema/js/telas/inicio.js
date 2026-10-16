/* Tela Início: painel financeiro da empresa e contratos perto do fim da vigência. */
(function () {
  const { esc, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;

  /* ---------- contratos perto do fim da vigência ---------- */
  function painelRenovacoes() {
    const hoje = calc.hoje();
    const cfg = D.configuracao();
    const limite = calc.addDias(hoje, cfg.diasAvisoVigencia);
    const lista = GAH.eventosAutomaticos()
      .filter((e) => e.tipo === 'renovacao' && e.data >= hoje && e.data <= limite)
      .sort((a, b) => a.data.localeCompare(b.data));
    return '<section class="painel"><div class="painel-cab"><h2>Contratos que vencem em até ' + cfg.diasAvisoVigencia + ' dias</h2><span class="sub">Oportunidades de renovação</span></div>' +
      (lista.length
        ? '<ul class="avisos">' + lista.map((e) => {
            const n = calc.diasEntre(hoje, e.data);
            return '<li><div class="data-bloco"><b>' + e.data.slice(8, 10) + '</b><span>' + MESES_CURTOS[Number(e.data.slice(5, 7)) - 1] + '</span></div>' +
              '<div class="titulo"><a href="' + esc(e.link) + '">' + esc(e.titulo) + '</a><span class="detalhe">' + esc(e.detalhe || '') + '</span></div>' +
              '<span class="selo alerta">' + (n === 0 ? 'hoje' : n === 1 ? 'amanhã' : n + ' dias') + '</span></li>';
          }).join('') + '</ul>'
        : '<div class="vazio"><strong>Nenhum contrato vencendo</strong>Nenhuma vigência termina nos próximos ' + cfg.diasAvisoVigencia + ' dias.</div>') +
      '</section>';
  }

  GAH.telas.inicio = function (main) {
    GAH.renderFinanceiro(main, {
      rodape: painelRenovacoes(),
      redesenhar: () => GAH.telas.inicio(main)
    });
  };
})();
