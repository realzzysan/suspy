import createLogger from "@/shared/lib/utils/logger";
const logger = createLogger();

import chalk from "chalk";
import { run as runDiscord } from "@/discord";
import { run as runTelegram } from "@/telegram";

const toRun = {
    discord: Boolean(process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN.length > 0),
    telegram: Boolean(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_TOKEN.length > 0),
}

console.log(`Launching ${Object.keys(toRun).filter(key => toRun[key as keyof typeof toRun]).map(val => chalk.greenBright(val)).join(" and ")}...\n`);

// Execute run functions for enabled services
if (toRun.discord) {
    runDiscord();
}
if (toRun.telegram) {
    runTelegram();
}
