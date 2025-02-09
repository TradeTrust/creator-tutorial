import { readFileSync, writeFileSync, appendFileSync } from "fs";
import { join } from "path";

export const writeEnvVariable = (key: string, value: string): void => {
  const envPath = join(process.cwd(), '.env');
  const envString = JSON.stringify(value);

  try {
    let existingEnv = readFileSync(envPath, 'utf8');
    if (!existingEnv.includes(`${key}=`)) {
      const envData = existingEnv.endsWith('\n') ?
        `${key}=${envString}\n` :
        `\n${key}=${envString}\n`;
      appendFileSync(envPath, envData);
      console.log(`${key} has been written to .env file`);
    } else {
      // Replace existing value
      const envLines = existingEnv.split('\n');
      const updatedEnv = envLines.map(line =>
        line.startsWith(`${key}=`) ? `${key}=${envString}` : line
      ).join('\n');
      writeFileSync(envPath, updatedEnv.endsWith('\n') ? updatedEnv : updatedEnv + '\n');
      console.log(`Existing ${key} has been overwritten in .env file`);
    }
  } catch (error) {
    writeFileSync(envPath, `${key}=${envString}\n`);
    console.log(`Created new .env file with ${key}`);
  }
};