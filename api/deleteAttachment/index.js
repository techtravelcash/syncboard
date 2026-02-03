const { BlobServiceClient } = require('@azure/storage-blob');

const connectionString = process.env.AzureWebJobsStorage;
const containerName = 'attachments';
const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);

module.exports = async function (context, req) {
    const blobName = context.bindingData.blobName;
    context.log(`HTTP trigger for deleting blob: ${blobName}`);

    if (!blobName) {
        context.res = { status: 400, body: "Nome do blob não fornecido." };
        return;
    }
    try {
        const containerClient = blobServiceClient.getContainerClient(containerName);
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        await blockBlobClient.delete();
        context.res = { status: 204 };
    } catch (error) {
        if (error.statusCode === 404) {
             context.res = { status: 204 };
        } else {
            context.log.error(`Erro ao eliminar o blob ${blobName}: ${error.message}`);
            context.res = { status: 500, body: "Erro ao eliminar o anexo." };
        }
    }
};