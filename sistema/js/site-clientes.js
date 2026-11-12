/* Órgãos no site da empresa (seção "Órgãos que confiam na GAH Licita").
   Cada órgão com contrato não cancelado aparece no site com o nome, a descrição curta e a logo do cadastro
   (parte "No site" do formulário do órgão), a menos que "Mostrar no site" esteja desmarcado. O sistema publica
   essa lista junto com os números do site (publico/numeros no Firestore); o site monta a seção a partir dela.
   Só vai a público o que o site já mostra: nome, descrição e logo. */
(function () {
  const D = GAH.dados;

  /* Como o site estava antes do cadastro "No site": [código do órgão (ou nome:… para achar pelo nome),
     nome, descrição, logo]. Vale para o órgão que ainda não tem a parte "No site" salva; a ordem é a do site. */
  const SITE_INICIAL = [
    ["684ad7b2c0ed", "FUNCAP", "Fundação Cearense de Apoio — CE", "logos/ceara.png"],
    ["7bc4892eeeba", "Secretaria da Fazenda", "Governo do Ceará — CE", "logos/ceara.png"],
    ["72dd87b2bef2", "SGG Goiás", "Secretaria-Geral de Governo — GO", "logos/goias.png"],
    ["6c1ce7c214ca", "Prefeitura de Jaguariúna", "Município de Jaguariúna — SP", "logos/jaguariuna.png"],
    ["63765cb00e83", "Prefeitura de Lins", "Município de Lins — SP", "logos/lins.png"],
    ["e5cba130fc67", "Prefeitura de Concórdia", "Município de Concórdia — SC", "logos/concordia.png"],
    ["0a38927f75da", "Nova Ubiratã", "Município de Nova Ubiratã — MT", "logos/novaubirata.png"],
    ["5bcb658812f5", "MTI Mato Grosso", "Empresa Mato-grossense de Tecnologia — MT", "logos/mato-grosso.png"],
    ["4b9723f5e931", "Senado Federal", "Congresso Nacional — DF", "logos/senado.png"],
    ["3d9b703ab643", "Prefeitura de Recife", "Município de Recife — PE", "logos/recife.png"],
    ["79199a8c9151", "Câmara de Sertãozinho", "Câmara Municipal — SP", "logos/camarasertaozinho.png"],
    ["nome:niquelandia", "Prefeitura de Niquelândia", "Município de Niquelândia — GO", "logos/niquelandia.png"],
    ["417d34397d05", "Prefeitura de Terra Rica", "Município de Terra Rica — PR", "logos/terrarica.png"],
    ["b430d9990f04", "Câmara de Serrana", "Câmara Municipal — SP", "logos/camaraserrana.png"],
    ["bab5ce588b8d", "Câmara de Indaiatuba", "Câmara Municipal — SP", "logos/indaiatuba.png"],
    ["2afdac10c5eb", "Fundação Florestal", "Governo do Estado de São Paulo — SP", "logos/sao-paulo.png"],
    ["080f5467c647", "Prefeitura de Aracruz", "Município de Aracruz — ES", "logos/aracruz.png"],
    ["84c6a34bd930", "SUPESP Ceará", "Pesquisa e Estratégia de Segurança Pública — CE", "logos/ceara.png"],
    ["f193bf4de09a", "CGM Recife", "Controladoria-Geral do Município — PE", "logos/recife.png"],
    ["f8a141c7feeb", "IPOJUCA PREV", "Instituição de Previdência — PE", "logos/ipojucaprev.png"],
    ["9d23a98d4f06", "CREF13", "Conselho Regional de Educação Física — BA", "logos/cref13.png"],
    ["ca5ea453f1a1", "SDU Marabá", "Superintendência de Desenv. Urbano — PA", "logos/maraba.png"],
    ["9e7ba3077528", "CRO Piauí", "Conselho Regional de Odontologia — PI", "logos/cropi.png"],
    ["c7a89abbd9cf", "Prefeitura de Bituruna", "Município de Bituruna — PR", "logos/bituruna.png"],
    ["8c5a6a35ec3e", "Detran Paraíba", "Departamento de Trânsito — PB", "logos/detran-pb.png"],
    ["b4996960aff4", "Prefeitura de Pinheiral", "Município de Pinheiral — RJ", "logos/pinheiral.png"],
    ["8d809b202238", "CGM Belo Horizonte", "Controladoria-Geral do Município — MG", "logos/pbh.png"],
    ["66ab5da6e241", "Câmara São José do Rio Pardo", "Câmara Municipal — SP", "logos/camarasjriopardo.png"],
    ["6f705fcbb50f", "SAMAE Ibiporã", "Água e Esgoto — PR", "logos/samaeibipora.png"],
    ["97a36cd9bf97", "Prefeitura de Timbé do Sul", "Município de Timbé do Sul — SC", "logos/timbedosul.png"],
    ["55b97f3c3827", "Prefeitura de Salto da Divisa", "Município de Salto da Divisa — MG", "logos/saltodadivisa.png"],
    ["073624664db2", "SAMAE Jaraguá do Sul", "Água e Esgoto — SC", "logos/samaejs.png"],
    ["ab217e16200b", "EPAGRI", "Pesquisa Agropecuária de SC — SC", "logos/epagri.png"],
    ["b92315f125a4", "Casa Civil", "Governo do Estado do Tocantins — TO", "logos/tocantins.png"],
    ["5f52fd50dce1", "MTPREV", "Fundação Mato Grosso Previdência — MT", "logos/mato-grosso.png"],
    ["795d3441467c", "Prefeitura de Carpina", "Município de Carpina — PE", "logos/carpina.png"]
  ];
  const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  function inicial(c) {
    const i = SITE_INICIAL.findIndex(([chave]) => (chave.startsWith('nome:') ? semAcento(c.nome + ' ' + (c.sigla || '')).includes(chave.slice(5)) : chave === c.id));
    return i >= 0 ? { ordem: i, nome: SITE_INICIAL[i][1], descricao: SITE_INICIAL[i][2], logo: SITE_INICIAL[i][3] } : null;
  }

  /* Como o órgão aparece no site: { mostrar, nome, descricao, logo } (logo: caminho em logos/ ou imagem embutida). */
  function doCliente(c) {
    if (c.site) return Object.assign({ mostrar: true, nome: '', descricao: '', logo: '' }, c.site);
    const ini = inicial(c);
    if (ini) return { mostrar: true, nome: ini.nome, descricao: ini.descricao, logo: ini.logo };
    const tipo = /^prefeitura|^munic/i.test(c.nome || '') && c.cidade ? 'Município de ' + c.cidade : c.cidade || '';
    return { mostrar: true, nome: c.sigla || c.nome || '', descricao: [tipo, c.uf].filter(Boolean).join(' — '), logo: '' };
  }

  /* Lista pública: órgãos com contrato não cancelado e "Mostrar no site"; primeiro na ordem antiga do site. */
  function listaPublica() {
    const comContrato = new Set(D.lista('contratos').filter((x) => x.status !== 'cancelado').map((x) => x.clienteId));
    return D.lista('clientes')
      .filter((c) => comContrato.has(c.id))
      .map((c) => ({ c, s: doCliente(c), ini: inicial(c) }))
      .filter(({ s }) => s.mostrar !== false && s.nome)
      .sort((a, b) => (a.ini ? a.ini.ordem : 999) - (b.ini ? b.ini.ordem : 999) || a.s.nome.localeCompare(b.s.nome, 'pt-BR'))
      .map(({ s }) => ({ nome: s.nome, desc: s.descricao || '', logo: s.logo || '' }));
  }

  /* Endereço da logo para mostrar dentro do sistema (as do site ficam um nível acima, em /logos). */
  const srcLogo = (logo) => (!logo ? '' : /^(data:|https:)/.test(logo) ? logo : '../' + logo);

  /* Reduz a imagem escolhida para 64 px (PNG embutido, poucos KB) para guardar no cadastro. */
  function reduzirLogo(arquivo) {
    return new Promise((resolve, reject) => {
      const leitor = new FileReader();
      leitor.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
      leitor.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Arquivo não é uma imagem.'));
        img.onload = () => {
          const lado = 64;
          const escala = Math.min(lado / img.width, lado / img.height, 1);
          const w = Math.max(1, Math.round(img.width * escala));
          const h = Math.max(1, Math.round(img.height * escala));
          const tela = document.createElement('canvas');
          tela.width = w;
          tela.height = h;
          tela.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(tela.toDataURL('image/png'));
        };
        img.src = leitor.result;
      };
      leitor.readAsDataURL(arquivo);
    });
  }

  GAH.site = { doCliente, listaPublica, srcLogo, reduzirLogo };
})();
