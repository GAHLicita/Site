# Sistema GAH Licita

Sistema interno para controlar órgãos, contratos, recebimentos, compras de licenças,
agenda de disputas, licitações e despesas. Fica no mesmo GitHub Pages do site, em
**https://www.gahlicita.com.br/sistema/**.

O site não aparece no Google (`noindex`) e não há link para ele no site institucional.

## Como funciona

| Parte | Onde fica |
|---|---|
| Telas do sistema (HTML, CSS, JavaScript) | Este repositório, pasta `sistema/`, publicada pelo GitHub Pages |
| Login com e-mail e senha | Firebase Authentication (Google), plano gratuito |
| Dados (clientes, contratos, parcelas…) | Firebase Firestore (Google), plano gratuito, servidor em São Paulo |

O repositório do site é **público**, então nenhum dado de cliente fica nele. Os dados
ficam só no Firestore, e as regras do arquivo `firestore.rules` deixam entrar apenas os
e-mails autorizados.

Enquanto o arquivo `js/config.js` estiver vazio, o sistema abre em **modo demonstração**:
qualquer e-mail e senha entram e os dados ficam só no navegador de quem está usando.

## Ligar o login e o banco de dados (uma vez só, uns 15 minutos)

1. Entre em <https://console.firebase.google.com> com a conta Google da empresa e clique
   em **Criar projeto**. Nome sugerido: `gah-sistema`. O Google Analytics pode ficar desligado.
2. **Login**: menu *Criação → Authentication → Vamos começar*. Em *Método de login*,
   escolha **E-mail/senha** e ative.
3. **Usuários**: ainda em Authentication, aba *Usuários → Adicionar usuário*. Cadastre o
   e-mail e a senha de cada pessoa que vai usar o sistema.
4. **Bloquear cadastros de estranhos**: Authentication → *Configurações → Ações do usuário*
   → desmarque **Ativar criação (inscrição)** e salve.
5. **Domínio do site**: Authentication → *Configurações → Domínios autorizados → Adicionar
   domínio* → inclua `www.gahlicita.com.br` e `gahlicita.com.br`.
6. **Banco de dados**: menu *Criação → Firestore Database → Criar banco de dados* →
   local **southamerica-east1 (São Paulo)** → **modo de produção**.
7. **Regras de segurança**: no Firestore, aba *Regras*. Apague o que estiver lá, cole o
   conteúdo do arquivo [`firestore.rules`](firestore.rules) (com os e-mails autorizados)
   e clique em **Publicar**.
8. **Chaves do app**: ícone de engrenagem → *Configurações do projeto* → em *Seus apps*
   clique no ícone **`</>`** (Web) → dê um nome (ex.: `sistema`) → **Registrar app**.
   Aparece um bloco `firebaseConfig` com `apiKey`, `authDomain`, `projectId` etc.
9. Copie esses valores para o arquivo [`js/config.js`](js/config.js) e salve no GitHub
   (ou mande os valores para o Claude fazer isso). Essas chaves não são secretas: quem
   protege os dados são as regras do passo 7.
10. Em 1 ou 2 minutos o GitHub Pages atualiza. Abra
    <https://www.gahlicita.com.br/sistema/>, entre com seu e-mail e senha, vá em
    **Ajustes → Importar dados** e escolha o arquivo `importacao-planilha-faturamento.json`
    (gerado a partir da planilha Faturamento). Pronto, os dados aparecem em qualquer
    computador.

### Para dar acesso a outra pessoa

Crie o usuário em *Authentication → Usuários*, inclua o e-mail na lista de
`firestore.rules` e publique as regras de novo no Firestore (passo 7).

### Esqueceu a senha?

Na tela de login, digite o e-mail e clique em **Esqueci minha senha**. O Firebase manda um
link para criar uma senha nova.

## Telas

- **Início**: recebimentos em atraso, o que entra e sai nos próximos 30 dias, agenda da
  quinzena e contratos perto do fim da vigência (oportunidade de renovação).
- **Financeiro**: valor total em contratos, recebido, a receber, a pagar das compras,
  impostos, lucro bruto e líquido, mapa dos estados atendidos, faturamento mês a mês
  (igual à aba "Faturamento" da planilha), previsão de caixa e vendas por fabricante.
