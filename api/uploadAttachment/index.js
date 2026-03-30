const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

// Agora usamos a variável que você acabou de criar no Azure
const connectionString = process.env.STORAGE_CONNECTION_STRING; 
const containerName = 'syncboard-attachments';

module.exports = async function(context, req) {
    context.log('Iniciando upload de anexo (Modo Binário).');

    // Trava de segurança: avisa se você esqueceu de configurar a variável
    if (!connectionString) {
        context.log.error('STORAGE_CONNECTION_STRING não está configurada no Azure.');
        context.res = { status: 500, body: 'Erro no servidor: Falta configuração do Storage.' };
        return;
    }

    try {
        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // Garante que o container existe
        await containerClient.createIfNotExists({ access: 'blob' });

        // Pegamos o nome e o tipo do arquivo através dos cabeçalhos que o Frontend vai enviar
        const rawFileName = req.headers['x-file-name'] || 'arquivo_desconhecido';
        const fileName = decodeURIComponent(rawFileName);
        const contentType = req.headers['x-file-type'] || 'application/octet-stream';

        // O Azure já entrega o arquivo binário prontinho no req.body
        let fileContent = req.body;

        if (!fileContent || fileContent.length === 0) {
            context.res = { status: 400, body: 'Nenhum arquivo detectado na requisição.' };
            return;
        }

        // Failsafe: Se o Azure entregar como string, convertemos de volta para Buffer
        if (typeof fileContent === 'string') {
            fileContent = Buffer.from(fileContent, 'utf-8');
        }

        // Criamos um nome único para não sobrescrever arquivos com o mesmo nome
        const blobName = `${uuidv4()}-${fileName}`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        // Faz o upload direto pra nuvem
        await blockBlobClient.uploadData(fileContent, {
            blobHTTPHeaders: { blobContentType: contentType }
        });

        // Devolvemos a URL pública para o frontend salvar na tarefa
        context.res = {
            status: 200,
            body: {
                url: blockBlobClient.url,
                name: fileName,
                contentType: contentType,
            }
        };
    } catch (error) {
        context.log.error(`Erro ao salvar anexo no Blob Storage: ${error.message}`);
        context.res = { status: 500, body: 'Falha interna ao salvar o anexo.' };
    }
};