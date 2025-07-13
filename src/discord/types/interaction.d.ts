import type { SetupProcess } from "../commands/setup";

export const InteractionActionsId = {
  1: "setupAction",
  2: "serverReportAction",
  3: "setupTakeoverAction",
} as const;

// Setup Action
export type InteractionActionSetupKey = `${ActionIdFor<"setupAction">}:${string}:${SetupProcess["step"]}:${string}`;
export type InteractionActionSetupTakeoverKey = `${ActionIdFor<"setupTakeoverAction">}:${string}:${string}`;

// Server Report Action
export type InteractionActionServerReportKey = `${ActionIdFor<"serverReportAction">}:${string}:${string}:${keyof typeof InteractionActionServerReportAction}:${string}`;
export const InteractionActionServerReportAction = {
  1: "blockURL",
  2: "blockHostname",
  3: "ignore"
} as const;

// Helper
type ValueOf<T> = T[keyof T];
export type ActionIdFor<T extends ValueOf<typeof InteractionActionsId>> = {
  [K in keyof typeof InteractionActionsId]: typeof InteractionActionsId[K] extends T ? K : never;
}[keyof typeof InteractionActionsId];