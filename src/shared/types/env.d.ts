declare global {
    namespace NodeJS {
        interface ProcessEnv {

            // Postgres connection string
            DATABASE_URL: string;

            // Debug mode?
            DEBUG: ('true'|'false')?;
        }
    }
}

export { };