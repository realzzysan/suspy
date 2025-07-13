import chalk from "chalk";

const toRun = {
    discord: Boolean(process.env.DISCORD_TOKEN && process.env.DISCORD_TOKEN.length > 0),
    telegram: Boolean(process.env.TELEGRAM_TOKEN && process.env.TELEGRAM_TOKEN.length > 0),
}

if (!Object.values(toRun).some(Boolean)) {
    console.error(chalk.redBright("No services to run. Please set DISCORD_TOKEN or TELEGRAM_TOKEN in your environment variables."));
    process.exit(1);
}
console.log(`Launching ${Object.keys(toRun).filter(key => toRun[key as keyof typeof toRun]).map(val => chalk.greenBright(val)).join(" and ")}...\n`);

// Execute run functions for enabled services
Object.keys(toRun).filter(key => toRun[key as keyof typeof toRun]).forEach(async (key) => {
    Bun.spawn(["bun", `start:${key}`], {
        stdio: ["inherit", "inherit", "inherit"]
    });
});