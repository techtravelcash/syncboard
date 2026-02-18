module.exports = async function (context, req, inputDocument) {
    if (!inputDocument) {
        context.res = { status: 404, body: "Tarefa não encontrada." };
        return;
    }

    const commentId = context.bindingData.commentId;
    const { text, author } = req.body; // author é o email para validação de segurança

    if (!inputDocument.comments) {
        context.res = { status: 404, body: "Comentário não encontrado." };
        return;
    }

    // Encontra o comentário
    const commentIndex = inputDocument.comments.findIndex(c => c.id === commentId);

    if (commentIndex === -1) {
        context.res = { status: 404, body: "Comentário não encontrado." };
        return;
    }

    // Validação básica: Só o autor pode editar (ou admin, se tiver essa lógica)
    // Nota: O ideal é validar pelo token 'x-ms-client-principal', aqui simplificado pelo body
    if (inputDocument.comments[commentIndex].author !== author && inputDocument.comments[commentIndex].author.email !== author) {
         // Verificação dupla para suportar objeto ou string no author antigo
         context.res = { status: 403, body: "Sem permissão para editar este comentário." };
         return;
    }

    // Atualiza o texto e marca como editado
    inputDocument.comments[commentIndex].text = text;
    inputDocument.comments[commentIndex].editedAt = new Date().toISOString();

    context.bindings.outputDocument = inputDocument;
    
    context.bindings.signalRMessage = {
        target: 'taskUpdated',
        arguments: [inputDocument]
    };

    context.res = { body: inputDocument };
};