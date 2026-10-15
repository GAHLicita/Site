/* Cálculos financeiros do sistema. Funções puras: não mexem na tela nem nos dados salvos.
   Datas sempre no formato 'AAAA-MM-DD'. Valores em reais (número). */
(function (raiz) {
  const C = {};

  const pad = (n) => String(n).padStart(2, '0');
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
  const centavos = (v) => Math.round(num(v) * 100) / 100;

  C.num = num;
  C.centavos = centavos;

  C.hoje = function () {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  };

  C.mesDe = (data) => (data ? String(data).slice(0, 7) : '');

  C.addMeses = function (data, n) {
    if (!data) return '';
    const [a, m, d] = data.split('-').map(Number);
    const alvo = new Date(a, m - 1 + n, 1);
    const ultimoDia = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
    return alvo.getFullYear() + '-' + pad(alvo.getMonth() + 1) + '-' + pad(Math.min(d, ultimoDia));
  };

  C.addDias = function (data, n) {
    if (!data) return '';
    const [a, m, d] = data.split('-').map(Number);
    const x = new Date(a, m - 1, d + n);
    return x.getFullYear() + '-' + pad(x.getMonth() + 1) + '-' + pad(x.getDate());
  };

  C.diasEntre = function (de, ate) {
    if (!de || !ate) return null;
    const [a1, m1, d1] = de.split('-').map(Number);
    const [a2, m2, d2] = ate.split('-').map(Number);
    return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
  };

  /* Divide um total em n parcelas mensais. A diferença de centavos vai para a última. */
  C.gerarParcelas = function (total, n, primeiroVencimento, intervaloMeses) {
    n = Math.max(1, Math.floor(num(n)) || 1);
    const passo = intervaloMeses || 1;
    const base = Math.floor((num(total) * 100) / n) / 100;
    const parcelas = [];
    let soma = 0;
    for (let i = 0; i < n; i++) {
      const valor = i === n - 1 ? centavos(num(total) - soma) : base;
      soma = centavos(soma + valor);
      parcelas.push({
        num: i + 1,
        valor,
        vencimento: C.addMeses(primeiroVencimento, i * passo),
        pago: false,
        dataPagamento: ''
      });
    }
    return parcelas;
  };

  const somaValor = (lista) => centavos(lista.reduce((s, p) => s + num(p.valor), 0));

  function ladoContrato(lado, hoje) {
    const parcelas = (lado && lado.parcelas) || [];
    const total = parcelas.length ? somaValor(parcelas) : centavos(lado && lado.valorTotal);
    const pagas = parcelas.filter((p) => p.pago);
    const abertas = parcelas.filter((p) => !p.pago).sort((a, b) => (a.vencimento || '').localeCompare(b.vencimento || ''));
    const atrasadas = abertas.filter((p) => p.vencimento && p.vencimento < hoje);
    const quitado = somaValor(pagas);
    return {
      total,
      quitado,
      aberto: centavos(total - quitado),
      qtdParcelas: parcelas.length,
      qtdPagas: pagas.length,
      qtdAbertas: abertas.length,
      qtdAtrasadas: atrasadas.length,
      valorAtrasado: somaValor(atrasadas),
      proxima: abertas[0] || null
    };
  }

  /* Resumo completo de um contrato: quanto vale, quanto entrou, quanto falta, lucro. */
  C.resumoContrato = function (c, hoje) {
    hoje = hoje || C.hoje();
    const venda = ladoContrato(c.venda, hoje);
    const compra = ladoContrato(c.compra, hoje);
    const impostoNF = centavos((venda.total * num(c.venda && c.venda.aliquotaNF)) / 100);
    const impostoCompra = centavos((compra.total * num(c.compra && c.compra.aliquotaCompra)) / 100);
    const lucro = centavos(venda.total - compra.total - impostoNF - impostoCompra);
    const diasFim = c.vigenciaFim ? C.diasEntre(hoje, c.vigenciaFim) : null;
    let vigencia = 'sem data';
    if (c.status === 'cancelado') vigencia = 'cancelado';
    else if (diasFim !== null) vigencia = diasFim < 0 ? 'encerrada' : diasFim <= 60 ? 'vencendo' : 'vigente';
    return {
      venda: venda.total,
      recebido: venda.quitado,
      aReceber: venda.aberto,
      parcelasReceber: venda.qtdAbertas,
      parcelasRecebidas: venda.qtdPagas,
      totalParcelasVenda: venda.qtdParcelas,
      parcelasAtrasadas: venda.qtdAtrasadas,
      valorAtrasado: venda.valorAtrasado,
      proximoRecebimento: venda.proxima,
      compra: compra.total,
      pago: compra.quitado,
      aPagar: compra.aberto,
      parcelasPagar: compra.qtdAbertas,
      parcelasPagas: compra.qtdPagas,
      totalParcelasCompra: compra.qtdParcelas,
      pagamentosAtrasados: compra.qtdAtrasadas,
      proximoPagamento: compra.proxima,
      impostoNF,
      impostoCompra,
      lucro,
      margem: venda.total ? lucro / venda.total : 0,
      diasParaFimVigencia: diasFim,
      vigencia
    };
  };

  const valido = (c) => c.status !== 'cancelado';

  /* Números da empresa inteira para a tela Financeiro. */
  C.resumoGeral = function (contratos, despesas, clientes, hoje) {
    hoje = hoje || C.hoje();
    const r = {
      totalContratos: 0, recebido: 0, aReceber: 0, valorAtrasado: 0, parcelasAtrasadas: 0,
      totalCompras: 0, pagoCompras: 0, aPagar: 0, impostos: 0, lucroBruto: 0,
      despesas: 0, despesasAPagar: 0, lucroLiquido: 0, contratosAtivos: 0
    };
    const clientesComContrato = new Set();
    for (const c of contratos.filter(valido)) {
      const s = C.resumoContrato(c, hoje);
      r.totalContratos += s.venda;
      r.recebido += s.recebido;
      r.aReceber += s.aReceber;
      r.valorAtrasado += s.valorAtrasado;
      r.parcelasAtrasadas += s.parcelasAtrasadas;
      r.totalCompras += s.compra;
      r.pagoCompras += s.pago;
      r.aPagar += s.aPagar;
      r.impostos += s.impostoNF + s.impostoCompra;
      r.lucroBruto += s.lucro;
      if (s.vigencia !== 'encerrada' && c.status !== 'encerrado') r.contratosAtivos++;
      if (c.clienteId) clientesComContrato.add(c.clienteId);
    }
    for (const d of despesas) {
      r.despesas += num(d.valor);
      if (!d.pago) r.despesasAPagar += num(d.valor);
    }
    for (const k of Object.keys(r)) r[k] = centavos(r[k]);
    r.lucroLiquido = centavos(r.lucroBruto - r.despesas);
    const atendidos = clientes.filter((c) => clientesComContrato.has(c.id));
    r.orgaosAtendidos = atendidos.length;
    r.estados = [...new Set(atendidos.map((c) => (c.uf || '').toUpperCase()).filter(Boolean))].sort();
    return r;
  };

  /* Faturamento mês a mês, como a aba "Faturamento" da planilha.
     Venda e imposto da NF entram no mês de emissão da nota (ou do vencimento, se não houver emissão).
     Compra e imposto da compra entram no mês do vencimento da parcela de compra. */
  C.faturamentoMensal = function (contratos, despesas, ano) {
    const meses = [];
    for (let m = 1; m <= 12; m++) {
      meses.push({ mes: ano + '-' + pad(m), venda: 0, compra: 0, impostos: 0, despesas: 0, lucro: 0 });
    }
    const idx = (data) => {
      const mes = C.mesDe(data);
      return mes.slice(0, 4) === String(ano) ? Number(mes.slice(5, 7)) - 1 : -1;
    };
    for (const c of contratos.filter(valido)) {
      const aliqNF = num(c.venda && c.venda.aliquotaNF) / 100;
      const aliqCompra = num(c.compra && c.compra.aliquotaCompra) / 100;
      for (const p of (c.venda && c.venda.parcelas) || []) {
        const i = idx(p.emissao || p.vencimento);
        if (i < 0) continue;
        meses[i].venda += num(p.valor);
        meses[i].impostos += num(p.valor) * aliqNF;
      }
      for (const p of (c.compra && c.compra.parcelas) || []) {
        const i = idx(p.vencimento);
        if (i < 0) continue;
        meses[i].compra += num(p.valor);
        meses[i].impostos += num(p.valor) * aliqCompra;
      }
    }
    for (const d of despesas) {
      const i = idx(d.data);
      if (i >= 0) meses[i].despesas += num(d.valor);
    }
    for (const m of meses) {
      m.venda = centavos(m.venda);
      m.compra = centavos(m.compra);
      m.impostos = centavos(m.impostos);
      m.despesas = centavos(m.despesas);
      m.lucro = centavos(m.venda - m.compra - m.impostos - m.despesas);
    }
    return meses;
  };

  /* Quanto entra e quanto sai nos próximos meses, pelas parcelas em aberto. */
  C.previsaoCaixa = function (contratos, despesas, hoje, quantosMeses) {
    hoje = hoje || C.hoje();
    const inicio = C.mesDe(hoje);
    const lista = [];
    const pos = {};
    for (let i = 0; i < (quantosMeses || 6); i++) {
      const mes = C.mesDe(C.addMeses(inicio + '-01', i));
      pos[mes] = lista.length;
      lista.push({ mes, entra: 0, sai: 0, saldo: 0 });
    }
    const mesAlvo = (data) => {
      const mes = C.mesDe(data);
      return mes < inicio ? inicio : mes; // atrasados contam no mês atual
    };
    for (const c of contratos.filter(valido)) {
      for (const p of (c.venda && c.venda.parcelas) || []) {
        if (p.pago || !p.vencimento) continue;
        const i = pos[mesAlvo(p.vencimento)];
        if (i !== undefined) lista[i].entra += num(p.valor);
      }
      for (const p of (c.compra && c.compra.parcelas) || []) {
        if (p.pago || !p.vencimento) continue;
        const i = pos[mesAlvo(p.vencimento)];
        if (i !== undefined) lista[i].sai += num(p.valor);
      }
    }
    for (const d of despesas) {
      if (d.pago || !d.data) continue;
      const i = pos[mesAlvo(d.data)];
      if (i !== undefined) lista[i].sai += num(d.valor);
    }
    for (const l of lista) {
      l.entra = centavos(l.entra);
      l.sai = centavos(l.sai);
      l.saldo = centavos(l.entra - l.sai);
    }
    return lista;
  };

  raiz.GAH = raiz.GAH || {};
  raiz.GAH.calc = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
