require('dotenv').config({ path: './.env' });
const axios = require('axios');

const appId = process.env.DISCORD_APP_ID;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!appId || !botToken) {
    console.error('As variáveis de ambiente DISCORD_APP_ID e DISCORD_BOT_TOKEN são necessárias.');
    process.exit(1);
}

const commands = [
    {
        name: 'ping',
        description: 'Verifica se o bot está a responder.',
    },
    {
        name: 'taquasepronto',
        description: 'Envia uma mensagem de cobrança sobre prazos.',
    },
    {
        name: 'estamossoporti',
        description: 'Avisa alguém que a reunião está à espera dele.',
        options: [
            {
                name: 'usuario',
                description: 'Quem é que está atrasado?',
                type: 6, // Tipo 6 = USER (permite selecionar um utilizador do Discord)
                required: true,
            }
        ],
    },
    {
        name: 'novatarefa',
        description: 'Cria uma nova tarefa no quadro SyncBoard.',
        options: [
            {
                name: 'titulo',
                description: 'O título da nova tarefa.',
                type: 3, // String
                required: true,
            },
            {
                name: 'descricao',
                description: 'A descrição detalhada da tarefa.',
                type: 3, // String
                required: true,
            },
            {
                name: 'responsavel',
                description: 'A quem a tarefa deve ser atribuída (comece a digitar para ver as opções).',
                type: 3, // String
                required: true,
                autocomplete: true,
            },
            {
                name: 'projeto',
                description: 'O projeto ao qual a tarefa pertence (comece a digitar para ver as opções).',
                type: 3, // String
                required: false,
                autocomplete: true,
            }
        ],
    }
];

const url = `https://discord.com/api/v10/applications/${appId}/commands`;

console.log('A registar os comandos...');

axios.put(url, commands, {
    headers: {
        'Authorization': `Bot ${botToken}`,
        'Content-Type': 'application/json',
    },
})
.then(response => {
    console.log('Comandos registados com sucesso!');
})
.catch(error => {
    console.error('Erro ao registar os comandos:', error.response ? error.response.data.errors : error.message);
});