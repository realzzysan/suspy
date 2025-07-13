declare global {
    namespace NodeJS {
        interface ProcessEnv {

            // Bot tokens
            // Bot disabled if not set
            DISCORD_TOKEN: string?;
            TELEGRAM_TOKEN: string?;

            // Discord bot client id
            // For slash commands registration
            DISCORD_CLIENT_ID: string?;

            // Gemini API key
            GEMINI_API_KEY: string;

            // Postgres connection string
            DATABASE_URL: string;

            // Debug mode?
            DEBUG: ('true'|'false')?;
        }
    }
}

export { };