- **Clientes**: lista de órgãos e a ficha de cada um, com contatos (quantos precisar, com
  telefone e WhatsApp), **faturamento** (e-mail para enviar a NF, responsável, telefone,
  onde enviar e o que precisa constar na nota), link da pasta no Drive, CNPJ e endereço,
  e todos os contratos com as parcelas. Tudo editável em "Editar dados".
- **Contratos**: todos os contratos numa tabela, com filtros por situação, forma de
  recebimento e ano. A lista começa pelos que terminam a vigência mais cedo; no fim ficam os
  vencidos sem renovação, os contratos anteriores já renovados e os cancelados. Uma renovação
  (contrato novo do mesmo órgão e fabricante, começando perto do fim do anterior) mostra a vigência
  do contrato atual até você clicar em **Licenças entregues**; daí passa a mostrar a nova vigência.
  Para lançar uma renovação, abra o contrato atual e clique em **Renovar**: o formulário já vem com o
  mesmo órgão, licença, fabricante e valores, e a vigência começando no dia seguinte ao fim do atual.
- **Agenda**: calendário com disputas, reuniões e prazos. Entram sozinhos: fins de vigência, datas de
  disputa das licitações e as despesas ainda não pagas no dia do vencimento (despesas avulsas, custos fixos,
  mensalidade do contador e guias da Contabilidade), que somem quando marcadas como pagas. Parcelas a receber
  e parcelas da compra das licenças não entram.
- **Licitações**: editais em análise, propostas, disputas, ganhas e perdidas. Uma licitação
  ganha vira contrato com um clique.
- **Despesas**: todos os gastos da empresa num lugar só. Mostra o que foi gasto em cada mês (custos
  fixos, mensalidade do contador e despesas avulsas), com botão "Paguei" em cada item, uma tabela mês a
  mês do ano e a grade dos **custos fixos** (hospedagem do site, plano de e-mail, domínio, portais de
  disputa, assinaturas…), onde cada mês pode ser marcado como pago, ter o valor mudado ou ficar sem cobrança.
- **Contabilidade**: mensalidade do contador em cada mês (valor pago, se já pagou e quando),
  dados do escritório contábil (contador, telefone, honorário, regime)
  e uma pasta por mês com as guias (DAS, DARF, INSS…) e documentos enviados pelo contador,
  cada um com link para o arquivo no Drive, valor, vencimento e se já foi paga. Guias com
  valor podem entrar automaticamente nas Despesas.
- **Contas bancárias**: banco, agência, conta, titular e chaves Pix de cada conta da
  empresa, com botão para copiar os dados e mandar aos órgãos. Não guarde senhas ali.
- **Relatório** (botão ao lado de Ajustes): balancete da empresa de um mês ou de um ano, para imprimir,
  salvar em PDF ou baixar como planilha (.csv). Traz o resumo e o balancete do período (receitas recebidas dos
  órgãos; saídas: compra das licenças, impostos e despesas e custos; resultado), o mês a mês (no relatório do
  ano), os impostos (guias DAS, DARF, INSS, FGTS e ISS da Contabilidade, pelo mês do vencimento; a guia também
  lançada nas Despesas conta uma vez só, como imposto), os contratos
  firmados ou renovados (pelo início da vigência, com a situação da entrega), os recebimentos e os pagamentos
  das licenças (pela data do pagamento) e as despesas e custos (pelo mês a que se referem, até o mês atual).
  Contratos cancelados ficam de fora.
- **Ajustes** (botão ao lado de Sair): impostos padrão, tema claro/escuro, backup (.json), exportação para Excel
  (.csv) e importação de dados.

## Como o sistema calcula

- **Licenças não entregues (Contratos)**: opção do filtro de situação; mostra contratos novos e renovações cujas
  licenças ainda não foram entregues (cancelados ficam de fora).
- **Filtro por cartão (Contratos)**: os filtros "Forma da compra" (à vista / parcelada), "Forma de pagamento"
  (real, dólar, cartão de crédito, não informada) e "Cartão da compra" (só aparece com Cartão de crédito) se
  combinam com os demais (ex.: recebimento integral + compra parcelada + cartão X). Com um cartão escolhido, aparece
  o quadro "Parcelas no cartão", fatura a fatura, com órgão, licença, parcela, valor e situação de cada uma.
