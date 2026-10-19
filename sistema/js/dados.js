/* Camada de dados. Mantém tudo em memória e grava em um de dois lugares:
   - Firebase (Firestore + login), quando GAH.firebaseConfig.apiKey está preenchido;
   - localStorage do navegador, no modo demonstração. */
(function () {
  const COLECOES = ['clientes', 'contratos', 'agenda', 'licitacoes', 'despesas', 'contabilidade', 'contas', 'custos', 'config'];
  const VERSAO_FB = '10.12.2';
  const CHAVE_LOCAL = 'gah-sistema-v1';

  const cache = {};
  COLECOES.forEach((c) => (cache[c] = []));
  const ouvintes = new Set();
  let fb = null; // { auth, db, fs, authMod }
  let cancelamentos = [];

  const novoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const avisar = () => ouvintes.forEach((f) => f());
  const modoDemo = () => !(GAH.firebaseConfig && GAH.firebaseConfig.apiKey);

  /* ---------- modo demonstração ---------- */
  function lerLocal() {
    try {
      const bruto = localStorage.getItem(CHAVE_LOCAL);
      return bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      return null;
    }
  }
  function gravarLocal() {
    try {
      localStorage.setItem(CHAVE_LOCAL, JSON.stringify(cache));
    } catch (e) {
      /* sem armazenamento: segue só em memória */
    }
  }
  function carregarDemo() {
    const salvo = lerLocal() || GAH.dadosIniciais || null;
    COLECOES.forEach((c) => (cache[c] = (salvo && salvo[c]) || []));
    if (!lerLocal()) gravarLocal();
  }

  /* ---------- Firebase ---------- */
  async function iniciarFirebase() {
    const base = 'https://www.gstatic.com/firebasejs/' + VERSAO_FB + '/';
    const [appMod, authMod, fs] = await Promise.all([
      import(base + 'firebase-app.js'),
      import(base + 'firebase-auth.js'),
      import(base + 'firebase-firestore.js')
    ]);
    const app = appMod.initializeApp(GAH.firebaseConfig);
    // Login guardado só nesta aba (sessionStorage): ao fechar a aba sai do sistema, e uma aba nova pede o login de novo.
    const auth = authMod.initializeAuth(app, { persistence: authMod.browserSessionPersistence });
    fb = { auth, db: fs.getFirestore(app), fs, authMod };
  }

  function assinarColecoes() {
    const { fs, db } = fb;
    let pendentes = COLECOES.length;
    GAH.dados.erroBanco = '';
    return new Promise((resolve) => {
      // se o banco não responder (ainda não criado no Firebase), segue em frente e avisa
      setTimeout(() => {
        if (pendentes > 0) {
          pendentes = 0;
          GAH.dados.erroBanco = GAH.dados.erroBanco || 'O banco de dados não respondeu. Confira se o Firestore Database foi criado no Firebase.';
          resolve();
        }
      }, 10000);
      cancelamentos = COLECOES.map((nome) =>
        fs.onSnapshot(
          fs.collection(db, nome),
          (snap) => {
            cache[nome] = snap.docs.map((d) => Object.assign({}, d.data(), { id: d.id }));
            if (pendentes > 0 && --pendentes === 0) resolve();
            avisar();
          },
          (erro) => {
            console.error('Erro ao ler ' + nome, erro);
            GAH.dados.erroBanco = /permission/i.test(erro.code || erro.message)
              ? 'Sem permissão para ler os dados: publique as regras do Firestore e confira se o seu e-mail está na lista.'
              : 'Erro ao ler os dados: ' + (erro.message || erro.code);
            if (pendentes > 0 && --pendentes === 0) resolve();
          }
        )
      );
    });
  }

  const limpar = (obj) => JSON.parse(JSON.stringify(obj)); // tira undefined, que o Firestore recusa

  /* ---------- API pública ---------- */
  GAH.dados = {
    modoDemo,
    novoId,

    async iniciar() {
      if (modoDemo()) return;
      await iniciarFirebase();
    },

    /* Chama cb(usuario | null) sempre que o login muda. */
    observarLogin(cb) {
      if (modoDemo()) {
        let usuario = null;
        try {
          usuario = JSON.parse(sessionStorage.getItem('gah-demo-usuario') || 'null');
        } catch (e) { /* ignora */ }
        if (usuario) carregarDemo();
        cb(usuario);
        return;
      }
      fb.authMod.onAuthStateChanged(fb.auth, async (u) => {
        cancelamentos.forEach((f) => f());
        cancelamentos = [];
        if (u) await assinarColecoes();
        cb(u ? { email: u.email, nome: u.displayName || u.email } : null);
      });
    },

    async entrar(email, senha) {
      if (modoDemo()) {
        const usuario = { email, nome: email };
        try { sessionStorage.setItem('gah-demo-usuario', JSON.stringify(usuario)); } catch (e) { /* ignora */ }
        carregarDemo();
        return usuario;
      }
      await fb.authMod.signInWithEmailAndPassword(fb.auth, email, senha);
    },

    async sair() {
      if (modoDemo()) {
        try { sessionStorage.removeItem('gah-demo-usuario'); } catch (e) { /* ignora */ }
        location.reload();
        return;
      }
      await fb.authMod.signOut(fb.auth);
    },

    /* Sai sem recarregar a página (usado ao voltar de outro site na mesma aba). */
    async encerrarSessao() {
      if (modoDemo()) {
        try { sessionStorage.removeItem('gah-demo-usuario'); } catch (e) { /* ignora */ }
        return;
      }
      if (fb.auth.authStateReady) await fb.auth.authStateReady();
      if (fb.auth.currentUser) await fb.authMod.signOut(fb.auth);
    },

    async recuperarSenha(email) {
      if (modoDemo()) throw new Error('No modo demonstração não há envio de e-mail.');
      await fb.authMod.sendPasswordResetEmail(fb.auth, email);
    },

    lista(colecao) {
      return cache[colecao];
    },

    obter(colecao, id) {
      return cache[colecao].find((x) => x.id === id) || null;
    },

    async salvar(colecao, obj) {
      const doc = limpar(Object.assign({}, obj));
      if (!doc.id) {
        doc.id = novoId();
        doc.criadoEm = new Date().toISOString();
      }
      doc.atualizadoEm = new Date().toISOString();
      const i = cache[colecao].findIndex((x) => x.id === doc.id);
      if (i >= 0) cache[colecao][i] = doc;
      else cache[colecao].push(doc);
      if (modoDemo()) gravarLocal();
      else {
        const { fs, db } = fb;
        const { id, ...resto } = doc;
        await fs.setDoc(fs.doc(db, colecao, id), resto);
      }
      avisar();
      return doc;
    },

    async excluir(colecao, id) {
      cache[colecao] = cache[colecao].filter((x) => x.id !== id);
      if (modoDemo()) gravarLocal();
      else await fb.fs.deleteDoc(fb.fs.doc(fb.db, colecao, id));
      avisar();
    },

    /* Cópia de tudo, para backup. */
    exportar() {
      const saida = { geradoEm: new Date().toISOString(), versao: 1 };
      COLECOES.forEach((c) => (saida[c] = cache[c]));
      return saida;
    },

    /* Restaura um backup. Itens com o mesmo id são substituídos. */
    async importar(json, aoAvancar) {
      let feitos = 0;
      const total = COLECOES.reduce((s, c) => s + ((json[c] && json[c].length) || 0), 0);
      for (const c of COLECOES) {
        for (const item of json[c] || []) {
          if (modoDemo()) {
            const i = cache[c].findIndex((x) => x.id === item.id);
            if (i >= 0) cache[c][i] = item;
            else cache[c].push(item);
          } else {
            const { id, ...resto } = limpar(item);
            await fb.fs.setDoc(fb.fs.doc(fb.db, c, id || novoId()), resto);
          }
          feitos++;
          if (aoAvancar) aoAvancar(feitos, total);
        }
      }
      // arquivo de ajuste: muda só os campos informados de itens que já existem (o resto fica como está)
      for (const c of Object.keys(json.atualizar || {})) {
        if (!COLECOES.includes(c)) continue;
        for (const parcial of json.atualizar[c] || []) {
          const atual = cache[c].find((x) => x.id === parcial.id);
          if (!atual) continue;
          // campos que são objetos (ex.: faturamento) são mesclados: só muda o que veio no arquivo
          const novo = Object.assign({}, atual);
          for (const [k, v] of Object.entries(limpar(parcial))) {
            const ehObjeto = (x) => x && typeof x === 'object' && !Array.isArray(x);
            novo[k] = ehObjeto(v) && ehObjeto(atual[k]) ? Object.assign({}, atual[k], v) : v;
          }
          if (modoDemo()) cache[c][cache[c].indexOf(atual)] = novo;
          else {
            const { id, ...resto } = novo;
            await fb.fs.setDoc(fb.fs.doc(fb.db, c, id), resto);
          }
          feitos++;
        }
      }
      // arquivo de acréscimo: listas (ex.: contatos) ganham só os itens novos, sem repetir quem já está lá
      // (mesmo telefone); quem já existe com o mesmo primeiro nome e sem telefone recebe o telefone.
      // Campos que são objetos (ex.: faturamento) só têm preenchidas as informações que estavam vazias.
      const soDigitos = (t) => String(t || '').replace(/\D/g, '').slice(-8);
      const primeiroNome = (s) => String(s || '').trim().split(/\s+/)[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      for (const c of Object.keys(json.acrescentar || {})) {
        if (!COLECOES.includes(c)) continue;
        for (const parcial of json.acrescentar[c] || []) {
          const atual = cache[c].find((x) => x.id === parcial.id);
          if (!atual) continue;
          const novo = Object.assign({}, atual);
          for (const [k, v] of Object.entries(limpar(parcial))) {
            if (k === 'id') continue;
            if (Array.isArray(v)) {
              const lista = (Array.isArray(atual[k]) ? atual[k] : []).map((x) => Object.assign({}, x));
              for (const item of v) {
                if (item.telefone && lista.some((x) => soDigitos(x.telefone) && soDigitos(x.telefone) === soDigitos(item.telefone))) continue;
                const mesmo = lista.find((x) => !soDigitos(x.telefone) && primeiroNome(x.nome) && primeiroNome(x.nome) === primeiroNome(item.nome));
                if (mesmo) { Object.keys(item).forEach((ch) => { if (!mesmo[ch]) mesmo[ch] = item[ch]; }); continue; }
                lista.push(item);
              }
              novo[k] = lista;
            } else if (v && typeof v === 'object') {
              const obj = Object.assign({}, atual[k]);
              Object.keys(v).forEach((ch) => { if (!obj[ch]) obj[ch] = v[ch]; });
              novo[k] = obj;
            } else if (!atual[k]) novo[k] = v;
          }
          if (modoDemo()) cache[c][cache[c].indexOf(atual)] = novo;
          else {
            const { id, ...resto } = novo;
            await fb.fs.setDoc(fb.fs.doc(fb.db, c, id), resto);
          }
          feitos++;
        }
      }
      // itens que um backup mais novo pede para apagar (ex.: lançamentos que mudaram de lugar)
      for (const c of Object.keys(json.remover || {})) {
        if (!COLECOES.includes(c)) continue;
        for (const id of json.remover[c] || []) {
          if (modoDemo()) cache[c] = cache[c].filter((x) => x.id !== id);
          else if (cache[c].some((x) => x.id === id)) await fb.fs.deleteDoc(fb.fs.doc(fb.db, c, id));
        }
      }
      if (modoDemo()) gravarLocal();
      avisar();
      return feitos;
    },

    aoMudar(f) {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },

    configuracao() {
      return Object.assign(
        { aliquotaNF: 10.5, aliquotaCompra: 0, diasAvisoVigencia: 60 },
        cache.config.find((x) => x.id === 'geral') || {}
      );
    }
  };
})();
