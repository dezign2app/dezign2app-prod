import { BackendNode, BackendEdge } from "@/types/canvas";
import { KafkaTopic, CompiledFile, CompiledKafkaResult } from "@workspace/canvas/types";
import { toVarName } from "../utils";
import { toFolderName, toTopicKey } from "./utils";
import {
  generatePackageJson,
  generateTsConfig,
  generateConfigFile,
  generateClientFile,
  generateAdminFile,
  generateIndexFile,
  generateDockerComposeFile,
} from "./generators/packageFiles";
import { generateTopicFile, generateTopicsIndexFile } from "./generators/topics";
import { generatePublisherFile, generatePublishersIndexFile } from "./generators/publishers";
import { generateConsumerFile, generateConsumersIndexFile } from "./generators/consumers";
import { generateReusableFunctions } from "./generators/reusableFunctions";

export * from "./utils";
export * from "./generators/packageFiles";
export * from "./generators/topics";
export * from "./generators/publishers";
export * from "./generators/consumers";
export * from "./generators/reusableFunctions";

/**
 * Compiles Kafka nodes into a structured shared package under packages/<nodeLabel>.
 */
export function compileKafkaNodes(
  allNodes: BackendNode[],
  _allEdges: BackendEdge[] = [],
): CompiledKafkaResult {
  const files: CompiledFile[] = [];

  const kafkaNodes = allNodes.filter(
    (n) =>
      n.type === "kafka" ||
      n.type === "eventstream" ||
      (n.type === "queue" &&
        n.data?.implementation?.toLowerCase() === "kafka"),
  );

  // Derive package name from first node label
  const firstKafkaNode = kafkaNodes[0];
  const nodeLabel = firstKafkaNode?.data?.label || "Kafka Broker";
  const packageFolder = toFolderName(nodeLabel) || "kafka";
  const packageName = `@workspace/${packageFolder}`;

  if (kafkaNodes.length === 0) {
    return { files: [], reusableFunctions: [], packageFolder: "kafka", packageName: "@workspace/kafka" };
  }

  // Gather all topics across all Kafka nodes (de-duped by name)
  const seenTopicNames = new Set<string>();
  const allTopics: (KafkaTopic & { nodeId: string; nodeLabel: string })[] = [];

  kafkaNodes.forEach((node) => {
    const label = node.data?.label || "Kafka Broker";
    const topics = node.data?.topics;
    if (topics && Array.isArray(topics)) {
      topics.forEach((t) => {
        if (t.name && !seenTopicNames.has(t.name)) {
          seenTopicNames.add(t.name);
          let payloadSchema = t.payloadSchema;

          if (!payloadSchema) {
            for (const n of allNodes) {
              const nodeEndpoints = n.data?.endpoints;
              if (nodeEndpoints && Array.isArray(nodeEndpoints)) {
                const matchedEp = nodeEndpoints.find((ep) => {
                  const epPubs = ep.publishedEvents;
                  return (
                    epPubs &&
                    Array.isArray(epPubs) &&
                    epPubs.some(
                      (p) =>
                        p.messagingResourceId === t.id ||
                        (p.name && p.name.toLowerCase() === t.name.toLowerCase()),
                    )
                  );
                });
                if (matchedEp?.requestBody) {
                  payloadSchema = matchedEp.requestBody;
                  break;
                }
              }
            }
          }

          allTopics.push({ ...t, payloadSchema, nodeId: node.id, nodeLabel: label });
        }
      });
    }
  });

  const brokerConfig = firstKafkaNode?.data?.kafkaBroker ?? {};
  const defaultPartitions = brokerConfig.partitions ?? 3;
  const defaultReplication = brokerConfig.replication ?? 1;

  // Package configuration files
  files.push(generatePackageJson(packageName, nodeLabel));
  files.push(generateTsConfig());
  files.push(generateConfigFile(nodeLabel, packageFolder, defaultPartitions, defaultReplication));
  files.push(generateClientFile(nodeLabel));
  files.push(generateAdminFile(nodeLabel));

  // Topics
  const topicList: (KafkaTopic & { nodeId: string; nodeLabel: string })[] = allTopics.length > 0
    ? allTopics
    : [{ id: "topic-system-events", name: "system-events", nodeId: "", nodeLabel }];

  const topicBarrelExports: string[] = [];
  const topicImports: string[] = [];
  const kafkaTopicsEntries: string[] = [];
  const seenTopicKeys = new Set<string>();

  topicList.forEach((t) => {
    const varName = toVarName(t.name) || "topic";
    const key = toTopicKey(t.name);
    if (seenTopicKeys.has(key)) return;
    seenTopicKeys.add(key);

    files.push({
      filename: `src/topics/${varName}.ts`,
      language: "typescript",
      content: generateTopicFile(t.name),
    });

    topicImports.push(`import { ${key}_TOPIC } from "./${varName}";`);
    topicBarrelExports.push(`export * from "./${varName}";`);
    kafkaTopicsEntries.push(`  ${key}: ${key}_TOPIC,`);
  });

  files.push(generateTopicsIndexFile(topicBarrelExports, kafkaTopicsEntries, topicImports));

  // Publishers
  const publisherBarrelExports: string[] = [];

  topicList.forEach((t) => {
    const varName = toVarName(t.name) || "topic";
    const key = toTopicKey(t.name);
    if (!seenTopicKeys.has(key)) return;

    files.push({
      filename: `src/publishers/${varName}.ts`,
      language: "typescript",
      content: generatePublisherFile(t.name, nodeLabel, t.payloadSchema),
    });

    publisherBarrelExports.push(`export * from "./${varName}";`);
  });

  files.push(generatePublishersIndexFile(publisherBarrelExports, nodeLabel, topicList));

  // Consumers
  const consumerBarrelExports: string[] = [];

  topicList.forEach((t) => {
    const varName = toVarName(t.name) || "topic";

    files.push({
      filename: `src/consumers/${varName}.ts`,
      language: "typescript",
      content: generateConsumerFile(t.name, nodeLabel),
    });

    consumerBarrelExports.push(`export * from "./${varName}";`);
  });

  files.push(generateConsumersIndexFile(consumerBarrelExports, nodeLabel));

  // Master barrel index & docker compose
  files.push(generateIndexFile(packageName, nodeLabel));
  files.push(generateDockerComposeFile(packageFolder));

  const reusableFunctions = generateReusableFunctions(packageName, packageFolder, topicList);

  return { files, reusableFunctions, packageFolder, packageName };
}
