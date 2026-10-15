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
    venda: { aliquotaNF: 10, parcelas: [{ valor: 1000, emissao: '2026-08-20', vencimento: '2026-09-29', pago: true }] },
    compra: { aliquotaCompra: 0, parcelas: [{ valor: 700, vencimento: '2026-08-20', pago: true }] }
  };
  const m = calc.faturamentoMensal([c], [{ valor: 50, data: '2026-08-10' }], 2026);
  assert.deepStrictEqual(m[7], { mes: '2026-08', venda: 1000, compra: 700, impostos: 100, despesas: 50, lucro: 150 });
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
