import { REST, Routes } from "discord.js";
import { client } from '@/discord';

import type {
    RESTPostAPIChatInputApplicationCommandsJSONBody
} from "discord.js";

import fs from 'fs';
import path from 'path';

import logger from "@/shared/lib/utils/logger";
import type { CommandModule, EventModule } from "@/discord/types";

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN!);

const importFiles = async <T>(dir: string, filter: string) => {
    const modules: T[] = [];
    
    const readDirRecursive = async (currentDir: string, depth = 0) => {
        if (depth > 5) return; // Max depth of 5
        
        const items = fs.readdirSync(currentDir);
        
        for (const item of items) {
            const itemPath = path.join(currentDir, item);
            const stats = fs.statSync(itemPath);
            
            if (stats.isDirectory()) {
                await readDirRecursive(itemPath, depth + 1);
            } else if (item.endsWith(filter)) {
                try {
                    const module = (await import(itemPath)).default;
                    modules.push(module);
                } catch (error) {
                    logger.error(`Failed to import ${itemPath}:`, error);
                }
            }
        }
    };
    
    await readDirRecursive(dir);
    return modules;
};

export const registerCommands = async () => {
    const commandsPath = path.join(__dirname, '../../commands');
    const commands = await importFiles<CommandModule>(commandsPath, '.ts');

    if (commands.length === 0) {
        logger.info("✔ No slash commands to import.");
        return;
    }

    // Add commands to client
    commands.forEach(cmd => client.slashCommands.set(cmd.command.name, cmd));

    logger.info(`✔ Imported ${commands.length} slash commands.`);
    // Register commands
    registerAllCommands(commands.map(cmd => cmd.command.toJSON()));
};

const registerAllCommands = async (commands: RESTPostAPIChatInputApplicationCommandsJSONBody[]) => {
    if (commands.length === 0) return;
    if (process.env.DISCORD_CLIENT_ID === undefined && client.isReady()) {
        await new Promise(r => client.once('ready', r));
    }

    const clientId = process.env.DISCORD_CLIENT_ID || client.user!.id;

    try {
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        logger.info(`✔ Registered ${commands.length} slash commands.`);
    } catch (error) {
        logger.error("✘ Failed to register slash commands:", error);
    }
};

export const registerEvents = async () => {
    const eventsPath = path.join(__dirname, '../../events');
    const events = await importFiles<EventModule>(eventsPath, '.ts');

    if (events.length === 0) {
        logger.info("✔ No events to import.");
        return;
    }

    events.forEach(event => {
        if (!event.name || !event.execute) {
            logger.error(`✘ Event is missing name or execute function.`);
            return;
        }

        if (event.once) {
            client.once(event.name, event.execute);
        } else {
            client.on(event.name, event.execute);
        }
    });

    logger.info(`✔ Imported ${events.length} events.`);
};