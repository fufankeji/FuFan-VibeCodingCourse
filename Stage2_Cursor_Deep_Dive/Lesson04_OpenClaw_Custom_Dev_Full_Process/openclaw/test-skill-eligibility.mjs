import dotenv from 'dotenv';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';

// Load .env like the gateway does
dotenv.config();

console.log('=== ENV CHECK ===');
console.log('TAVILY_API_KEY in process.env:', Boolean(process.env.TAVILY_API_KEY));
console.log('Value prefix:', process.env.TAVILY_API_KEY ? process.env.TAVILY_API_KEY.substring(0, 15) + '...' : 'NOT SET');

// Check hasBinary
function hasBinary(name) {
  try {
    execFileSync(process.platform === 'win32' ? 'where' : 'which', [name], { stdio: 'pipe' });
    return true;
  } catch { return false; }
}

console.log('\n=== BINARY CHECK ===');
console.log('node binary:', hasBinary('node'));
console.log('curl binary:', hasBinary('curl'));

// Simulate skill config resolution
const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const skillConfig = config?.skills?.entries?.tavily;

console.log('\n=== SKILL CONFIG ===');
console.log('skillConfig:', JSON.stringify(skillConfig));
console.log('skillConfig.apiKey:', skillConfig?.apiKey ? 'SET' : 'NOT SET');
console.log('skillConfig.env:', JSON.stringify(skillConfig?.env));

// Simulate hasEnv check
const envName = 'TAVILY_API_KEY';
const primaryEnv = 'TAVILY_API_KEY';
const path1 = Boolean(process.env[envName]);
const path2 = Boolean(skillConfig?.env?.[envName]);
const path3 = Boolean(skillConfig?.apiKey && primaryEnv === envName);

console.log('\n=== hasEnv("TAVILY_API_KEY") SIMULATION ===');
console.log('Path 1 (process.env):', path1);
console.log('Path 2 (config.env map):', path2);
console.log('Path 3 (apiKey + primaryEnv):', path3);
console.log('FINAL result:', path1 || path2 || path3);

// Check workspace skills dir
const workspaceSkillsDir = path.join(os.homedir(), '.openclaw', 'workspace', 'skills');
console.log('\n=== WORKSPACE SKILLS ===');
console.log('Dir:', workspaceSkillsDir);
console.log('Exists:', fs.existsSync(workspaceSkillsDir));
if (fs.existsSync(workspaceSkillsDir)) {
  const entries = fs.readdirSync(workspaceSkillsDir);
  for (const name of entries) {
    const skillMd = path.join(workspaceSkillsDir, name, 'SKILL.md');
    if (fs.existsSync(skillMd)) {
      const content = fs.readFileSync(skillMd, 'utf8');
      const nameMatch = content.match(/^name:\s*(.+)$/m);
      console.log('  Found:', name, '-> skill name:', nameMatch?.[1]);
    }
  }
}
