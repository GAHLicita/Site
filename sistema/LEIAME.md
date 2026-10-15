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
  recebimento e ano.
- **Agenda**: calendário com disputas, reuniões e prazos. Vencimentos de parcelas, fins de
  vigência e datas de disputa das licitações entram sozinhos.
- **Licitações**: editais em análise, propostas, disputas, ganhas e perdidas. Uma licitação
  ganha vira contrato com um clique.
- **Despesas**: contador, DAS e outros custos fixos, que entram no lucro líquido.
- **Contabilidade**: dados do escritório contábil (contador, telefone, honorário, regime)
  e uma pasta por mês com as guias (DAS, DARF, INSS…) e documentos enviados pelo contador,
  cada um com link para o arquivo no Drive, valor, vencimento e se já foi paga. Guias com
  valor podem entrar automaticamente nas Despesas.
- **Contas bancárias**: banco, agência, conta, titular e chaves Pix de cada conta da
  empresa, com botão para copiar os dados e mandar aos órgãos. Não guarde senhas ali.
- **Ajustes** (botão ao lado de Sair): impostos padrão, tema claro/escuro, backup (.json), exportação para Excel
  (.csv) e importação de dados.

## Como o sistema calcula

- **Imposto da NF** = valor de venda × % da NF.
- **Imposto na compra** = valor de compra × % informado (IOF, câmbio etc.).
- **Lucro do contrato** = venda − compra − imposto da NF − imposto da compra.
- **Lucro líquido da empresa** = soma dos lucros dos contratos − despesas.
- **Faturamento mensal**: a venda entra no mês da emissão da NF (ou do vencimento, se não
  houver emissão); a compra entra no mês do pagamento.
- Contratos **cancelados** não entram em nenhum total.

## Testes

```
node --test sistema/testes/calculos.test.js
```