- **Qual cartão**: em custos fixos e despesas avulsas, escolha a forma de pagamento; com "Cartão de crédito",
  informe banco, bandeira e os 4 últimos dígitos (ou escolha em "Cartão já usado"). O cartão aparece na grade
  de custos fixos, nos gastos do mês, na Agenda e no Relatório. A compra das licenças também tem "Cartão já usado".
- **Compra no cartão de crédito**: em "Pago com", escolha Cartão de crédito e informe as parcelas no cartão e o
  **vencimento da fatura**. A compra vira uma parcela por fatura (a 1ª no vencimento informado, as demais nos meses
  seguintes) e fica em "a pagar" até você marcar como paga, quando pagar a fatura. Vale também na compra por licença.
- **Compra por licença**: em "Compra da licença", escolha "Cada licença com a sua forma de pagamento" quando
  o contrato tiver licenças compradas de jeitos diferentes (uma à vista, outra parcelada). Cada licença, em
  "Licenças do contrato", ganha a sua compra: forma, valor, nº de parcelas, 1º pagamento e com o que foi paga.
  As parcelas de todas as licenças formam a compra do contrato (pago e falta pagar), e o quadro do contrato
  mostra o pago e o que falta de cada licença. O lucro de cada fabricante usa a compra real das licenças dele.
  Licenças pagas no **mesmo cartão** (mesmo banco e final) com o mesmo vencimento de fatura viram **uma parcela só**,
  com o valor somado (ex.: 2 licenças em 12x no mesmo cartão = 12 parcelas); o pago e o que falta de cada licença
  continuam separados no quadro do contrato.

- **Faturamento da NF**: cada parcela de venda é uma NF (integral = uma NF; mensal = uma NF por mês). No contrato,
  informe a data do faturamento (no mensal, a 1ª; as demais seguem o mesmo dia dos meses seguintes). A Agenda (e o
  Google Agenda, sem alarme) mostra "Emitir NF" nesse dia até a NF ser marcada como enviada: na coluna NF de
  "Ver parcelas" ou, no integral, em "NF já emitida e enviada ao órgão".
- **Entrega das licenças**: contrato novo fica "Pendente de entrega". Quando entregar, clique em
  **Licenças entregues** (na lista de Contratos ou no contrato, na ficha do órgão) ou escolha "Entregue" no
  formulário. Pendente ou entregue, o contrato já conta em todo o Início na visão "Total".

- **Contrato fechado e ainda não entregue** (sem data de entrega e sem o ok de "Licenças entregues"): se o mês
  dos valores em aberto já passou, eles andam sozinhos para o mês atual no Início (tabela mês a mês, gráfico,
  previsão de caixa e quadros), com a etiqueta "adiado". O contrato salvo não muda.

- Na tabela **Valores mês a mês** e na **Previsão de caixa**, clique no mês para ver de quais contratos
  (e de quais despesas) vem cada valor; clique no contrato para abri-lo.

- **Previsão de caixa — recebimento do órgão**: a 1ª parcela da venda é prevista no mês da entrega das
  licenças (data da entrega; se ainda não entregue, o início da vigência ou o mês atual). Se não for paga, passa
  para o mês atual a cada virada de mês, marcada como atrasada. As demais parcelas seguem o vencimento.

- **Total × Só licenças entregues** (Início e Contratos): "Total" conta todos os contratos, inclusive
  renovações já fechadas mas com licenças ainda não entregues (situação futura). "Só licenças entregues"
  conta apenas os contratos já entregues (situação atual), com as parcelas a receber e a pagar em aberto
  deles. A escolha vale nas duas telas enquanto você estiver no sistema; a cada novo acesso (login) tudo volta para "Total".

- **Imposto da NF** = valor de venda × % da NF.
- **Imposto na compra** = valor de compra × % informado (IOF, câmbio etc.).
- **Lucro do contrato** = venda − compra − imposto da NF − imposto da compra.
- **Lucro líquido da empresa** = soma dos lucros dos contratos − despesas − custos fixos −
  mensalidades do contador (até o mês atual).
