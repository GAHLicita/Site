/* Configuração do Firebase (login e banco de dados na nuvem).
   Projeto: gah-sistema. Estas chaves identificam o app e podem ficar públicas:
   quem protege os dados são as regras do arquivo firestore.rules.
   Se apiKey ficar vazio, o sistema volta ao MODO DEMONSTRAÇÃO. */
window.GAH = window.GAH || {};
GAH.firebaseConfig = {
  apiKey: 'AIzaSyB2PB-LTPcoEFtLyHjHlaY558vSLWNx5oc',
  authDomain: 'gah-sistema.firebaseapp.com',
  projectId: 'gah-sistema',
  storageBucket: 'gah-sistema.firebasestorage.app',
  messagingSenderId: '419342726673',
  appId: '1:419342726673:web:d8459ff63ccc35916c23b0'
};

/* Google Agenda (sincronização nos dois sentidos). Cole aqui o "ID do cliente" OAuth criado no
   Google Cloud (projeto gah-sistema). Vazio = sincronização desligada. */
GAH.googleConfig = {
  clientId: '',
  conta: 'contato@gahlicita.com.br',
  calendarId: 'primary'
};
