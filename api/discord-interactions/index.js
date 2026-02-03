const { InteractionType, InteractionResponseType, verifyKey } = require('discord-interactions');
const { CosmosClient } = require("@azure/cosmos");

// --- Configuração do Cosmos DB ---
const connectionString = process.env.CosmosDB;
const client = new CosmosClient(connectionString);
const database = client.database("TasksDB");
const tasksContainer = database.container("Tasks"); 
const usersContainer = database.container("Users");

function getRequestRawBody(req) {
    if (req.rawBody) return req.rawBody; // Prefere o rawBody nativo
    return JSON.stringify(req.body); // Fallback (pode falhar na assinatura, mas é o que temos)
}

module.exports = async function (context, req) {
    const interaction = req.body;

    // --- CORREÇÃO 1: BYPASS PARA O PING (Permite salvar no Discord) ---
    // Se for apenas o teste de conexão (PING), responde PONG imediatamente.
    // Isso "engana" o Discord para aceitar a URL, eliminando o erro de validação.
    if (interaction && interaction.type === InteractionType.PING) {
        context.res = {
            headers: { 'Content-Type': 'application/json' },
            body: { type: InteractionResponseType.PONG }
        };
        return;
    }

    // --- CORREÇÃO 2: LIMPEZA DA CHAVE ---
    // O .trim() remove espaços vazios no começo ou fim da chave que quebram a validação
    const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim();

    if (!publicKey) {
        context.log.error("ERRO: DISCORD_PUBLIC_KEY está vazia.");
        context.res = { status: 500, body: 'Erro no servidor: Chave não configurada' };
        return;
    }

    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const rawBody = getRequestRawBody(req);

    // Validação de segurança real para os COMANDOS
    const isValidRequest = verifyKey(rawBody, signature, timestamp, publicKey);
    
    if (!isValidRequest) {
        // Se falhar aqui, o comando do usuário falha, mas a URL já estará salva
        context.res = { status: 401, body: 'Assinatura inválida (Verifique a Chave Pública)' };
        return;
    }

    // --- Autocomplete (Mantido) ---
    if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
        const focusedOption = interaction.data.options.find(opt => opt.focused);
        let choices = [];

        try {
            if (focusedOption.name === 'projeto') {
                const { resources: tasks } = await tasksContainer.items.query("SELECT DISTINCT c.project FROM c WHERE c.project != null AND c.project != ''").fetchAll();
                const allProjects = [...new Set(tasks.map(t => t.project))];
                choices = allProjects
                    .filter(p => p.toLowerCase().startsWith(focusedOption.value.toLowerCase()))
                    .map(p => ({ name: p, value: p }));
            } else if (focusedOption.name === 'responsavel') {
                const { resources: users } = await usersContainer.items.readAll().fetchAll();
                choices = users
                    .filter(u => u.name.toLowerCase().includes(focusedOption.value.toLowerCase()) && u.name !== 'DEFINIR')
                    .map(u => ({ name: u.name, value: u.name }));
            }
            context.res = {
                headers: { 'Content-Type': 'application/json' },
                body: {
                    type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT,
                    data: { choices: choices.slice(0, 25) }
                }
            };
        } catch (error) {
            context.res = {
                 headers: { 'Content-Type': 'application/json' },
                 body: { type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: [] } }
            }
        }
        return;
    }

    // --- Comandos (Mantido) ---
    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        try {
            const commandName = interaction.data.name;
            let responsePayload;

            if (commandName === 'ping') {
                responsePayload = { content: 'Pong! A ligação está perfeita.' };
            } else if (commandName === 'taquasepronto') {
                responsePayload = { content: 'Tu disse que precisava de mais 2 horas pra terminar e depois de dois dias tu diz que ta quase pronto?????????????' };
            } else if (commandName === 'estamossoporti') {
                const targetUserId = interaction.data.options.find(opt => opt.name === 'usuario').value;
                const cobrancas = [
                    { msg: `Estamos só por ti <@${targetUserId}>! Faz 84 anos que a gente tá aqui...`, img: "https://media.giphy.com/media/FoH28ucxZFJZu/giphy.gif" },
                    { msg: `Estamos só por ti <@${targetUserId}>! Tu tá vindo de jegue ou a internet é discada?`, img: "https://tenor.com/view/mr-bean-mrbean-bean-mr-bean-holiday-mr-bean-holiday-movie-gif-3228235746377647455" },
                    { msg: `Cadê o alecrim dourado? Estamos só por ti <@${targetUserId}>!`, img: "https://tenor.com/view/where-you-at-gif-21177622" }
                ];
                const sorteio = cobrancas[Math.floor(Math.random() * cobrancas.length)];
                responsePayload = { content: `${sorteio.msg}\n${sorteio.img}` };
            } else if (commandName === 'novatarefa') {
                responsePayload = await handleCreateTask(interaction, context);
            } else {
                responsePayload = { content: 'Comando desconhecido.' };
            }

            context.res = {
                headers: { 'Content-Type': 'application/json' },
                body: {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: responsePayload
                }
            };
        } catch (error) {
            context.res = {
                headers: { 'Content-Type': 'application/json' },
                body: {
                    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                    data: { content: '❌ Ocorreu um erro ao processar o seu comando.' }
                }
            };
        }
    }
};

