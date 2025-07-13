import type { CommandModule, EventModule } from "@/discord/types";
import type { ClientEvents } from "discord.js";

export const defineCommand = (command: CommandModule): CommandModule => {
  return command;
}

export const defineEvent = <K extends keyof ClientEvents>(event: EventModule<K>): EventModule<K> => {
  return event;
}