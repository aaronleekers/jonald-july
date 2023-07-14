import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { OpenAI } from 'langchain/llms/openai'
import { loadQAStuffChain } from 'langchain/chains'
import { Document } from 'langchain/document'
import { timeout } from './config'
import updateStatus from './app/page.tsx'

// https://excalidraw.com/#json=ZstTIm1Gzq_5Vg3Emj4i4,vItbgfRiKKFCamrsJ8Bp2Q


export const queryPineconeVectorStoreAndQueryLLM = async (
  client,
  indexName,
  question,
  updateStatus: (newStatus: string) => void
) => {
  console.log('Querying Pinecone vector store...');

  const index = client.Index(indexName);

  const queryEmbedding = await new OpenAIEmbeddings().embedQuery(question);

  let queryResponse = await index.query({
    queryRequest: {
      topK: 10,
      vector: queryEmbedding,
      includeMetadata: true,
      includeValues: true,
    },
  });

  console.log(`Found ${queryResponse.matches.length} matches...`);
  console.log(`Asking question: ${question}...`);

  console.log(queryResponse.matches)

  if (queryResponse.matches.length) {
    const llm = new OpenAI({});
    const chain = loadQAStuffChain(llm);

    const concatenatedPageContent = queryResponse.matches
      .map((match) => match.metadata.pageContent)
      .join(" ");

    const result = await chain.call({
      input_documents: [new Document({ pageContent: concatenatedPageContent })],
      question: `${question}`,
      temperature: 0.2,
      max_tokens: 150
    });

    console.log(`Answer: ${result.text}`);

    return {
      answer: result.text,
    };
  } else {
    console.log('Since there are no matches, GPT-3 will not be queried.');
    return {
      answer: null,
      sources: []
    };
  }
};

export const createPineconeIndex = async (
  client,
  indexName,
  vectorDimension
) => {
  // 1. Initiate index existence check
  console.log(`Checking "${indexName}"...`);
  // 2. Get list of existing indexes
  const existingIndexes = await client.listIndexes();
  // 3. If index doesn't exist, create it
  if (!existingIndexes.includes(indexName)) {
    // 4. Log index creation initiation
    console.log(`Creating "${indexName}"...`);
    // 5. Create index
    await client.createIndex({
      createRequest: {
        name: indexName,
        dimension: vectorDimension,
        metric: 'cosine',
      },
    });
    // 6. Log successful creation
      console.log(`Creating index.... please wait for it to finish initializing.`);
    // 7. Wait for index initialization
    await new Promise((resolve) => setTimeout(resolve, timeout));
  } else {
    // 8. Log if index already exists
    console.log(`"${indexName}" already exists.`);
  }
};


export const updatePinecone = async (client, indexName, docs) => {
  console.log('Retrieving Pinecone index...');
  // 1. Retrieve Pinecone index
  const index = client.Index(indexName);
  // 2. Log the retrieved index name
  console.log(`Pinecone index retrieved: ${indexName}`);
  // 3. Process each document in the docs array
  for (const doc of docs) {
    console.log(`Processing document: ${doc.metadata.source}`);
    const txtPath = doc.metadata.source;
    const text = doc.pageContent;
    // 4. Create RecursiveCharacterTextSplitter instance
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 250,
    });
    console.log('Splitting text into chunks...');
    // 5. Split text into chunks (documents)
    const chunks = await textSplitter.createDocuments([text]);
    console.log(`Text split into ${chunks.length} chunks`);
    console.log(
      `Calling OpenAI's Embedding endpoint documents with ${chunks.length} text chunks ...`
    );
    // 6. Create OpenAI embeddings for documents
    const embeddingsArrays = await new OpenAIEmbeddings().embedDocuments(
      chunks.map((chunk) => chunk.pageContent.replace(/\n/g, " "))
    );
    console.log('Finished embedding documents');
    console.log(
      `Creating ${chunks.length} vectors array with id, values, and metadata...`
    );
    // 7. Create and upsert vectors in batches of 100
    const batchSize = 100;
    let batch:any = [];
    for (let idx = 0; idx < chunks.length; idx++) {
      const chunk = chunks[idx];
      const vector = {
        id: `${txtPath}_${idx}`,
        values: embeddingsArrays[idx],
        metadata: {
          ...chunk.metadata,
          loc: JSON.stringify(chunk.metadata.loc),
          pageContent: chunk.pageContent,
          txtPath: txtPath,
        },
      };
      batch = [...batch, vector]
      // When batch is full or it's the last item, upsert the vectors
      if (batch.length === batchSize || idx === chunks.length - 1) {
        await index.upsert({
          upsertRequest: {
            vectors: batch,
          },
        });
        // Empty the batch
        batch = [];
      }
    }
    // 8. Log the number of vectors updated
    console.log(`Pinecone index updated with ${chunks.length} vectors`);
  }
};