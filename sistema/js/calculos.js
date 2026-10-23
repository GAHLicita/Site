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
      meses.push({ mes: ano + '-' + pad(m), venda: 0, compra: 0, impostos: 0, despesas: 0, lucro: 0, porContrato: {}, gastos: [] });
    }
    const idx = (data) => {
      const mes = C.mesDe(data);
      return mes.slice(0, 4) === String(ano) ? Number(mes.slice(5, 7)) - 1 : -1;
    };
    // detalhe de cada mês: quanto de cada contrato entrou nele (venda, compra e impostos)
    const doContrato = (m, c) => (m.porContrato[c.id] = m.porContrato[c.id] || { contratoId: c.id, venda: 0, compra: 0, impostos: 0 });
    for (const c of contratos.filter(valido)) {
      const aliqNF = num(c.venda && c.venda.aliquotaNF) / 100;
      const aliqCompra = num(c.compra && c.compra.aliquotaCompra) / 100;
      for (const p of (c.venda && c.venda.parcelas) || []) {
        const i = idx(p.emissao || p.vencimento);
        if (i < 0) continue;
        meses[i].venda += num(p.valor);
        meses[i].impostos += num(p.valor) * aliqNF;
        const k = doContrato(meses[i], c);
        k.venda += num(p.valor);
        k.impostos += num(p.valor) * aliqNF;
      }
      for (const p of (c.compra && c.compra.parcelas) || []) {
        const i = idx(p.vencimento);
        if (i < 0) continue;
        meses[i].compra += num(p.valor);
        meses[i].impostos += num(p.valor) * aliqCompra;
        const k = doContrato(meses[i], c);
        k.compra += num(p.valor);
        k.impostos += num(p.valor) * aliqCompra;
      }
    }
    for (const d of despesas) {
      const i = idx(d.data);
      if (i >= 0) {
        meses[i].despesas += num(d.valor);
        meses[i].gastos.push({ descricao: d.descricao || 'Despesa', categoria: d.categoria || '', valor: centavos(num(d.valor)), pago: !!d.pago });
      }
    }
    for (const m of meses) {
      m.venda = centavos(m.venda);
      m.compra = centavos(m.compra);
      m.impostos = centavos(m.impostos);
      m.despesas = centavos(m.despesas);
      m.lucro = centavos(m.venda - m.compra - m.impostos - m.despesas);
      m.contratos = Object.values(m.porContrato)
        .map((k) => ({ contratoId: k.contratoId, venda: centavos(k.venda), compra: centavos(k.compra), impostos: centavos(k.impostos), lucro: centavos(k.venda - k.compra - k.impostos) }))
        .sort((a, b) => b.venda - a.venda || b.compra - a.compra);
      delete m.porContrato;
    }
    return meses;
  };

  /* Quanto entra e quanto sai nos próximos meses, pelas parcelas em aberto. */
  /* Renovações. Um contrato é renovação de outro do mesmo órgão e do mesmo fabricante (ou licença) quando
     começa perto do fim do anterior (até 60 dias antes ou depois). A renovação fica "pendente" até as licenças
     serem entregues: enquanto isso, o que vale é a vigência do contrato anterior.
     Entregue = marcado como entregue (licencasEntregues), ou com data de entrega já passada e vigência iniciada.
     Devolve { [idRenovacao]: { anterior, pendente }, porAnterior: { [idAnterior]: idRenovacao } }. */
  C.renovacoes = function (contratos, hoje) {
    const lista = (contratos || []).filter((c) => c.status !== 'cancelado' && c.vigenciaInicio && c.vigenciaFim);
    const chave = (c) => String(c.fornecedor || c.produto || '').trim().toLowerCase();
    const r = { porAnterior: {} };
    for (const c of lista) {
      let melhor = null;
      let menor = Infinity;
      for (const o of lista) {
        if (o.id === c.id || o.clienteId !== c.clienteId || chave(o) !== chave(c)) continue;
        if (!(o.vigenciaInicio < c.vigenciaInicio && o.vigenciaFim < c.vigenciaFim)) continue;
        const dif = Math.abs(C.diasEntre(o.vigenciaFim, c.vigenciaInicio));
        if (dif <= 60 && dif < menor) { menor = dif; melhor = o; }
      }
      if (!melhor) continue;
      const entregue = !!c.licencasEntregues || (!!c.dataEntrega && c.dataEntrega <= hoje && c.vigenciaInicio <= hoje);
      r[c.id] = { anterior: melhor.id, pendente: !entregue };
      r.porAnterior[melhor.id] = c.id;
    }
    return r;
  };

  /* Licenças já entregues? Renovação: só depois do ok de entrega (veja C.renovacoes). Demais contratos:
     marcado como entregue, ou com data de entrega já chegada. Sem data de entrega = ainda não entregue
     (contrato fechado esperando o órgão pedir a entrega). */
  C.licencasEntregues = function (c, hoje, ren) {
    const r = ren && ren[c.id];
    if (r) return !r.pendente;
    if (c.licencasEntregues) return true;
    return !!c.dataEntrega && c.dataEntrega <= hoje;
  };

  /* Contrato fechado e ainda não entregue: enquanto o órgão não pede a entrega, os valores em aberto não podem
     ficar presos num mês que já passou. Se a primeira parcela em aberto (venda sem NF emitida, ou compra não paga)
     é de um mês anterior ao atual, todas as parcelas em aberto do contrato andam o mesmo número de meses,
     de modo que a primeira caia no mês atual (nunca antes de hoje). Devolve cópias; o contrato salvo não muda. */
  C.adiarNaoEntregues = function (contratos, hoje) {
    hoje = hoje || C.hoje();
    const mesAtual = C.mesDe(hoje);
    const ren = C.renovacoes(contratos, hoje);
    // antes da entrega a NF ainda não vale: a venda em aberto anda junto, mesmo com emissão prevista
    const aberta = (lado, p) => !p.pago && p.vencimento;
    return (contratos || []).map((c) => {
      if (c.status === 'cancelado' || C.licencasEntregues(c, hoje, ren)) return c;
      const datas = [];
      ['venda', 'compra'].forEach((l) => ((c[l] && c[l].parcelas) || []).forEach((p) => { if (aberta(l, p)) datas.push(p.vencimento); }));
      if (!datas.length) return c;
      const primeira = datas.sort()[0];
      if (C.mesDe(primeira) >= mesAtual) return c;
      const meses = (Number(mesAtual.slice(0, 4)) - Number(primeira.slice(0, 4))) * 12 + Number(mesAtual.slice(5, 7)) - Number(primeira.slice(5, 7));
      const novo = JSON.parse(JSON.stringify(c));
      ['venda', 'compra'].forEach((l) => ((novo[l] && novo[l].parcelas) || []).forEach((p) => {
        if (!aberta(l, p)) return;
        const ajusta = (data) => { const d = C.addMeses(data, meses); return d < hoje && C.mesDe(d) === mesAtual ? hoje : d; };
        p.vencimento = ajusta(p.vencimento);
        if (p.emissao && C.mesDe(p.emissao) < mesAtual) p.emissao = ajusta(p.emissao);
      }));
      novo.adiadoMeses = meses;
      return novo;
    });
  };

  /* Vendas por fabricante. Um contrato com licenças de vários fabricantes (lista 'itens', cada uma com
     fornecedor e valor) é dividido entre eles na proporção do valor de cada licença; o contrato conta uma
     vez para cada fabricante que aparece nele. Sem 'itens', vale o campo fornecedor do contrato. */
  C.vendasPorFabricante = function (contratos, hoje) {
    const mapa = {};
    for (const c of contratos || []) {
      if (c.status === 'cancelado') continue;
      const s = C.resumoContrato(c, hoje);
      const itens = (c.itens || []).filter((i) => String(i.fornecedor || '').trim() && num(i.valor) > 0);
      const soma = itens.reduce((t, i) => t + num(i.valor), 0);
      const partes = {};
      if (itens.length && soma > 0) itens.forEach((i) => { const f = String(i.fornecedor).trim(); partes[f] = (partes[f] || 0) + num(i.valor) / soma; });
      else partes[String(c.fornecedor || '').trim() || 'Sem fabricante'] = 1;
      for (const f of Object.keys(partes)) {
        const m = (mapa[f] = mapa[f] || { fabricante: f, n: 0, venda: 0, lucro: 0 });
        m.n++;
        m.venda += s.venda * partes[f];
        m.lucro += s.lucro * partes[f];
      }
    }
    return Object.values(mapa)
      .map((m) => Object.assign(m, { venda: centavos(m.venda), lucro: centavos(m.lucro) }))
      .sort((a, b) => b.venda - a.venda);
  };

  C.previsaoCaixa = function (contratos, despesas, hoje, quantosMeses) {
    hoje = hoje || C.hoje();
    const inicio = C.mesDe(hoje);
    const lista = [];
    const pos = {};
    for (let i = 0; i < (quantosMeses || 6); i++) {
      const mes = C.mesDe(C.addMeses(inicio + '-01', i));
      pos[mes] = lista.length;
      lista.push({ mes, entra: 0, sai: 0, saldo: 0, porContrato: {}, gastos: [] });
    }
    const mesAlvo = (data) => {
      const mes = C.mesDe(data);
      return mes < inicio ? inicio : mes; // atrasados contam no mês atual
    };
    // detalhe de cada mês: de qual contrato vem cada entrada e cada saída (com as parcelas atrasadas marcadas)
    // Parcelas já pagas ou recebidas entram no mês do pagamento (se esse mês estiver na previsão), marcadas como
    // realizadas: assim o mês atual mostra o que já saiu e entrou, mais o que ainda falta.
    const doContrato = (m, c) => (m.porContrato[c.id] = m.porContrato[c.id] || { contratoId: c.id, entra: 0, sai: 0, recebido: 0, pago: 0, atrasado: false });
    const realizado = (p) => pos[C.mesDe(p.dataPagamento || p.vencimento || '')];
    for (const c of contratos.filter(valido)) {
      for (const p of (c.venda && c.venda.parcelas) || []) {
        if (p.pago) {
          const i = realizado(p);
          if (i === undefined) continue;
          lista[i].entra += num(p.valor);
          const k = doContrato(lista[i], c);
          k.entra += num(p.valor);
          k.recebido += num(p.valor);
          continue;
        }
        if (!p.vencimento) continue;
        const i = pos[mesAlvo(p.vencimento)];
        if (i === undefined) continue;
        lista[i].entra += num(p.valor);
        const k = doContrato(lista[i], c);
        k.entra += num(p.valor);
        if (C.mesDe(p.vencimento) < inicio || p.vencimento < hoje) k.atrasado = true;
      }
      for (const p of (c.compra && c.compra.parcelas) || []) {
        if (p.pago) {
          const i = realizado(p);
          if (i === undefined) continue;
          lista[i].sai += num(p.valor);
          const k = doContrato(lista[i], c);
          k.sai += num(p.valor);
          k.pago += num(p.valor);
          continue;
        }
        if (!p.vencimento) continue;
        const i = pos[mesAlvo(p.vencimento)];
        if (i === undefined) continue;
        lista[i].sai += num(p.valor);
        doContrato(lista[i], c).sai += num(p.valor);
      }
    }
    for (const d of despesas) {
      if (!d.data) continue;
      const i = d.pago ? pos[C.mesDe(d.dataPagamento || d.data)] : pos[mesAlvo(d.data)];
      if (i === undefined) continue;
      lista[i].sai += num(d.valor);
      lista[i].gastos.push({ descricao: d.descricao || 'Despesa', categoria: d.categoria || '', valor: centavos(num(d.valor)), data: d.data, pago: !!d.pago });
    }
    for (const m of lista) {
      m.contratos = Object.values(m.porContrato)
        .map((k) => Object.assign(k, { entra: centavos(k.entra), sai: centavos(k.sai), recebido: centavos(k.recebido), pago: centavos(k.pago) }))
        .sort((a, b) => b.entra - a.entra || b.sai - a.sai);
      delete m.porContrato;
    }
    for (const l of lista) {
      l.entra = centavos(l.entra);
      l.sai = centavos(l.sai);
      l.saldo = centavos(l.entra - l.sai);
    }
    return lista;
  };

  /* Custos fixos e mensalidade do contador viram lançamentos mês a mês, no mesmo formato das despesas
     ({ data, valor, pago, categoria, descricao, origem }), até o mês 'ateMes' (AAAA-MM), inclusive.
     - custos: serviços com valor padrão, periodicidade (mensal/anual), início, fim e pagamentos por mês;
     - contabilidade: documentos por mês (id AAAA-MM) com a mensalidade { valor, pago, data }. */
  C.custosNoPeriodo = function (custos, contabilidade, ateMes) {
    const lista = [];
    for (const m of contabilidade || []) {
      if (!/^\d{4}-\d{2}$/.test(m.id) || m.id > ateMes || !m.mensalidade) continue;
      const v = num(m.mensalidade.valor);
      if (!v) continue;
      lista.push({
        // o custo fica no mês de competência, mesmo que o pagamento tenha sido feito no mês seguinte
        data: m.mensalidade.data && m.mensalidade.data.startsWith(m.id) ? m.mensalidade.data : m.id + '-10',
        dataPagamento: m.mensalidade.data || '',
        valor: v,
        pago: !!m.mensalidade.pago,
        categoria: 'Contabilidade',
        descricao: 'Mensalidade do contador',
        origem: 'contabilidade',
        mes: m.id
      });
    }
    for (const c of custos || []) {
      if (!c.inicio) continue;
      const fim = c.fim && c.fim < ateMes ? c.fim : ateMes;
      const passo = c.periodicidade === 'anual' ? 12 : 1;
      for (let mes = c.inicio; mes <= fim; mes = C.mesDe(C.addMeses(mes + '-01', passo))) {
        const p = (c.pagamentos && c.pagamentos[mes]) || {};
        if (p.semCobranca) continue;
        const ultimoDia = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5, 7)), 0).getDate();
        lista.push({
          data: mes + '-' + pad(Math.min(num(c.diaVencimento) || 10, ultimoDia)),
          dataPagamento: p.data || '',
          valor: p.valor !== undefined && p.valor !== '' ? num(p.valor) : num(c.valor),
          pago: !!p.pago,
          categoria: c.categoria || 'Custos fixos',
          descricao: c.nome,
          origem: 'custos',
          custoId: c.id,
          mes
        });
      }
    }
    return lista;
  };

  /* Relatório da empresa num período de meses (de..ate, AAAA-MM, inclusive):
     - contratos firmados no período (pelo início da vigência), separando novos e renovações;
     - recebimentos: parcelas de venda pagas pelos órgãos, pela data do pagamento;
     - pagamentos: parcelas de compra pagas aos fornecedores, pela data do pagamento;
     - gastos: despesas, custos fixos e mensalidade do contador do mês a que se referem (pagos ou não).
     'gastos' chega no formato das despesas ({ data, valor, pago, descricao, categoria, mes? }).
     Contratos cancelados ficam de fora. Devolve as listas, os totais e um resumo por mês. */
  C.relatorio = function (contratos, gastos, de, ate, hoje) {
    hoje = hoje || C.hoje();
    const dentro = (data) => !!data && C.mesDe(data) >= de && C.mesDe(data) <= ate;
    const validos = (contratos || []).filter(valido);
    const ren = C.renovacoes(validos, hoje);
    const r = { de, ate, contratos: [], recebimentos: [], pagamentos: [], gastos: [] };
    for (const c of validos) {
      const s = C.resumoContrato(c, hoje);
      const firmado = c.vigenciaInicio || c.dataEmpenho || c.dataEntrega;
      if (dentro(firmado)) {
        r.contratos.push({ contratoId: c.id, data: firmado, renovacao: !!ren[c.id], entregue: C.licencasEntregues(c, hoje, ren),
          venda: s.venda, compra: s.compra, impostos: centavos(s.impostoNF + s.impostoCompra), lucro: s.lucro });
      }
      const entregue = C.licencasEntregues(c, hoje, ren);
      ((c.venda && c.venda.parcelas) || []).forEach((p, i, todas) => {
        const data = p.pago ? p.dataPagamento || p.vencimento : '';
        if (dentro(data)) r.recebimentos.push({ contratoId: c.id, data, parcela: (i + 1) + '/' + todas.length, nf: p.nf || '', valor: centavos(num(p.valor)) });
      });
      ((c.compra && c.compra.parcelas) || []).forEach((p, i, todas) => {
        const data = p.pago ? p.dataPagamento || p.vencimento : '';
        if (dentro(data)) r.pagamentos.push({ contratoId: c.id, data, parcela: (i + 1) + '/' + todas.length, entregue, valor: centavos(num(p.valor)) });
      });
    }
    for (const g of gastos || []) {
      const mes = g.mes || C.mesDe(g.data);
      if (mes >= de && mes <= ate) r.gastos.push({ mes, data: g.data, descricao: g.descricao || 'Despesa', categoria: g.categoria || '', valor: centavos(num(g.valor)), pago: !!g.pago, dataPagamento: g.dataPagamento || '' });
    }
    const porData = (a, b) => (a.data || '').localeCompare(b.data || '');
    ['contratos', 'recebimentos', 'pagamentos', 'gastos'].forEach((k) => r[k].sort(porData));
    const soma = (lista, campo) => centavos(lista.reduce((t, x) => t + num(x[campo]), 0));
    const totais = (lista) => ({
      novos: lista.contratos.filter((x) => !x.renovacao).length,
      renovacoes: lista.contratos.filter((x) => x.renovacao).length,
      valorContratos: soma(lista.contratos, 'venda'),
      lucroContratos: soma(lista.contratos, 'lucro'),
      recebido: soma(lista.recebimentos, 'valor'),
      pago: soma(lista.pagamentos, 'valor'),
      gastos: soma(lista.gastos, 'valor'),
      gastosEmAberto: soma(lista.gastos.filter((x) => !x.pago), 'valor')
    });
    r.totais = totais(r);
    r.totais.saldo = centavos(r.totais.recebido - r.totais.pago - r.totais.gastos);
    r.meses = [];
    for (let mes = de; mes <= ate; mes = C.mesDe(C.addMeses(mes + '-01', 1))) {
      const doMes = (lista) => lista.filter((x) => (x.mes || C.mesDe(x.data)) === mes);
      const t = totais({ contratos: doMes(r.contratos), recebimentos: doMes(r.recebimentos), pagamentos: doMes(r.pagamentos), gastos: doMes(r.gastos) });
      t.saldo = centavos(t.recebido - t.pago - t.gastos);
      r.meses.push(Object.assign({ mes }, t));
    }
    return r;
  };

  raiz.GAH = raiz.GAH || {};
  raiz.GAH.calc = C;
  if (typeof module !== 'undefined' && module.exports) module.exports = C;
})(typeof window !== 'undefined' ? window : globalThis);
