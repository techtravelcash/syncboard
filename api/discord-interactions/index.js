const { InteractionType, InteractionResponseType, verifyKey } = require('discord-interactions');
const { CosmosClient } = require("@azure/cosmos");

// --- Configuração do Cosmos DB ---
const connectionString = process.env.CosmosDB;
// Inicialização segura para evitar crash se a env estiver faltando durante o deploy
const client = connectionString ? new CosmosClient(connectionString) : null;
const database = client ? client.database("TasksDB") : null;
const tasksContainer = database ? database.container("Tasks") : null;
const usersContainer = database ? database.container("Users") : null;

module.exports = async function (context, req) {
    // 1. Obter a chave pública
    const publicKey = (process.env.DISCORD_PUBLIC_KEY || '').trim();
    if (!publicKey) {
        context.log.error("ERRO: DISCORD_PUBLIC_KEY não configurada.");
        context.res = { status: 500, body: 'Erro interno: Chave não configurada' };
        return;
    }

    // 2. Validação de Assinatura (CRÍTICO)
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    
    // Azure Functions normalmente fornece req.rawBody. Usar JSON.stringify é falho para criptografia.
    const rawBody = req.rawBody; 
    
    // Se rawBody for undefined, a validação vai falhar.
    // Certifique-se de não estar forçando conversão na function.json ou modifique para obter o buffer.
    if (!rawBody && !req.body) {
         context.res = { status: 400, body: 'Empty body' };
         return;
    }

    // Fallback apenas se rawBody não existir (mas tente confiar no rawBody)
    const bodyForVerification = rawBody || JSON.stringify(req.body);

    const isValidRequest = verifyKey(bodyForVerification, signature, timestamp, publicKey);

    if (!isValidRequest) {
        context.log.warn("Assinatura inválida detectada.");
        context.res = { status: 401, body: 'Assinatura inválida' };
        return;
    }

    // 3. Parse do Body (se necessário)
    let interaction = req.body;
    if (typeof interaction === 'string') {
        try {
            interaction = JSON.parse(interaction);
        } catch (e) {
            context.log.error("Erro ao parsear body:", e);
            context.res = { status: 400, body: 'Bad JSON' };
            return;
        }
    }

    // 4. Tratamento do PING (Obrigatório para o Discord validar a URL)
    if (interaction.type === InteractionType.PING) {
        context.log("PING recebido e validado.");
        context.res = {
            headers: { 'Content-Type': 'application/json' },
            body: { type: InteractionResponseType.PONG }
        };
        return;
    }

    // --- Lógica de Comandos ---
    if (interaction.type === InteractionType.APPLICATION_COMMAND_AUTOCOMPLETE) {
        await handleAutocomplete(context, interaction);
        return;
    }

    if (interaction.type === InteractionType.APPLICATION_COMMAND) {
        await handleCommand(context, interaction);
    }
};

// --- Funções Auxiliares ---

async function handleAutocomplete(context, interaction) {
    // Verificação de segurança para BD
    if (!tasksContainer || !usersContainer) { 
        context.res = { body: { type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: [] } } };
        return; 
    }

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
        context.log.error("Erro no autocomplete:", error);
        context.res = {
             headers: { 'Content-Type': 'application/json' },
             body: { type: InteractionResponseType.APPLICATION_COMMAND_AUTOCOMPLETE_RESULT, data: { choices: [] } }
        }
    }
}

async function handleCommand(context, interaction) {
    try {
        const commandName = interaction.data.name;
        let responsePayload = { content: 'Comando desconhecido.' };

        if (commandName === 'ping') {
            responsePayload = { content: 'Pong! A ligação está perfeita.' };
        } else if (commandName === 'taquasepronto') {
            responsePayload = { content: 'Tu disse que precisava de mais 2 horas pra terminar e depois de dois dias tu diz que ta quase pronto?????????????' };
        } else if (commandName === 'estamossoporti') {
            const targetUserId = interaction.data.options.find(opt => opt.name === 'usuario').value;
            const cobrancas = [
                { msg: `Estamos só por ti <@${targetUserId}>! Faz 84 anos que a gente tá aqui...`, img: "https://media.giphy.com/media/FoH28ucxZFJZu/giphy.gif" },
                { msg: `Estamos só por ti <@${targetUserId}>! Tu tá vindo de jegue ou a internet é discada?`, img: "https://tenor.com/view/mr-bean-mrbean-bean-mr-bean-holiday-mr-bean-holiday-movie-gif-3228235746377647455" },
                { msg: `Cadê o alecrim dourado? Estamos só por ti <@${targetUserId}>!`, img: "https://tenor.com/view/where-you-at-gif-21177622" },
                { msg: `Estamos só por ti <@${targetUserId}>... Minha juventude tá indo embora.`, img: "https://tenor.com/view/skeleton-forever-waiting-deep-thoughts-gif-19415492" },
                { msg: `Olha, <@${targetUserId}>, estamos só por ti.`, img: "https://tenor.com/view/gjirlfriend-gif-14457952604098199169" },
                { msg: `Estamos só por ti <@${targetUserId}>! Tá escondido onde?`, img: "https://tenor.com/view/teletubbies-laa-laa-looking-around-where-are-you-search-gif-15574368096023879998" }
            ];
            const sorteio = cobrancas[Math.floor(Math.random() * cobrancas.length)];
            responsePayload = { content: `${sorteio.msg}\n${sorteio.img}` };
        } else if (commandName === 'novatarefa') {
            if (!tasksContainer) throw new Error("CosmosDB não conectado");
            responsePayload = await handleCreateTask(interaction, context);
        }

        context.res = {
            headers: { 'Content-Type': 'application/json' },
            body: {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: responsePayload
            }
        };

    } catch (error) {
        context.log.error('Erro ao executar o comando:', error);
        context.res = {
            headers: { 'Content-Type': 'application/json' },
            body: {
                type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
                data: { content: '❌ Ocorreu um erro ao processar o seu comando.' }
            }
        };
    }
}

async function handleCreateTask(interaction, context) {
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

    let newTaskId;
    try {
        const operations = [{ op: 'incr', path: '/currentId', value: 1 }];
        const { resource: updatedCounter } = await tasksContainer.item("taskCounter", "taskCounter").patch(operations);
        newTaskId = `TC-${String(updatedCounter.currentId).padStart(3, '0')}`;
    } catch (e) {
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
    context.log(`Tarefa ${newTask.id} criada com sucesso.`);

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