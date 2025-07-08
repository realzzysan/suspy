declare global {
    namespace NodeJS {
        interface ProcessEnv {
            // Debug mode?
            DEBUG: ('true'|'false')?;
        }
    }
}

export { };