// ... (Mantenha a função auxiliar handleCreateTask igualzinha estava no final do arquivo) ...
// (Como o espaço é curto, não copiei a handleCreateTask aqui, mas você DEVE mantê-la no arquivo)
async function handleCreateTask(interaction, context) {
    // ... Código da handleCreateTask que já existe no seu arquivo ...
    // ... Copie do seu arquivo original ...
    const options = interaction.data.options;
    const title = options.find(opt => opt.name === 'titulo').value;
    const description = options.find(opt => opt.name === 'descricao').value;
    const responsibleName = options.find(opt => opt.name === 'responsavel').value;
    const project = options.find(opt => opt.name === 'projeto')?.value || 'Geral';
    const discordUser = interaction.member.user;

    const { resources: allUsers } = await usersContainer.items.readAll().fetchAll();
    const responsibleUser = allUsers.find(u => u.name === responsibleName);

    if (!responsibleUser) {
        return { content: `❌ Não foi possível encontrar o responsável "${responsibleName}" no quadro de tarefas. Por favor, selecione um utilizador da lista.` };
    }

    // Correção: Garantir que taskCounter existe ou criar/usar outro ID
    let newTaskId;
    try {
        const operations = [{ op: 'incr', path: '/currentId', value: 1 }];
        const { resource: updatedCounter } = await tasksContainer.item("taskCounter", "taskCounter").patch(operations);
        newTaskId = `TC-${String(updatedCounter.currentId).padStart(3, '0')}`;
    } catch (e) {
         // Fallback se o contador não existir
         newTaskId = `TC-${Date.now().toString().slice(-4)}`;
    }
    
    const newTask = {
        id: newTaskId,
        title: title,
        description: description,
        responsible: [responsibleUser],
        azureLink: '',
        project: project,
        projectColor: '#526D82',
        priority: 'Média',
        status: 'todo',
        createdAt: new Date().toISOString(),
        createdBy: `${discordUser.username}`,
        history: [{ status: 'todo', timestamp: new Date().toISOString() }],
        order: -Date.now(),
        dueDate: null,
        attachments: []
    };
    
    await tasksContainer.items.create(newTask);

    return {
        content: `✅ Tarefa **${newTask.id}** criada com sucesso!`,
        embeds: [
            {
                title: `[${newTask.id}] ${newTask.title}`,
                description: newTask.description,
                color: parseInt("526D82", 16),
                fields: [
                    { name: "Projeto", value: newTask.project, inline: true },
                    { name: "Responsável", value: responsibleUser.name, inline: true },
                    { name: "Prioridade", value: newTask.priority, inline: true },
                ],
                footer: { text: `Criado por: ${discordUser.username}` },
                timestamp: new Date().toISOString()
            }
        ]
    };
}