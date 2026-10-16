/* Tela Início: cotação do dólar em tempo real, painel financeiro da empresa
   e contratos perto do fim da vigência. */
(function () {
  const { esc, MESES_CURTOS } = GAH.u;
  const calc = GAH.calc;
  const D = GAH.dados;

  /* ---------- cotação do dólar ---------- */
  // 1º AwesomeAPI (dólar comercial, atualiza a cada minuto); se falhar, PTAX do Banco Central.
  const cotacao = { dados: null, buscadaEm: 0, buscando: null };
  const ATUALIZAR_A_CADA = 60 * 1000;
  const fmt = (v, casas) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  const hora = (d) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  async function daAwesome() {
    const r = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL', { cache: 'no-store' });
    if (!r.ok) throw new Error('AwesomeAPI ' + r.status);
    const j = (await r.json()).USDBRL;
    return {
      compra: Number(j.bid), venda: Number(j.ask), variacao: Number(j.pctChange),
      maxima: Number(j.high), minima: Number(j.low),
      quando: new Date(Number(j.timestamp) * 1000), fonte: 'Dólar comercial'
    };
  }

  async function doBancoCentral() {
    const p = (d) => String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') + '-' + d.getFullYear();
    const hoje = new Date();
    const inicio = new Date(hoje.getTime() - 10 * 86400000);
    const url = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoMoedaPeriodo(moeda=@moeda,dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)" +
      "?@moeda='USD'&@dataInicial='" + p(inicio) + "'&@dataFinalCotacao='" + p(hoje) + "'&$top=20&$orderby=dataHoraCotacao%20desc&$format=json";
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error('Banco Central ' + r.status);
    const lista = (await r.json()).value || [];
    if (!lista.length) throw new Error('Banco Central sem cotação');
    const atual = lista[0];
    // variação em relação ao último fechamento de um dia anterior
    const diaAtual = atual.dataHoraCotacao.slice(0, 10);
    const anterior = lista.find((x) => x.dataHoraCotacao.slice(0, 10) < diaAtual && x.tipoBoletim === 'Fechamento') || lista.find((x) => x.dataHoraCotacao.slice(0, 10) < diaAtual);
    return {
      compra: atual.cotacaoCompra, venda: atual.cotacaoVenda,
      variacao: anterior ? ((atual.cotacaoVenda - anterior.cotacaoVenda) / anterior.cotacaoVenda) * 100 : null,
      quando: new Date(atual.dataHoraCotacao.replace(' ', 'T').slice(0, 19)), fonte: 'PTAX Banco Central (' + atual.tipoBoletim.toLowerCase() + ')'
    };
  }

  async function buscarCotacao() {
    if (cotacao.buscando) return cotacao.buscando;
    cotacao.buscando = (async () => {
      try {
        cotacao.dados = await daAwesome();
      } catch (e1) {
        try { cotacao.dados = await doBancoCentral(); } catch (e2) { console.warn('Cotação indisponível', e1, e2); }
      }
      cotacao.buscadaEm = Date.now();
      cotacao.buscando = null;
      desenharCotacao();
    })();
    return cotacao.buscando;
  }

  function htmlCotacao() {
    const c = cotacao.dados;
    if (!c) {
      return '<div class="cotacao-rotulo">Dólar hoje</div><div class="cotacao-valor">' + (cotacao.buscadaEm ? 'indisponível' : 'carregando…') + '</div>' +
        (cotacao.buscadaEm ? '<div class="cotacao-info">Não foi possível buscar a cotação agora. Tentando de novo em 1 minuto.</div>' : '');
    }
    const v = c.variacao;
    const seta = v === null || isNaN(v) ? '' : v > 0 ? '▲' : v < 0 ? '▼' : '■';
    const cls = v > 0 ? 'sobe' : v < 0 ? 'desce' : '';
    return '<div class="cotacao-rotulo">Dólar hoje <span class="cotacao-ao-vivo" title="Atualiza sozinho a cada minuto">ao vivo</span></div>' +
      '<div class="cotacao-linha"><div class="cotacao-valor">R$ ' + fmt(c.venda, 4) + '</div>' +
      (seta ? '<div class="cotacao-variacao ' + cls + '">' + seta + ' ' + fmt(Math.abs(v), 2) + '%</div>' : '') + '</div>' +
      '<div class="cotacao-info">' + esc(c.fonte) + ' · atualizado às ' + hora(c.quando) + '</div>';
  }

  function desenharCotacao() {
    const el = document.getElementById('cotacao-dolar');
    if (el) el.innerHTML = htmlCotacao();
  }

  // Atualiza sozinho enquanto a tela Início estiver aberta.
  setInterval(() => {
    if (document.getElementById('cotacao-dolar') && !document.hidden) buscarCotacao();
  }, ATUALIZAR_A_CADA);

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
      cabecalho: '<div class="cotacao" id="cotacao-dolar" aria-live="polite">' + htmlCotacao() + '</div>',
      rodape: painelRenovacoes(),
      redesenhar: () => GAH.telas.inicio(main)
    });
    if (Date.now() - cotacao.buscadaEm > ATUALIZAR_A_CADA) buscarCotacao();
  };
})();
