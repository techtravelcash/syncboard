const { BlobServiceClient } = require('@azure/storage-blob');
const { v4: uuidv4 } = require('uuid');

const connectionString = process.env.AzureWebJobsStorage; 
const containerName = 'attachments';

const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

module.exports = async function(context, req) {
    context.log('HTTP trigger for attachment upload.');

    try {
        const boundary = req.headers['content-type'].split('boundary=')[1];
        const bodyBuffer = Buffer.from(req.body);

        // Simples parser para encontrar o arquivo no corpo multipart/form-data
        const bodyString = bodyBuffer.toString();
        const fileHeaderMatch = bodyString.match(/Content-Disposition: form-data; name="file"; filename="([^"]+)"\r\nContent-Type: ([^\r\n]+)/);
        if(!fileHeaderMatch) {
            return { status: 400, body: 'Formato multipart inválido.' };
        }
        const fileName = fileHeaderMatch[1];
        const contentType = fileHeaderMatch[2];

        const headerEnd = `\r\n\r\n`;
        const fileStartIndex = bodyString.indexOf(headerEnd) + headerEnd.length;
        const fileEndIndex = bodyString.lastIndexOf(`\r\n--${boundary}--`);
        const fileContent = bodyBuffer.slice(fileStartIndex, fileEndIndex);

        const blobName = `${uuidv4()}-${fileName}`;
        const containerClient = blobServiceClient.getContainerClient(containerName);
        await containerClient.createIfNotExists({ access: 'blob' });

        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.uploadData(fileContent, {
            blobHTTPHeaders: { blobContentType: contentType }
        });

        context.res = {
            body: {
                url: blockBlobClient.url,
                name: fileName,
                contentType: contentType,
            }
        };
    } catch (error) {
        context.log.error(`Erro no upload: ${error.message}`);
        context.res = { status: 500, body: 'Erro ao processar o arquivo.' };
    }
};