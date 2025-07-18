import type { ChatInputCommandInteraction, SharedSlashCommand, ClientEvents } from "discord.js";
import type { Collection } from "@discordjs/collection";

export type CommandModule = {
  command: SharedSlashCommand;
  execute: (interaction: ChatInputCommandInteraction) => Promise<unknown>;
};
export type EventModule<K extends keyof ClientEvents = keyof ClientEvents> = {
  name: K;
  once?: boolean;
  execute: (...args: ClientEvents[K]) => Promise<unknown>;
};

declare module "discord.js" {
  interface Client {
    slashCommands: Collection<string, CommandModule>;
    events: Collection<string, EventModule<keyof ClientEvents>>;
  }
}

export {};