- Custos fixos e mensalidades entram no mês a que se referem, mesmo que tenham sido pagos depois,
  e aparecem sozinhos na tela Despesas, na Agenda (vencimentos) e na previsão de caixa.
- **Valores mês a mês** (o que foi vendido e o lucro de cada mês): a venda entra no mês da emissão da NF (ou do
  vencimento, se não houver emissão). Cada parcela de compra (e o imposto da compra) entra no mês do seu vencimento;
  a que vence depois da última NF do contrato é trazida para o mês dessa última NF. Assim, venda integral com compra
  parcelada abate o custo inteiro no mês da venda (parcelas ainda não pagas não viram lucro), e venda mensal com
  compra mensal mostra em cada mês o que foi pago nele. Quando o dinheiro sai de fato fica na previsão de caixa.
- Contratos **cancelados** não entram em nenhum total.

## Testes

```
node --test sistema/testes/calculos.test.js
```

## Google Agenda (sincronização nos dois sentidos)

O que o sistema faz depois de ligado:
- Compromissos da Agenda e datas de disputa das Licitações vão para o Google Agenda da conta
  contato@gahlicita.com.br (disputas em azul). Alterar ou excluir no sistema altera ou exclui no Google.
- Os fins de vigência (vermelho) e as despesas a pagar (laranja) também vão, do dia de hoje em diante.
  Parcelas a receber e parcelas da compra das licenças não vão.
- **Alarmes**: só as disputas (licitações e compromissos do tipo Disputa com horário) avisam no celular,
  15 minutos antes. Fins de vigência, pagamentos e os demais compromissos ficam no Google sem alarme. Quando uma parcela é
  paga ou uma data muda no sistema, o Google é atualizado sozinho em alguns segundos. Esses eventos
  devem ser alterados no sistema, não no Google.
- Os eventos do Google Agenda aparecem no calendário do sistema (com uma faixa azul do Google).
  Clicar neles abre o evento no Google.
- Se um compromisso criado pelo sistema for remarcado ou apagado no Google, o sistema acompanha.
- O que for salvo sem conexão fica "pendente" e vai para o Google quando você conectar.

Para ligar (uma vez só, no https://console.cloud.google.com com a conta contato@gahlicita.com.br):
1. No topo, selecione o projeto **gah-sistema** (o mesmo do Firebase).
2. Menu → **APIs e serviços → Biblioteca** → procure **Google Calendar API** → **Ativar**.
3. Menu → **APIs e serviços → Tela de consentimento OAuth** (ou **Google Auth Platform**) →
   **Começar**. Nome do app: `Sistema GAH Licita`; e-mail de suporte: contato@gahlicita.com.br;
   Público: **Interno** (só contas @gahlicita.com.br); contato: contato@gahlicita.com.br → Criar.
4. Menu → **APIs e serviços → Credenciais → Criar credenciais → ID do cliente OAuth**.
   Tipo: **Aplicativo da Web**; nome: `Sistema GAH Licita`.
   Em **Origens JavaScript autorizadas**, adicione `https://www.gahlicita.com.br` e
   `https://gahlicita.com.br`. Deixe "URIs de redirecionamento" vazio → **Criar**.
5. Copie o **ID do cliente** (termina em `.apps.googleusercontent.com`) e cole em `clientId` no
   arquivo `js/config.js` (ou mande para o Claude fazer isso).

No dia a dia: na primeira vez em cada computador, abra a Agenda e clique em **Conectar Google Agenda**.
Depois disso, a cada login o sistema conecta e sincroniza o Google sozinho (uma janelinha do Google pode
abrir e fechar rapidamente). Se o navegador bloquear essa janelinha, permita pop-ups para
www.gahlicita.com.br ou clique em **Reconectar** na Agenda.

## Aviso de versão nova

O arquivo `versao.json` muda a cada publicação (um gancho de commit atualiza a data sozinho quando algo em
`sistema/` muda). Com o sistema aberto, ele confere esse arquivo a cada 3 minutos e quando a aba volta a ficar
visível; se mudou, aparece a faixa "Há uma versão nova do sistema" com o botão **Atualizar agora**. Na tela de
login a página atualiza sozinha.
