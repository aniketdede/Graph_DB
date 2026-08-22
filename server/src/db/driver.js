// Singleton Bolt driver for CognoDB (official neo4j-driver).
import neo4j from 'neo4j-driver';
import config from '../config.js';

let driver = null;

export function getDriver() {
  if (!driver) {
    driver = neo4j.driver(
      config.neo4j.uri,
      neo4j.auth.basic(config.neo4j.user, config.neo4j.password),
      {
        connectionTimeout: 10000,
        maxConnectionPoolSize: 20,
        disableLosslessIntegers: true, // plain JS numbers in results
      }
    );
  }
  return driver;
}

/** Run a parameterised read query in its own session. */
export async function read(cypher, params = {}) {
  const session = getDriver().session({ defaultAccessMode: neo4j.session.READ });
  try {
    const result = await session.run(cypher, params);
    return result.records;
  } finally {
    await session.close();
  }
}

export async function verify() {
  await getDriver().verifyConnectivity();
}

export async function closeDriver() {
  if (driver) await driver.close();
  driver = null;
}
