/* Configuração do Firebase (login e banco de dados na nuvem).
   Enquanto apiKey estiver vazio, o sistema roda em MODO DEMONSTRAÇÃO:
   os dados ficam só neste navegador e qualquer e-mail/senha entra.
   Veja o passo a passo no arquivo LEIAME.md. */
window.GAH = window.GAH || {};
GAH.firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: ''
};
