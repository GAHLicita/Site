// Testes dos cálculos financeiros. Rode com: node --test sistema/testes
const test = require('node:test');
const assert = require('node:assert');
const calc = require('../js/calculos.js');

test('gerarParcelas divide o total e joga os centavos na última', () => {
  const p = calc.gerarParcelas(1000, 3, '2026-01-31');
  assert.deepStrictEqual(p.map((x) => x.valor), [333.33, 333.33, 333.34]);
  assert.deepStrictEqual(p.map((x) => x.vencimento), ['2026-01-31', '2026-02-28', '2026-03-31']);
});

test('resumoContrato soma recebido, a receber, parcelas e lucro', () => {
  const c = {
    venda: { aliquotaNF: 10, parcelas: [
      { valor: 500, vencimento: '2026-01-10', pago: true },
      { valor: 500, vencimento: '2026-02-10', pago: false },
      { valor: 500, vencimento: '2026-03-10', pago: false }
    ] },
    compra: { aliquotaCompra: 2, parcelas: [
      { valor: 400, vencimento: '2026-01-05', pago: true },
      { valor: 400, vencimento: '2026-02-05', pago: false }
    ] },
    vigenciaFim: '2026-03-31'
  };
  const s = calc.resumoContrato(c, '2026-02-20');
  assert.strictEqual(s.venda, 1500);
  assert.strictEqual(s.recebido, 500);
  assert.strictEqual(s.aReceber, 1000);
  assert.strictEqual(s.parcelasReceber, 2);
  assert.strictEqual(s.parcelasAtrasadas, 1);
  assert.strictEqual(s.aPagar, 400);
  assert.strictEqual(s.parcelasPagar, 1);
  assert.strictEqual(s.impostoNF, 150);
  assert.strictEqual(s.impostoCompra, 16);
  assert.strictEqual(s.lucro, 534);
  assert.strictEqual(s.vigencia, 'vencendo');
});

test('faturamentoMensal usa a emissão da NF para venda e o vencimento para compra', () => {
  const c = {
    id: 'x',
    venda: { aliquotaNF: 10, parcelas: [{ valor: 1000, emissao: '2026-08-20', vencimento: '2026-09-29', pago: true }] },
    compra: { aliquotaCompra: 0, parcelas: [{ valor: 700, vencimento: '2026-08-20', pago: true }] }
  };
  const m = calc.faturamentoMensal([c], [{ valor: 50, data: '2026-08-10', descricao: 'Contador' }], 2026);
  const { mes, venda, compra, impostos, despesas, lucro } = m[7];
  assert.deepStrictEqual({ mes, venda, compra, impostos, despesas, lucro }, { mes: '2026-08', venda: 1000, compra: 700, impostos: 100, despesas: 50, lucro: 150 });
  assert.deepStrictEqual(m[7].contratos, [{ contratoId: 'x', venda: 1000, compra: 700, impostos: 100, lucro: 200 }]);
  assert.deepStrictEqual(m[7].gastos, [{ descricao: 'Contador', categoria: '', valor: 50, pago: false }]);
  assert.strictEqual(m[8].venda, 0);
});

test('resumoGeral ignora cancelados e conta órgãos e estados', () => {
  const clientes = [{ id: 'a', uf: 'SC' }, { id: 'b', uf: 'SP' }, { id: 'c', uf: 'PR' }];
  const contratos = [
    { clienteId: 'a', venda: { parcelas: [{ valor: 100, pago: true }] }, compra: { parcelas: [] } },
    { clienteId: 'b', venda: { parcelas: [{ valor: 200, pago: false, vencimento: '2099-01-01' }] }, compra: { parcelas: [] } },
    { clienteId: 'c', status: 'cancelado', venda: { parcelas: [{ valor: 999 }] }, compra: { parcelas: [] } }
  ];
  const g = calc.resumoGeral(contratos, [{ valor: 30, pago: true }], clientes, '2026-10-15');
  assert.strictEqual(g.totalContratos, 300);
  assert.strictEqual(g.aReceber, 200);
  assert.strictEqual(g.lucroLiquido, 270);
  assert.strictEqual(g.orgaosAtendidos, 2);
  assert.deepStrictEqual(g.estados, ['SC', 'SP']);
});

