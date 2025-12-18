import { createLogger } from "../logger";

const log = createLogger();

const deriveEncryptionKey = (token: string): string => {
  try {
    const claims = JSON.parse(atob(token.split(".")[1]));
    // Use a combination of claims that won't change during the session
    return `${claims.sub}:${claims.tid}:${claims.email}`;
  } catch (error) {
    log.error("Error deriving encryption key", error);
    throw new Error("Failed to derive encryption key from token");
  }
};

export { deriveEncryptionKey };
