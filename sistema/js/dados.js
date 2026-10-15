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
    fb = { auth: authMod.getAuth(app), db: fs.getFirestore(app), fs, authMod };
  }

  function assinarColecoes() {
    const { fs, db } = fb;
    let pendentes = COLECOES.length;
    return new Promise((resolve) => {
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
      return total;
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