test('previsaoCaixa joga atrasados no mês atual', () => {
  const c = { venda: { parcelas: [{ valor: 100, vencimento: '2026-08-01', pago: false }, { valor: 50, vencimento: '2026-11-05', pago: false }] }, compra: { parcelas: [{ valor: 30, vencimento: '2026-10-20', pago: false }] } };
  const p = calc.previsaoCaixa([c], [], '2026-10-15', 3);
  assert.deepStrictEqual(p.map((x) => [x.mes, x.entra, x.sai]), [['2026-10', 100, 30], ['2026-11', 50, 0], ['2026-12', 0, 0]]);
});

test('custosNoPeriodo gera um lançamento por mês, respeita anual, fim e meses sem cobrança', () => {
  const custos = [
    { id: 'h', nome: 'Hospedagem', valor: 50, periodicidade: 'mensal', inicio: '2026-08', diaVencimento: 31,
      pagamentos: { '2026-08': { pago: true, valor: 55, data: '2026-09-02' }, '2026-10': { semCobranca: true } } },
    { id: 'd', nome: 'Domínio', valor: 40, periodicidade: 'anual', inicio: '2025-11' },
    { id: 'x', nome: 'Antigo', valor: 10, inicio: '2026-01', fim: '2026-02' }
  ];
  const contab = [{ id: '2026-09', mensalidade: { valor: 350, pago: true, data: '2026-10-05' } }, { id: 'escritorio' }];
  const l = calc.custosNoPeriodo(custos, contab, '2026-11');
  const h = l.filter((x) => x.custoId === 'h');
  assert.deepStrictEqual(h.map((x) => [x.mes, x.valor, x.pago, x.data]), [
    ['2026-08', 55, true, '2026-08-31'], ['2026-09', 50, false, '2026-09-30'], ['2026-11', 50, false, '2026-11-30']]);
  assert.deepStrictEqual(l.filter((x) => x.custoId === 'd').map((x) => x.mes), ['2025-11', '2026-11']);
  assert.deepStrictEqual(l.filter((x) => x.custoId === 'x').map((x) => x.mes), ['2026-01', '2026-02']);
  const c = l.find((x) => x.origem === 'contabilidade');
  assert.strictEqual(c.data, '2026-09-10');
  assert.strictEqual(c.valor, 350);
  const m = calc.faturamentoMensal([], l, 2026);
  assert.strictEqual(m[8].despesas, 400); // setembro: hospedagem 50 + contador 350
  assert.strictEqual(m[8].lucro, -400);
});

test('vendasPorFabricante divide contrato com licenças de vários fabricantes', () => {
  const contrato = (fornecedor, itens) => ({ fornecedor, itens, venda: { aliquotaNF: 0, parcelas: [{ valor: 1000, vencimento: '2026-01-10' }] }, compra: { parcelas: [{ valor: 600, vencimento: '2026-01-05' }] } });
  const r = calc.vendasPorFabricante([
    contrato('OpenAI'),
    contrato('', [{ fornecedor: 'OpenAI', valor: 750 }, { fornecedor: 'Google', valor: 250 }]),
    contrato(''),
    Object.assign(contrato('Zoom'), { status: 'cancelado' })
  ], '2026-02-01');
  assert.deepStrictEqual(r.map((x) => [x.fabricante, x.n, x.venda, x.lucro]), [
    ['OpenAI', 2, 1750, 700], ['Sem fabricante', 1, 1000, 400], ['Google', 1, 250, 100]
  ]);
});

test('renovacoes liga o contrato novo ao anterior e fica pendente até entregar', () => {
  const c = (id, ini, fim, extra) => Object.assign({ id, clienteId: 'o1', fornecedor: 'OpenAI', vigenciaInicio: ini, vigenciaFim: fim }, extra);
  const lista = [
    c('a', '2025-12-02', '2026-12-01'),
    c('b', '2026-12-02', '2027-12-01', { dataEntrega: '' }),
    c('x', '2026-01-05', '2027-01-04'),
    c('y', '2027-01-20', '2028-01-19', { licencasEntregues: true }),
    c('z', '2025-01-01', '2025-12-31', { fornecedor: 'Zoom' })
  ];
  const r = calc.renovacoes(lista, '2026-10-17');
  assert.deepStrictEqual(r.b, { anterior: 'a', pendente: true });
  assert.deepStrictEqual(r.y, { anterior: 'x', pendente: false });
  assert.strictEqual(r.a, undefined);
  assert.strictEqual(r.porAnterior.a, 'b');
  assert.strictEqual(r.z, undefined);
});

