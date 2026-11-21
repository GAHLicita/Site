# Combinados com a usuária (sistema GAH Licita)

- Nunca remover nenhuma informação, quadro, coluna, campo ou função do sistema sem perguntar antes e
  receber o ok. Isso vale também para remoções "de passagem" ao reorganizar telas (ex.: um texto de apoio,
  uma porcentagem, uma coluna escondida em telas pequenas). Na dúvida, manter e perguntar.
- O repositório é público: nunca colocar dados de clientes, contatos, valores ou e-mails no código.
  Dados entram só pelo Firestore (arquivos de importação entregues fora do repositório).
- O e-mail da empresa é contato@gahlicita.com.br.
- A cada publicação do sistema, atualizar `versao.json` e o `?v=` dos arquivos em `index.html` com o mesmo número
  (faz o navegador baixar o CSS/JS novos em vez de usar o cache). Comando:
  `V=$(date -u +%Y%m%d%H%M%S); echo "{\"versao\": \"$V\"}" > versao.json; sed -i -E "s/(\.(css|js))(\?v=[0-9]+)?\"/\1?v=$V\"/g" index.html`
