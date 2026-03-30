const { BlobServiceClient } = require('@azure/storage-blob');

// Usamos a mesma variável que configurámos para o upload
const connectionString = process.env.STORAGE_CONNECTION_STRING || process.env.AzureWebJobsStorage;
const containerName = 'syncboard-attachments';

module.exports = async function (context, req) {
    // Pega o nome do blob que vem na rota da URL
    const blobName = context.bindingData.blobName;
    context.log(`HTTP trigger para eliminar anexo: ${blobName}`);

    if (!connectionString) {
        context.log.error('STORAGE_CONNECTION_STRING não está configurada.');
        context.res = { status: 500, body: "Erro de infraestrutura: Connection String ausente." };
        return;
    }

    if (!blobName) {
        context.res = { status: 400, body: "Nome do anexo não fornecido na requisição." };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        // Tenta apagar o ficheiro no Azure
        await blockBlobClient.delete();
        
        context.log(`Anexo ${blobName} eliminado com sucesso.`);
        context.res = { status: 204 }; // 204 No Content indica sucesso sem corpo de resposta
        
    } catch (error) {
        if (error.statusCode === 404) {
             // Se o ficheiro já não existir no Azure (ex: apagado manualmente), 
             // ignoramos o erro e dizemos ao frontend que está tudo bem
             context.log.warn(`O anexo ${blobName} já não existia no Azure.`);
             context.res = { status: 204 };
        } else {
            context.log.error(`Erro crítico ao eliminar o blob ${blobName}: ${error.message}`);
            context.res = { status: 500, body: "Erro ao eliminar o anexo do armazenamento." };
        }
    }
};