test('licencasEntregues: renovação pendente não conta; demais pela data de entrega', () => {
  const hoje = '2026-10-17';
  const ren = { b: { anterior: 'a', pendente: true }, c: { anterior: 'x', pendente: false } };
  assert.strictEqual(calc.licencasEntregues({ id: 'b', dataEntrega: '2026-01-01' }, hoje, ren), false);
  assert.strictEqual(calc.licencasEntregues({ id: 'c' }, hoje, ren), true);
  assert.strictEqual(calc.licencasEntregues({ id: 'd', dataEntrega: '2026-11-01' }, hoje, ren), false);
  assert.strictEqual(calc.licencasEntregues({ id: 'e', dataEntrega: '2026-10-17' }, hoje, ren), true);
  assert.strictEqual(calc.licencasEntregues({ id: 'f', vigenciaInicio: '2027-01-01' }, hoje, ren), false);
  assert.strictEqual(calc.licencasEntregues({ id: 'h', vigenciaInicio: '2026-01-01' }, hoje, ren), false); // sem data de entrega = não entregue
  assert.strictEqual(calc.licencasEntregues({ id: 'g', licencasEntregues: true, dataEntrega: '2027-01-01' }, hoje, ren), true);
});

test('previsaoCaixa detalha entradas e saídas por contrato', () => {
  const c = { id: 'k', venda: { parcelas: [{ valor: 300, vencimento: '2026-09-10' }, { valor: 200, vencimento: '2026-11-10' }] }, compra: { parcelas: [{ valor: 150, vencimento: '2026-10-05' }] } };
  const p = calc.previsaoCaixa([c], [{ valor: 40, data: '2026-10-20', descricao: 'E-mail' }], '2026-10-01', 3);
  assert.deepStrictEqual(p[0].contratos, [{ contratoId: 'k', entra: 300, sai: 150, recebido: 0, pago: 0, atrasado: true }]);
  assert.strictEqual(p[0].gastos[0].descricao, 'E-mail');
  assert.deepStrictEqual(p[1].contratos, [{ contratoId: 'k', entra: 200, sai: 0, recebido: 0, pago: 0, atrasado: false }]);
  // compra já paga no mês atual continua aparecendo como saída daquele mês, marcada como paga
  const c2 = { id: 'z', venda: { parcelas: [{ valor: 500, vencimento: '2026-10-10', pago: true, dataPagamento: '2026-10-12' }] }, compra: { parcelas: [{ valor: 320, vencimento: '2026-10-05', pago: true, dataPagamento: '2026-10-06' }, { valor: 99, vencimento: '2026-09-05', pago: true, dataPagamento: '2026-09-06' }] } };
  const q = calc.previsaoCaixa([c2], [{ valor: 30, data: '2026-10-02', pago: true, descricao: 'Domínio' }], '2026-10-15', 2);
  assert.strictEqual(q[0].entra, 500);
  assert.strictEqual(q[0].sai, 350);
  assert.deepStrictEqual(q[0].contratos, [{ contratoId: 'z', entra: 500, sai: 320, recebido: 500, pago: 320, atrasado: false }]);
  assert.strictEqual(q[0].gastos[0].pago, true);
});

test('adiarNaoEntregues leva para o mês atual o contrato fechado e não entregue', () => {
  const nao = { id: 'n', clienteId: 'o', vigenciaInicio: '2026-12-01', vigenciaFim: '2027-11-30',
    venda: { parcelas: [{ valor: 100, vencimento: '2026-09-10' }, { valor: 100, vencimento: '2026-10-10' }] },
    compra: { parcelas: [{ valor: 60, vencimento: '2026-09-05' }] } };
  const entregue = { id: 'e', clienteId: 'p', dataEntrega: '2026-08-01', vigenciaInicio: '2026-08-01', vigenciaFim: '2027-07-31',
    venda: { parcelas: [{ valor: 50, vencimento: '2026-09-10' }] }, compra: { parcelas: [] } };
  const [a, b] = calc.adiarNaoEntregues([nao, entregue], '2026-11-20');
  assert.deepStrictEqual(a.venda.parcelas.map((p) => p.vencimento), ['2026-11-20', '2026-12-10']);
  assert.deepStrictEqual(a.compra.parcelas.map((p) => p.vencimento), ['2026-11-20']);
  assert.strictEqual(a.adiadoMeses, 2);
  assert.strictEqual(b, entregue); // entregue não muda (atrasado continua atrasado)
  assert.strictEqual(nao.venda.parcelas[0].vencimento, '2026-09-10'); // original intacto
});

test('relatorio junta contratos firmados, recebimentos, pagamentos e gastos do período', () => {
  const antigo = { id: 'a', clienteId: 'o', fornecedor: 'F', vigenciaInicio: '2025-10-01', vigenciaFim: '2026-09-30', licencasEntregues: true,
    venda: { aliquotaNF: 10, parcelas: [{ valor: 1000, vencimento: '2025-11-01', pago: true, dataPagamento: '2025-11-03' }] },
    compra: { parcelas: [{ valor: 600, vencimento: '2025-10-01', pago: true, dataPagamento: '2025-10-01' }] } };
  const renov = { id: 'r', clienteId: 'o', fornecedor: 'F', vigenciaInicio: '2026-10-01', vigenciaFim: '2027-09-30',
    venda: { aliquotaNF: 10, parcelas: [{ valor: 500, vencimento: '2026-10-20', pago: true, dataPagamento: '2026-11-02', nf: '12' }, { valor: 500, vencimento: '2026-11-20' }] },
    compra: { parcelas: [{ valor: 700, vencimento: '2026-10-05', pago: true, dataPagamento: '2026-10-06' }] } };
  const novo = { id: 'n', clienteId: 'x', fornecedor: 'G', vigenciaInicio: '2026-10-15', vigenciaFim: '2027-10-14',
    venda: { parcelas: [{ valor: 300, vencimento: '2026-10-30', pago: true }] }, compra: { parcelas: [] } };
  const cancelado = Object.assign({}, novo, { id: 'c', status: 'cancelado' });
  const gastos = [{ data: '2026-10-10', valor: 50, pago: true, descricao: 'Site' }, { data: '2026-11-05', valor: 99, descricao: 'Fora' },
    { data: '2026-10-10', mes: '2026-10', valor: 500, pago: false, descricao: 'Mensalidade do contador' }];
  const guias = [{ data: '2026-10-20', mes: '2026-09', valor: 120, pago: true, descricao: 'DAS' }, { data: '2026-11-20', mes: '2026-10', valor: 90, descricao: 'DAS' }];
  const r = calc.relatorio([antigo, renov, novo, cancelado], gastos, '2026-10', '2026-10', '2026-10-20', guias);
  assert.deepStrictEqual(r.contratos.map((x) => [x.contratoId, x.renovacao]), [['r', true], ['n', false]]);
  assert.deepStrictEqual(r.recebimentos.map((x) => [x.contratoId, x.valor]), [['n', 300]]); // sem data de pagamento: vale o vencimento
  assert.deepStrictEqual(r.pagamentos.map((x) => [x.contratoId, x.valor, x.entregue]), [['r', 700, false]]);
  assert.strictEqual(r.gastos.length, 2);
  assert.deepStrictEqual(
    [r.totais.novos, r.totais.renovacoes, r.totais.valorContratos, r.totais.recebido, r.totais.pago, r.totais.gastos, r.totais.gastosEmAberto, r.totais.impostos, r.totais.saldo],
    [1, 1, 1300, 300, 700, 550, 500, 120, -1070]); // DAS pelo mês do vencimento (a de competência outubro vence em novembro)
  const ano = calc.relatorio([antigo, renov, novo], gastos, '2026-01', '2026-12', '2026-10-20', guias);
  assert.strictEqual(ano.meses[10].impostos, 90);
  assert.strictEqual(ano.meses.length, 12);
  assert.strictEqual(ano.meses[10].recebido, 500); // recebido em novembro
  assert.strictEqual(ano.meses[9].pago, 700);
});
